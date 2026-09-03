import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  addPlaceholder,
  removePlaceholder,
  uploadPlaceholderField,
  placeholderRange,
  createIdSource,
} from '../upload-placeholder';

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [uploadPlaceholderField] });
}

describe('uploadPlaceholderField', () => {
  it('nimmt einen Platzhalter über addPlaceholder auf', () => {
    const state = stateOf('abc');
    const tr = state.update({ effects: addPlaceholder.of({ id: 1, from: 1, to: 2 }) });
    expect(placeholderRange(tr.state, 1)).toEqual({ from: 1, to: 2 });
  });

  it('liefert null für eine unbekannte ID', () => {
    expect(placeholderRange(stateOf('abc'), 99)).toBeNull();
  });

  it('mappt die Position mit, wenn weit davor Text eingefügt wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 0, insert: 'XXXXX' } }).state;
    expect(placeholderRange(s, 1)).toEqual({ from: 8, to: 12 });
    expect(s.doc.sliceString(8, 12)).toBe('[PH]');
  });

  it('bleibt dicht, wenn GENAU davor getippt wird', () => {
    // Der Bereich darf den neuen Text NICHT aufnehmen — sonst verschluckte ihn
    // die spätere Ersetzung durch das fertige Bild.
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 3, insert: 'XX' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PH]');
  });

  it('bleibt dicht, wenn GENAU dahinter getippt wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 7, insert: 'ZZ' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PH]');
  });

  it('nimmt Text auf, der MITTEN im Platzhalter landet', () => {
    // Innen getippter Text gehört zum Platzhalter und wird mit ersetzt — sonst
    // bliebe ein Bruchstück des Platzhaltertexts im Dokument stehen.
    const state = stateOf('[PH]');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 0, to: 4 }) }).state;
    s = s.update({ changes: { from: 2, insert: 'X' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PXH]');
  });

  it('nimmt den Bereich in DERSELBEN Transaktion auf, die ihn einfügt', () => {
    // Genau das dispatcht image-upload.ts: changes + addPlaceholder zusammen.
    // Der Effect-Wert darf dabei NICHT mitgemappt werden.
    const state = stateOf('Text ');
    const ph = '![Uploading a.png…]()';
    const s = state.update({
      changes: { from: 5, to: 5, insert: ph },
      effects: addPlaceholder.of({ id: 1, from: 5, to: 5 + ph.length }),
    }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe(ph);
  });

  it('entfernt den Eintrag, wenn der Bereich von Hand gelöscht wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 3, to: 7, insert: '' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('entfernt den Eintrag, wenn das ganze Dokument ersetzt wird (setValue)', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 0, to: s.doc.length, insert: 'ganz neu' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('entfernt den Eintrag über removePlaceholder', () => {
    const state = stateOf('abc');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 0, to: 3 }) }).state;
    s = s.update({ effects: removePlaceholder.of(1) }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('hält zwei Platzhalter unabhängig auseinander', () => {
    const state = stateOf('AAAA BBBB');
    let s = state.update({
      effects: [
        addPlaceholder.of({ id: 1, from: 0, to: 4 }),
        addPlaceholder.of({ id: 2, from: 5, to: 9 }),
      ],
    }).state;
    // Text VOR beiden einfügen: beide wandern um dieselbe Distanz.
    s = s.update({ changes: { from: 0, insert: '--' } }).state;
    expect(placeholderRange(s, 1)).toEqual({ from: 2, to: 6 });
    expect(placeholderRange(s, 2)).toEqual({ from: 7, to: 11 });
  });

  it('lässt den zweiten Platzhalter unberührt, wenn der erste gelöscht wird', () => {
    const state = stateOf('AAAA BBBB');
    let s = state.update({
      effects: [
        addPlaceholder.of({ id: 1, from: 0, to: 4 }),
        addPlaceholder.of({ id: 2, from: 5, to: 9 }),
      ],
    }).state;
    s = s.update({ changes: { from: 0, to: 4, insert: '' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
    expect(placeholderRange(s, 2)).toEqual({ from: 1, to: 5 });
  });

  it('überlebt eine Änderung nach dem Ersetzen des eigenen Bereichs nicht', () => {
    // Nach dem Ersatz durch das fertige Bild muss der Eintrag weg sein — sonst
    // würde ein zweites Ergebnis erneut an derselben Stelle schreiben.
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({
      changes: { from: 3, to: 7, insert: '![a](u)' },
      effects: removePlaceholder.of(1),
    }).state;
    expect(placeholderRange(s, 1)).toBeNull();
    expect(s.doc.toString()).toBe('vor![a](u)nach');
  });
});

describe('createIdSource', () => {
  it('liefert bei jedem Aufruf eine neue ID', () => {
    const nächste = createIdSource();
    expect(new Set([nächste(), nächste(), nächste()]).size).toBe(3);
  });

  it('startet jede Quelle bei derselben Zahl', () => {
    // Genau das kann ein modul-globaler Zähler nicht: Der Test wäre von der
    // Reihenfolge aller vorherigen Aufrufe im Prozess abhängig.
    expect(createIdSource()()).toBe(createIdSource()());
  });

  it('zwei Quellen laufen unabhängig voneinander', () => {
    const a = createIdSource();
    const b = createIdSource();
    a();
    a();
    expect(b()).toBe(1);
    expect(a()).toBe(3);
  });
});

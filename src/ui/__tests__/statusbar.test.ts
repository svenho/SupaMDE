import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createStatusbar, DEFAULT_STATUS } from '../statusbar';

function stateOf(doc: string, pos = 0): EditorState {
  return EditorState.create({ doc, selection: { anchor: pos } });
}

const full = { docChanged: true, selectionSet: true };

describe('createStatusbar', () => {
  it('liefert null bei status=false', () => {
    expect(createStatusbar(false)).toBeNull();
  });

  it('Default enthält lines, words, cursor', () => {
    expect(DEFAULT_STATUS).toEqual(['lines', 'words', 'cursor']);
  });

  it('rendert ein span pro Item', () => {
    const sb = createStatusbar(['lines', 'words', 'cursor'])!;
    expect(sb.dom.querySelectorAll('span').length).toBe(3);
  });

  it('lines zeigt die Zeilenzahl', () => {
    const sb = createStatusbar(['lines'])!;
    sb.update(stateOf('a\nb\nc'), full);
    expect(sb.dom.querySelector('.supamde-status-lines')!.textContent).toContain('3');
  });

  it('words zeigt die Wortzahl', () => {
    const sb = createStatusbar(['words'])!;
    sb.update(stateOf('ein zwei drei'), full);
    expect(sb.dom.querySelector('.supamde-status-words')!.textContent).toContain('3');
  });

  it('cursor zeigt Zeile und Spalte (1-basiert)', () => {
    const sb = createStatusbar(['cursor'])!;
    sb.update(stateOf('abc\ndef', 5), full); // Zeile 2, Spalte 2
    const text = sb.dom.querySelector('.supamde-status-cursor')!.textContent!;
    expect(text).toBe('2:2');
  });

  it('autosave-Slot rendert leer (M3-No-op)', () => {
    const sb = createStatusbar(['autosave'])!;
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe('');
  });

  it('Custom-Item ruft onUpdate bei docChanged', () => {
    const onUpdate = vi.fn();
    const sb = createStatusbar([{ className: 'custom', defaultValue: '0', onUpdate }])!;
    sb.update(stateOf('x'), { docChanged: true, selectionSet: false });
    expect(onUpdate).toHaveBeenCalled();
  });

  it('setItem überschreibt den Inhalt eines Built-ins', () => {
    const sb = createStatusbar(['autosave'])!;
    sb.setItem('autosave', 'gespeichert 12:00');
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe('gespeichert 12:00');
  });

  it('upload-image-Slot rendert leer, bis er gesetzt wird', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe('');
  });

  it('setItem befüllt den upload-image-Slot', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.setItem('upload-image', 'Lade a.png hoch…');
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe(
      'Lade a.png hoch…',
    );
  });

  it('ein gesetzter autosave-Wert überlebt das nächste update()', () => {
    const sb = createStatusbar(['autosave', 'words'])!;
    sb.setItem('autosave', 'Gespeichert: 14:03');
    sb.update(stateOf('neuer Text'), full);
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe(
      'Gespeichert: 14:03',
    );
    // Die nicht-sticky Items werden weiterhin normal aktualisiert.
    expect(sb.dom.querySelector('.supamde-status-words')!.textContent).toContain('2');
  });

  it('ein gesetzter upload-image-Wert überlebt das nächste update()', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.setItem('upload-image', 'a.png hochgeladen');
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe(
      'a.png hochgeladen',
    );
  });

  it('setItem auf ein NICHT gerendertes Item tut nichts (kein Wurf)', () => {
    const sb = createStatusbar(['words'])!;
    expect(() => sb.setItem('autosave', 'x')).not.toThrow();
  });

  it('DEFAULT_STATUS enthält weder autosave noch upload-image', () => {
    expect(DEFAULT_STATUS).not.toContain('autosave');
    expect(DEFAULT_STATUS).not.toContain('upload-image');
  });
});

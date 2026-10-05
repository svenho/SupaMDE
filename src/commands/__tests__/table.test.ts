import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { table } from '../table';
import { translatorFacet } from '../../i18n/facet';
import { createTranslator } from '../../i18n/translator';
import { de } from '../../i18n/de';

function viewWith(doc: string, anchor = 0, extensions: Extension[] = []): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor),
    extensions,
  });
  return new EditorView({ state });
}

describe('table (AC-T1)', () => {
  it('fügt ein GFM-Tabellengerüst ein — ohne Translator englisch', () => {
    const view = viewWith('', 0);
    expect(table(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n');
    view.destroy();
  });

  it('nimmt die Spaltenköpfe aus dem Translator im State', () => {
    const view = viewWith('', 0, [translatorFacet.of(createTranslator(de))]);
    table(view);
    expect(view.state.doc.toString()).toBe('| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n');
    view.destroy();
  });

  it('setzt den Cursor hinter das Gerüst', () => {
    const view = viewWith('', 0, [translatorFacet.of(createTranslator(de))]);
    table(view);
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    view.destroy();
  });
});

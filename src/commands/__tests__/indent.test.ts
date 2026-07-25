import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { indentLines } from '../indent';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('indentLines — Tab', () => {
  it('rückt die Cursorzeile ein, auch wenn der Cursor mitten im Text steht', () => {
    const view = viewWith('Hallo Welt', 5);
    expect(indentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  Hallo Welt');
    view.destroy();
  });

  it('rückt auch bei Cursor am Zeilenende am Zeilenanfang ein', () => {
    const view = viewWith('Hallo', 5);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  Hallo');
    view.destroy();
  });

  it('rückt alle von der Selektion berührten Zeilen ein', () => {
    const view = viewWith('a\nb\nc', 0, 5);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  a\n  b\n  c');
    view.destroy();
  });

  it('verschachtelt eine Listenzeile', () => {
    const view = viewWith('- Punkt', 3);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  - Punkt');
    view.destroy();
  });

  it('rückt eine bereits eingerückte Zeile eine weitere Stufe ein', () => {
    const view = viewWith('  - Punkt', 0);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('    - Punkt');
    view.destroy();
  });

  it('lässt die Selektion beide Zeilen weiter berühren, inklusive neuer Einrückung', () => {
    const view = viewWith('ab\ncd', 0, 5);
    indentLines(view);
    const { from, to } = view.state.selection.main;
    expect(from).toBeLessThan(to);
    expect(view.state.doc.sliceString(from, to)).toBe('ab\n  cd');
    view.destroy();
  });

  it('rückt eine leere Zeile ebenfalls ein', () => {
    const view = viewWith('', 0);
    expect(indentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  ');
    view.destroy();
  });
});

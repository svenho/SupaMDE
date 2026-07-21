import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { table } from '../table';

function viewWith(doc: string, anchor = 0): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor),
  });
  return new EditorView({ state });
}

describe('table (AC-T1)', () => {
  it('fügt ein GFM-Tabellengerüst ein', () => {
    const view = viewWith('', 0);
    expect(table(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      '| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n',
    );
    view.destroy();
  });
});

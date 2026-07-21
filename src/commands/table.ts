import type { SupaCommand } from './types';

/** Fügt ein GFM-Tabellengerüst (Header, Trennzeile, eine Datenzeile) am Cursor ein. */
export const table: SupaCommand = (view) => {
  const skeleton = '| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n';
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: skeleton },
    selection: { anchor: sel.from + skeleton.length },
  });
  return true;
};

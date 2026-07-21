import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DocChange } from '../commands/types';

/** Der volle Zeilenbereich, den die Hauptselektion berührt. */
export interface LineRange {
  /** Doc-Offset am Anfang der ersten berührten Zeile. */
  from: number;
  /** Doc-Offset am Ende der letzten berührten Zeile. */
  to: number;
  /** 1-basierte Nummer der ersten Zeile. */
  firstLine: number;
  /** 1-basierte Nummer der letzten Zeile. */
  lastLine: number;
}

/** Ermittelt den vollständigen Zeilenbereich der Hauptselektion. */
export function selectedLineRange(state: EditorState): LineRange {
  const sel = state.selection.main;
  const first = state.doc.lineAt(sel.from);
  const last = state.doc.lineAt(sel.to);
  return {
    from: first.from,
    to: last.to,
    firstLine: first.number,
    lastLine: last.number,
  };
}

/**
 * Toggelt ein Zeilen-Präfix über den Selektions-Zeilenbereich: tragen ALLE
 * Zeilen das Präfix, wird es entfernt, sonst überall hinzugefügt.
 */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view;
  const range = selectedLineRange(state);
  const changes: DocChange[] = [];

  let allHavePrefix = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    if (!line.text.startsWith(prefix)) {
      allHavePrefix = false;
      break;
    }
  }

  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    if (allHavePrefix) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
    } else if (!line.text.startsWith(prefix)) {
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}

/**
 * Umschließt die Hauptselektion mit `before`/`after`. Bei leerer Selektion
 * wird ein Marker-Paar eingefügt und der Cursor dazwischen platziert.
 */
export function wrapSelection(view: EditorView, before: string, after: string): boolean {
  const sel = view.state.selection.main;
  view.dispatch({
    changes: [
      { from: sel.from, insert: before },
      { from: sel.to, insert: after },
    ],
    selection: sel.empty
      ? { anchor: sel.from + before.length }
      : {
          anchor: sel.from + before.length,
          head: sel.to + before.length,
        },
  });
  return true;
}

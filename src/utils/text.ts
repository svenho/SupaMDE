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
 *
 * `detect` bestimmt, ob eine Zeile als „bereits mit Präfix" gilt und welche
 * Länge dann entfernt wird — nötig, wenn mehrere Marker denselben Listentyp
 * bezeichnen (z. B. `- ` und `* ` als ungeordnete Liste). Ohne `detect` gilt
 * ein exakter `startsWith(prefix)` (die Länge ist dann `prefix.length`).
 */
export function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  detect: RegExp = new RegExp(`^${escapeForRegExp(prefix)}`),
): boolean {
  const { state } = view;
  const range = selectedLineRange(state);
  const changes: DocChange[] = [];

  let allHavePrefix = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    if (!detect.test(state.doc.line(n).text)) {
      allHavePrefix = false;
      break;
    }
  }

  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    const existing = detect.exec(line.text);
    if (allHavePrefix) {
      // existing ist hier garantiert vorhanden (allHavePrefix wurde oben geprüft).
      const len = existing ? existing[0].length : 0;
      changes.push({ from: line.from, to: line.from + len, insert: '' });
    } else if (!existing) {
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}

/** Escaped Sonderzeichen eines Strings für die wörtliche Nutzung in einem RegExp. */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

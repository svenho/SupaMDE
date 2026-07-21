import type { EditorView } from '@codemirror/view';
import type { DocChange, SupaCommand } from './types';
import { stripLinePrefix } from './prefixes';
import { selectedLineRange, toggleLinePrefix } from '../utils/text';

/** Ungeordnete Liste (`- `) je Zeile ein-/ausschalten. */
export const unorderedList: SupaCommand = (view) => toggleLinePrefix(view, '- ');

/** Checkliste (`- [ ] `) je Zeile ein-/ausschalten. */
export const checkList: SupaCommand = (view) => toggleLinePrefix(view, '- [ ] ');

/** Geordnete Liste (`1. `, `2. `, …) fortlaufend setzen bzw. entfernen. */
export const orderedList: SupaCommand = (view) => {
  const range = selectedLineRange(view.state);
  // Wenn ALLE Zeilen bereits nummeriert sind → entfernen.
  let allNumbered = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    if (!/^\d+\. /.test(view.state.doc.line(n).text)) {
      allNumbered = false;
      break;
    }
  }
  const changes: DocChange[] = [];
  let counter = 1;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    if (allNumbered) {
      const match = /^\d+\. /.exec(line.text);
      const len = match ? match[0].length : 0;
      changes.push({ from: line.from, to: line.from + len, insert: '' });
    } else {
      changes.push({ from: line.from, to: line.from, insert: `${counter}. ` });
      counter++;
    }
  }
  view.dispatch({ changes });
  return true;
};

/**
 * Berechnet aus einem erkannten Ist-Präfix das Präfix für die FORTSETZUNGSZEILE:
 * geordnete Listen werden inkrementiert (`3. ` → `4. `), Checklisten starten leer
 * (`- [x] ` → `- [ ] `), ungeordnete bleiben gleich. `null`, wenn kein Listenpräfix.
 */
function continuationPrefix(currentPrefix: string): string | null {
  if (/^- \[[ xX]\] $/.test(currentPrefix)) return '- [ ] ';
  const ordered = /^(\d+)\. $/.exec(currentPrefix);
  if (ordered) return `${Number(ordered[1]) + 1}. `;
  if (currentPrefix === '- ') return '- ';
  return null;
}

/**
 * Enter-Handler für Listen: setzt das Präfix in der neuen Zeile fort; ist die
 * aktuelle Listenzeile leer (nur Präfix), wird die Liste beendet (Präfix weg).
 * `false`, wenn die Cursorzeile keine Liste ist (Standard-Enter greift dann).
 *
 * Die Präfix-Erkennung teilt sich mit `cleanBlock` die zentrale `stripLinePrefix`
 * (Task 1); nur die Fortsetzungs-Logik (Inkrement) ist listenspezifisch.
 */
export function continueList(view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.head);
  const stripped = stripLinePrefix(line.text);
  if (stripped === null) return false;
  // Heading/Quote sind zwar Präfixe, aber keine Listen → Standard-Enter.
  const prefix = continuationPrefix(stripped.prefix);
  if (prefix === null) return false;

  if (stripped.rest.length === 0) {
    // Leere Listenzeile → Liste beenden: Präfix entfernen.
    view.dispatch({ changes: { from: line.from, to: line.to, insert: '' } });
    return true;
  }

  view.dispatch({
    changes: { from: sel.head, insert: `\n${prefix}` },
    selection: { anchor: sel.head + 1 + prefix.length },
  });
  return true;
}

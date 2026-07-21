import type { EditorView } from '@codemirror/view';
import type { DocChange, SupaCommand } from './types';
import { stripLinePrefix } from './prefixes';
import { selectedLineRange, toggleLinePrefix, wrapSelection } from '../utils/text';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Liefert das aktuelle Heading-Level der ersten Selektionszeile (0 = keins). */
function currentLevel(view: EditorView): number {
  const { firstLine } = selectedLineRange(view.state);
  const text = view.state.doc.line(firstLine).text;
  const match = /^(#{1,6}) /.exec(text);
  return match ? match[1].length : 0;
}

/** Setzt jede Selektionszeile auf `level` #-Zeichen; `level === 0` entfernt sie. */
function applyHeading(view: EditorView, level: number): boolean {
  const range = selectedLineRange(view.state);
  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    const existing = /^(#{1,6}) /.exec(line.text);
    const oldLen = existing ? existing[0].length : 0;
    const insert = level === 0 ? '' : '#'.repeat(level) + ' ';
    changes.push({ from: line.from, to: line.from + oldLen, insert });
  }
  view.dispatch({ changes });
  return true;
}

/** Setzt ein absolutes Heading-Level; erneutes Setzen desselben Levels entfernt es. */
export function setHeading(level: HeadingLevel): SupaCommand {
  return (view) => applyHeading(view, currentLevel(view) === level ? 0 : level);
}

/** Verkleinert die Überschrift (mehr #, Grenze 6); aus Klartext wird H1. */
export const headingSmaller: SupaCommand = (view) => {
  const next = Math.min(currentLevel(view) + 1, 6);
  return applyHeading(view, next);
};

/** Vergrößert die Überschrift (weniger #); H1 → Klartext, bleibt bei Klartext. */
export const headingBigger: SupaCommand = (view) => {
  const next = Math.max(currentLevel(view) - 1, 0);
  return applyHeading(view, next);
};

/** Blockzitat (`> `) je Zeile ein-/ausschalten. */
export const quote: SupaCommand = (view) => toggleLinePrefix(view, '> ');

/**
 * Umschließt die Selektion mit ```-Fences (Codeblock) bzw. entfernt sie, wenn die
 * Selektion bereits exakt von einem `` ```-Fence-Paar `` umschlossen ist (Toggle).
 */
export const codeBlock: SupaCommand = (view) => {
  const sel = view.state.selection.main;
  const before = '```\n';
  const after = '\n```';
  const pre = view.state.sliceDoc(Math.max(0, sel.from - before.length), sel.from);
  const post = view.state.sliceDoc(sel.to, Math.min(view.state.doc.length, sel.to + after.length));
  if (pre === before && post === after) {
    // Toggle-Off: die umschließenden Fences entfernen.
    view.dispatch({
      changes: [
        { from: sel.from - before.length, to: sel.from, insert: '' },
        { from: sel.to, to: sel.to + after.length, insert: '' },
      ],
    });
    return true;
  }
  return wrapSelection(view, before, after);
};

/** Fügt eine horizontale Trennlinie (`\n---\n`) an der Cursorzeile ein. */
export const horizontalRule: SupaCommand = (view) => {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({ changes: { from: line.to, insert: '\n---\n' } });
  return true;
};

/** Entfernt erkannte Block-/Listen-Präfixe (#, >, -, 1., - [ ]) der selektierten Zeilen. */
export const cleanBlock: SupaCommand = (view) => {
  const range = selectedLineRange(view.state);
  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    const stripped = stripLinePrefix(line.text);
    if (stripped) {
      changes.push({ from: line.from, to: line.from + stripped.prefix.length, insert: '' });
    }
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
};

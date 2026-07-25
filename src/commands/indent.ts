import { getIndentUnit } from '@codemirror/language';
import type { SupaCommand } from './types';
import { mapSelectedLines } from '../utils/text';

/**
 * Rückt alle von der Hauptselektion berührten Zeilen um ein `indentUnit` ein
 * (Leerzeichen, Default 2). Die Einrückung wird IMMER am Zeilenanfang eingefügt,
 * unabhängig davon, wo der Cursor in der Zeile steht — anders als der CM6-
 * Standard `indentWithTab`, der mitten im Text ein Tab-Zeichen setzen würde.
 *
 * In Markdown ergibt sich die Listen-Verschachtelung genau aus dieser
 * Leerzeichen-Einrückung, deshalb braucht es keinen Listen-Sonderfall.
 */
export const indentLines: SupaCommand = (view) => {
  const indent = ' '.repeat(getIndentUnit(view.state));
  mapSelectedLines(view, (line) => ({ from: line.from, to: line.from, insert: indent }));
  // Immer `true`: die Taste wird in jedem Fall konsumiert, damit der Browser
  // den Fokus nicht aus dem Editor bewegt.
  return true;
};

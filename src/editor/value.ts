import type { EditorView } from '@codemirror/view';

/**
 * Headless value-Logik über einer `EditorView`. Bewusst aus der `SupaMDE`-
 * Fassade herausgezogen: so ist sie ohne Textarea/Konstruktor testbar (Spec
 * Abschnitt 3) und in M2 (Commands) wiederverwendbar.
 */

/** Liefert den aktuellen Editor-Inhalt als String. */
export function readValue(view: EditorView): string {
  return view.state.doc.toString();
}

/** Ersetzt den gesamten Editor-Inhalt durch `val`. */
export function writeValue(view: EditorView, val: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: val },
  });
}

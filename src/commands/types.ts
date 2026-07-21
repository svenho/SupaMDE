import type { EditorView } from '@codemirror/view';

/**
 * Ein SupaMDE-Command ist eine reine CM6-Command-Funktion: liest `view.state`,
 * dispatcht bei Bedarf eine Transaktion und liefert `true`, wenn das Doc
 * verändert wurde — sonst `false` (No-op). Testbar ohne DOM/Toolbar.
 */
export type SupaCommand = (view: EditorView) => boolean;

/**
 * Eine einzelne Doc-Änderung im CM6-`changes`-Format. Zentral definiert, damit
 * die Command-Module (`text.ts`, `block.ts`, `list.ts`, `inline.ts`) nicht
 * jeweils denselben Inline-Typ wiederholen.
 */
export interface DocChange {
  from: number;
  to: number;
  insert: string;
}

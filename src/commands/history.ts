/**
 * Undo/Redo als dünne Re-Exports über `@codemirror/commands`. Der zugehörige
 * History-State wird über die `history()`-Extension bereitgestellt (siehe
 * `editor/extensions.ts`). Der CM6-`Command`-Typ ist zu `SupaCommand` kompatibel.
 */
export { undo, redo } from '@codemirror/commands';

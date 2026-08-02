import { Compartment, type Extension } from '@codemirror/state';
import { livePreviewPlugin } from './plugin';

export type { HiddenRange, MarkSets } from './ranges';
export { computeHiddenRanges, DEFAULT_MARK_SETS } from './ranges';

/**
 * Darstellungsmodus des Editors.
 *
 * - `'source'` — Markdown-Markup bleibt sichtbar (easyMDE-Parität). Default.
 * - `'live'` — Markup wird ausgeblendet und nur am Cursor sichtbar (Obsidian-Stil).
 */
export type EditorMode = 'source' | 'live';

/** Alle gültigen Modus-Werte — Grundlage der Options-Normalisierung. */
export const EDITOR_MODES: readonly EditorMode[] = ['source', 'live'];

/** Die Live-Preview-Extension: blendet inaktives Markup aus. */
export const livePreviewExtension: Extension = livePreviewPlugin;

/**
 * Compartment für den Modus-Wechsel zur Laufzeit. Ein `reconfigure` darauf tauscht
 * die Extension aus, ohne die View neu zu bauen — Dokument, Cursor, Selektion,
 * Undo-Historie und Scrollposition bleiben erhalten.
 */
export const livePreviewCompartment = new Compartment();

/** Die zum Modus gehörende Extension (leer im Source-Modus). */
export function livePreviewFor(mode: EditorMode): Extension {
  return mode === 'live' ? livePreviewExtension : [];
}

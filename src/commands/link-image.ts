import type { EditorView } from '@codemirror/view';
import type { SupaCommand } from './types';

/** Fügt `[text](url)` ein; ohne `text` wird die Selektion verwendet. */
export function insertLink(url: string, text?: string): SupaCommand {
  return (view) => {
    if (!url) return false;
    const sel = view.state.selection.main;
    const label = text ?? view.state.sliceDoc(sel.from, sel.to);
    const insert = `[${label}](${url})`;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + insert.length },
    });
    return true;
  };
}

/** Fügt `![alt](url)` ein; ohne `altText` wird die Selektion verwendet. */
export function insertImage(url: string, altText?: string): SupaCommand {
  return (view) => {
    if (!url) return false;
    const sel = view.state.selection.main;
    const alt = altText ?? view.state.sliceDoc(sel.from, sel.to);
    const insert = `![${alt}](${url})`;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + insert.length },
    });
    return true;
  };
}

/**
 * Toolbar-/Shortcut-Wrapper: fragt die URL per `window.prompt` ab und ruft den
 * reinen `insertLink`. Der Seiteneffekt (Prompt) ist bewusst hier isoliert.
 */
export function drawLink(view: EditorView): boolean {
  const url = window.prompt('Link-URL:', 'https://');
  if (!url) return false;
  return insertLink(url)(view);
}

/** Wie `drawLink`, aber für ein Bild (`insertImage`). */
export function drawImage(view: EditorView): boolean {
  const url = window.prompt('Bild-URL:', 'https://');
  if (!url) return false;
  return insertImage(url)(view);
}

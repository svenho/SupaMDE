import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';

export interface SideBySideOptions {
  /** Markdown→HTML-Funktion (aus markdown/parse.ts, mit Optionen gebunden). */
  render: (text: string) => string;
  /** Zusätzliche CSS-Klassen aufs Panel. */
  previewClass?: string | string[];
  /** Bidirektionaler Scroll-Sync (Default true). */
  syncScroll?: boolean;
}

export interface SideBySide {
  dom: HTMLElement;
  toggle(): void;
  isActive(): boolean;
  update(state: EditorState): void;
  destroy(): void;
}

/**
 * Side-by-Side-Vorschau: baut ein Panel neben `view.dom`. Das Layout-Toggle
 * (Flexbox 50/50) übernimmt CSS über die Klasse `supamde-sided` auf dem
 * Container (in index.ts gesetzt); dieses Modul verwaltet Panel-Inhalt,
 * Sichtbarkeit und Scroll-Sync. Live-Update erfolgt über `update()`, das der
 * zentrale updateListener-Sink ruft.
 */
export function createSideBySide(view: EditorView, opts: SideBySideOptions): SideBySide {
  const dom = document.createElement('div');
  dom.className = 'supamde-preview-side';
  if (opts.previewClass) {
    const classes = Array.isArray(opts.previewClass) ? opts.previewClass : [opts.previewClass];
    dom.classList.add(...classes);
  }
  dom.style.display = 'none';

  let active = false;
  const sync = opts.syncScroll ?? true;

  const rerender = (state: EditorState): void => {
    dom.innerHTML = opts.render(state.doc.toString());
  };

  // Scroll-Sync (ratio-basiert, mit Feedback-Guard).
  let syncingFrom: 'editor' | 'preview' | null = null;
  const scroller = view.scrollDOM;

  const onEditorScroll = (): void => {
    if (!active || !sync) return;
    if (syncingFrom === 'preview') { syncingFrom = null; return; }
    syncingFrom = 'editor';
    const denom = scroller.scrollHeight - scroller.clientHeight;
    const ratio = denom > 0 ? scroller.scrollTop / denom : 0;
    dom.scrollTop = (dom.scrollHeight - dom.clientHeight) * ratio;
  };
  const onPreviewScroll = (): void => {
    if (!active || !sync) return;
    if (syncingFrom === 'editor') { syncingFrom = null; return; }
    syncingFrom = 'preview';
    const denom = dom.scrollHeight - dom.clientHeight;
    const ratio = denom > 0 ? dom.scrollTop / denom : 0;
    scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * ratio;
  };

  if (sync) {
    scroller.addEventListener('scroll', onEditorScroll);
    dom.addEventListener('scroll', onPreviewScroll);
  }

  const toggle = (): void => {
    active = !active;
    dom.style.display = active ? '' : 'none';
    if (active) rerender(view.state);
  };

  const update = (state: EditorState): void => {
    if (active) rerender(state);
  };

  const destroy = (): void => {
    if (sync) {
      scroller.removeEventListener('scroll', onEditorScroll);
      dom.removeEventListener('scroll', onPreviewScroll);
    }
    dom.remove();
  };

  return { dom, toggle, isActive: () => active, update, destroy };
}

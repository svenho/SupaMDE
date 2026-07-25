import { Marked } from 'marked';
import { katexMarkedExtension } from './katex-marked';
import { addAnchorTargetBlank } from './sanitize';

export interface RenderOptions {
  /** marked `breaks`: einfacher Zeilenumbruch → <br>. Default true. */
  singleLineBreaks?: boolean;
  /** Ersetzt den eingebauten Renderer komplett (Fluchtluke). */
  previewRender?: (text: string) => string;
}

/**
 * Baut `RenderOptions` aus den (rohen) SupaMDE-Optionen — die EINE Stelle, an
 * der die Render-Relevanten Felder aus `SupaMDEOptions` extrahiert werden.
 * Panel-Verdrahtung UND `markdown()`-Fassade nutzen sie beide (keine
 * doppelte Inline-Konstruktion, Design §3.1 „eine Quelle der Wahrheit").
 *
 * Typ bewusst strukturell (`Pick`), damit `parse.ts` NICHT `options.ts`
 * importieren muss — bleibt frei von Editor-/Fassaden-Abhängigkeiten.
 */
export function renderOptionsFrom(o: {
  renderingConfig?: { singleLineBreaks?: boolean };
  previewRender?: (text: string) => string;
}): RenderOptions {
  return {
    singleLineBreaks: o.renderingConfig?.singleLineBreaks,
    previewRender: o.previewRender,
  };
}

/**
 * Markdown → HTML. Ohne `previewRender`: marked (GFM) + KaTeX-Extensions +
 * addAnchorTargetBlank. Reine Funktion (kein DOM, kein Editor) — Basis der
 * öffentlichen `markdown()`-Methode UND der Side-by-Side-Vorschau.
 */
export function markdownToHtml(text: string, opts: RenderOptions = {}): string {
  if (opts.previewRender) return opts.previewRender(text);
  const marked = new Marked({ gfm: true, breaks: opts.singleLineBreaks ?? true });
  marked.use(katexMarkedExtension);
  const html = marked.parse(text, { async: false }) as string;
  return addAnchorTargetBlank(html);
}

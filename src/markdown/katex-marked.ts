import type { MarkedExtension, TokenizerAndRendererExtension } from 'marked';
import { escapeHtml } from '../utils/html';

/** Signatur von `katex.renderToString`. */
type KatexRender = (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) => string;
/** Minimale Form des KaTeX-Objekts (global oder injiziert). */
interface KatexLike { renderToString: KatexRender }
/** Token-Objekt aus marked, mit text und raw. */
interface MathToken { text: string; raw: string }

/**
 * KaTeX defensiv & SYNCHRON auflösen. KaTeX ist eine OPTIONALE Peer-Dependency
 * (Design §3.3). Auflösungs-Reihenfolge, jedes Mal beim Rendern ausgewertet
 * (nicht gecacht → spätere Injektion/Late-CDN-Load wirkt sofort):
 *   1. explizit via `setKatex(...)` injiziert (Bundler-Host reicht sein KaTeX rein)
 *   2. `globalThis.katex` (CDN-`<script>`, z.B. im Example)
 * Fehlt beides, bleibt die Auflösung `null` → Renderer geben Rohtext zurück
 * (graceful degradation, kein Crash).
 */
let injected: KatexLike | null = null;

/**
 * Injiziert eine KaTeX-Instanz (für Bundler-Setups, die `katex` als echtes
 * Modul importieren und reinreichen). Fluchtluke — im Example/CDN-Fall nicht nötig.
 */
export function setKatex(katex: KatexLike | null): void {
  injected = katex;
}

/** Aktuelle KaTeX-Instanz oder null (synchron, ohne Import-Race). */
function resolveKatex(): KatexLike | null {
  if (injected) return injected;
  const g = (globalThis as { katex?: KatexLike }).katex;
  return g ?? null;
}

/** Rendert eine Formel; ohne KaTeX Rohtext (HTML-escaped) zurück. */
function render(expr: string, displayMode: boolean, raw: string): string {
  const katex = resolveKatex();
  if (!katex) return escapeHtml(raw);
  return katex.renderToString(expr, { displayMode, throwOnError: false });
}

/** Block-Formel: $$ … $$ (mehrzeilig, \begin{align} darin). displayMode. */
const blockMath: TokenizerAndRendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src) {
    return src.indexOf('$$');
  },
  tokenizer(src) {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (!match || !match[1]) return undefined;
    return { type: 'blockMath', raw: match[0], text: match[1].trim() };
  },
  renderer(token: MathToken) {
    return render(token.text, true, token.raw);
  },
};

/**
 * Inline-Formel: $ … $ (einzeilig). Kein-Leerzeichen-Regel (Design §3.2):
 * kein Space direkt nach dem öffnenden bzw. vor dem schließenden $, damit
 * Preistext ("$5 und $10") nicht als Formel erkannt wird, ziffern-beginnende
 * Formeln ("$x_5$") aber schon.
 */
const inlineMath: TokenizerAndRendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src) {
    return src.indexOf('$');
  },
  tokenizer(src) {
    const match = /^\$(?! )((?:[^$\n]|\\\$)*?[^ $\n])\$/.exec(src);
    if (!match || !match[1]) return undefined;
    return { type: 'inlineMath', raw: match[0], text: match[1] };
  },
  renderer(token: MathToken) {
    return render(token.text, false, token.raw);
  },
};

/** marked-Extension-Bündel für $$-Block- und $-Inline-Math. */
export const katexMarkedExtension: MarkedExtension = {
  extensions: [blockMath, inlineMath],
};

/** Ob KaTeX aktuell verfügbar ist (für Tests/Diagnose). Synchron, ohne Race. */
export function isKatexAvailable(): boolean {
  return resolveKatex() !== null;
}

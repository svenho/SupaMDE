# M4 — LaTeX-Live-Vorschau (Side-by-Side) & Fullscreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Side-by-Side-Live-Vorschau für Markdown mit LaTeX-Formeln (inline `$…$`, block `$$…$$`, `\begin{align}` in `$$`) plus einen Fullscreen-Modus, beide über Toolbar/API togglebar.

**Architecture:** Ein reiner Markdown+KaTeX-Renderer (`markdown/`) speist ein DOM-Vorschau-Panel (`ui/preview.ts`), das über den bestehenden zentralen `updateListener`-Sink live aktualisiert wird. Fullscreen (`ui/fullscreen.ts`) ist ein reines CSS-Toggle des Containers. Die Toolbar-Action wird zur diskriminierten Union `command | view`, damit Instanz-gebundene Aktionen (Panel/Fullscreen) sauber neben CM6-Commands koexistieren. KaTeX ist eine **optionale** Peer-Dependency mit graceful degradation.

**Tech Stack:** TypeScript (strict), CodeMirror 6, `marked@18`, `katex@0.18` (optional peer), Vitest (jsdom), Vite (Library-Mode), Lucide-Icons.

## Global Constraints

- **TypeScript:** bewusst `5.9.x` (nicht 7.x) wegen typescript-eslint — keine Version anheben.
- **ESM-only:** Kein CJS/UMD-Build, kein `require`-Einstieg. Paket ist `"type": "module"`.
- **Peer-Dependencies bündeln verboten:** CM6/Lezer sind extern. **KaTeX** kommt als **optionale** Peer-Dependency dazu (`peerDependenciesMeta.katex.optional = true`) und darf **nicht** ins Bundle. `marked` ist eine echte (gebündelte) Dependency.
- **Sprache:** Code-Kommentare, Fehlermeldungen, sichtbare Texte auf Deutsch; technische Identifier/CSS-Klassen englisch (`supamde-*`). Vollständige Umlaute, kein ASCII-Ersatz.
- **Ein Mechanismus:** Reaktive Updates laufen über den EINEN `updateListener`-Sink in `src/index.ts` — kein zweiter Editor-Listener.
- **`throwOnError: false`** bei jedem KaTeX-Aufruf — eine kaputte Formel darf die Vorschau nicht crashen.
- **Test-Ort:** `src/<bereich>/__tests__/<name>.test.ts`. Test-Runner: `npx vitest run <pfad>`.
- **Commits:** häufig, ein Commit pro abgeschlossenem Task. Commit-Messages deutsch, Format `typ(scope): …`, mit Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Neu:**
- `src/markdown/katex-marked.ts` — die zwei marked-Extensions (block/inline `$`), lädt KaTeX defensiv.
- `src/markdown/sanitize.ts` — `addAnchorTargetBlank`.
- `src/markdown/parse.ts` — `markdownToHtml(text, opts)`: marked + KaTeX-Extensions + sanitize; respektiert `previewRender`.
- `src/ui/preview.ts` — `createSideBySide(view, opts)`: Panel-DOM, Live-Update, Scroll-Sync, an-/abbauen.
- `src/ui/preview.css` — Side-by-Side-Layout (Flexbox) + Formel-Feinschliff.
- `src/ui/fullscreen.ts` — `createFullscreen(container, opts)`: CSS-Toggle + Body-Scroll-Sperre + Escape.
- `src/ui/fullscreen.css` — `.supamde-fullscreen`.
- Tests: je `__tests__/`-Datei zu obigen Modulen.

**Geändert:**
- `src/options.ts` — neue Optionen + Auflösung.
- `src/ui/actions.ts` — `ToolbarAction` wird Union; `side-by-side`/`fullscreen` als `kind: 'view'`.
- `src/ui/toolbar.ts` — `buildItem`/`update` verzweigen nach `kind`.
- `src/ui/toolbar-config.ts` — `DEFAULT_TOOLBAR` um `side-by-side`/`fullscreen` ergänzen.
- `src/ui/icons.ts` — Icons `side-by-side`/`fullscreen` ergänzen.
- `src/index.ts` — Panel + Fullscreen verdrahten, Sink erweitern, neue Fassaden-Methoden.
- `src/index.ts`-Import: `./ui/preview.css`, `./ui/fullscreen.css`.
- `package.json` — `marked` dep, `katex`/`@types/katex` als (optional) peer + devDep.
- `vite.config.ts` — `katex` externalisieren.
- `example/index.html` — KaTeX-CSS/JS + Formel-Demo.
- `README.md` — M4-Features dokumentieren.

---

## Task 1: Markdown+KaTeX-Renderer (`markdown/`)

**Files:**
- Create: `src/markdown/katex-marked.ts`
- Create: `src/markdown/sanitize.ts`
- Create: `src/markdown/parse.ts`
- Test: `src/markdown/__tests__/parse.test.ts`
- Modify: `package.json` (deps), `vite.config.ts` (external)

**Interfaces:**
- Consumes: nichts aus dem Projekt (nur `marked`, optional `katex`).
- Produces:
  - `markdownToHtml(text: string, opts?: RenderOptions): string`
  - `interface RenderOptions { singleLineBreaks?: boolean; previewRender?: (text: string) => string; }`
  - `addAnchorTargetBlank(html: string): string`

- [ ] **Step 1: Dependencies installieren**

```bash
npm install marked@^18.0.0
npm install --save-dev katex@^0.18.0 @types/katex@^0.16.0
```

Dann in `package.json` KaTeX als **optionale** Peer-Dep ergänzen (manuell, da `npm` das nicht automatisch setzt) — Block hinzufügen bzw. erweitern:

```json
"peerDependencies": {
  "katex": "^0.18.0"
},
"peerDependenciesMeta": {
  "katex": { "optional": true }
}
```

(Die bestehenden CM6/Lezer-`peerDependencies` bleiben; `katex` wird ergänzt. `lucide` bleibt wie gehabt. `marked` steht unter `dependencies`.)

- [ ] **Step 2: `vite.config.ts` — KaTeX externalisieren**

In `build.rollupOptions.external` das Regex erweitern, damit KaTeX (optional peer) nicht gebündelt wird:

```ts
external: /^(@(codemirror|lezer)\/|katex($|\/))/,
```

- [ ] **Step 3: `sanitize.ts` schreiben**

```ts
/**
 * Ergänzt bei allen <a>-Tags ohne target ein target="_blank" plus
 * rel="noopener noreferrer". Minimales Sanitizing für die Preview — kein
 * DOMPurify (bewusste Scope-Grenze, siehe Design §3.4).
 */
export function addAnchorTargetBlank(html: string): string {
  return html.replace(/<a\b(?![^>]*\btarget=)([^>]*)>/gi, '<a target="_blank" rel="noopener noreferrer"$1>');
}
```

- [ ] **Step 4: `katex-marked.ts` schreiben** (defensiver KaTeX-Load + zwei Extensions)

```ts
import type { MarkedExtension, TokenizerAndRendererExtension } from 'marked';

/**
 * KaTeX defensiv auflösen: KaTeX ist eine OPTIONALE Peer-Dependency. Fehlt das
 * Paket, bleibt `katex` null und die Renderer geben den Rohtext zurück
 * (graceful degradation, Design §3.3). Der Import ist bewusst dynamisch/optional.
 */
type KatexRender = (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) => string;
let katexRender: KatexRender | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = (await import('katex')) as { default?: { renderToString: KatexRender }; renderToString?: KatexRender };
  katexRender = mod.default?.renderToString ?? mod.renderToString ?? null;
} catch {
  katexRender = null;
}

/** Rendert eine Formel; ohne KaTeX Rohtext (mit Delimitern) zurück. */
function render(expr: string, displayMode: boolean, raw: string): string {
  if (!katexRender) return escapeHtml(raw);
  return katexRender(expr, { displayMode, throwOnError: false });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    if (!match) return undefined;
    return { type: 'blockMath', raw: match[0], text: match[1].trim() };
  },
  renderer(token) {
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
    if (!match) return undefined;
    return { type: 'inlineMath', raw: match[0], text: match[1] };
  },
  renderer(token) {
    return render(token.text, false, token.raw);
  },
};

/** marked-Extension-Bündel für $$-Block- und $-Inline-Math. */
export const katexMarkedExtension: MarkedExtension = {
  extensions: [blockMath, inlineMath],
};

/** Ob KaTeX verfügbar ist (für Tests/Diagnose). */
export function isKatexAvailable(): boolean {
  return katexRender !== null;
}
```

> **Hinweis für den Implementierer:** Top-level `await import` ist in einem ESM-Modul (`"type": "module"`) zulässig und wird von Vite/Vitest unterstützt. Falls `await` auf Modulebene im Ziel-Setup Probleme macht, alternativ das Auflösen in eine `ensureKatex()`-Funktion ziehen, die beim ersten `markdownToHtml`-Aufruf lazy lädt und cached. Der Test in Step 6 deckt beide Varianten ab.

- [ ] **Step 5: `parse.ts` schreiben**

```ts
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
```

- [ ] **Step 6: Tests schreiben** (`src/markdown/__tests__/parse.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../parse';
import { addAnchorTargetBlank } from '../sanitize';
import { isKatexAvailable } from '../katex-marked';

describe('markdownToHtml — Markdown', () => {
  it('rendert einfaches Markdown zu HTML', () => {
    const html = markdownToHtml('# Titel\n\nText **fett**.');
    expect(html).toContain('<h1>Titel</h1>');
    expect(html).toContain('<strong>fett</strong>');
  });

  it('previewRender ersetzt den eingebauten Renderer komplett', () => {
    const html = markdownToHtml('# egal', { previewRender: () => '<p>CUSTOM</p>' });
    expect(html).toBe('<p>CUSTOM</p>');
  });
});

describe('markdownToHtml — KaTeX', () => {
  // KaTeX ist devDep → im Test verfügbar; falls nicht, Rohtext-Fallback prüfen.
  it('rendert eine Block-Formel $$…$$', () => {
    const html = markdownToHtml('$$\nE = mc^2\n$$');
    if (isKatexAvailable()) {
      expect(html).toContain('katex');
    } else {
      expect(html).toContain('E = mc^2');
    }
  });

  it('rendert eine align-Umgebung innerhalb $$', () => {
    const html = markdownToHtml('$$\n\\begin{align} a &= b \\\\ c &= d \\end{align}\n$$');
    if (isKatexAvailable()) expect(html).toContain('katex');
  });

  it('rendert eine Inline-Formel $…$', () => {
    const html = markdownToHtml('Es gilt $x_5$ hier.');
    if (isKatexAvailable()) expect(html).toContain('katex');
    else expect(html).toContain('x_5');
  });

  it('Kein-Leerzeichen-Regel: "$5 und $10" bleibt Text', () => {
    const html = markdownToHtml('Das kostet $5 und jenes $10.');
    expect(html).not.toContain('class="katex"');
    expect(html).toContain('$5 und jenes $10');
  });

  it('kaputte Formel crasht nicht (throwOnError:false)', () => {
    expect(() => markdownToHtml('$\\frac{1}{$')).not.toThrow();
  });
});

describe('addAnchorTargetBlank', () => {
  it('ergänzt target=_blank + rel bei Links ohne target', () => {
    expect(addAnchorTargetBlank('<a href="x">y</a>')).toBe(
      '<a target="_blank" rel="noopener noreferrer" href="x">y</a>',
    );
  });
  it('lässt Links mit vorhandenem target unangetastet', () => {
    const html = '<a target="_self" href="x">y</a>';
    expect(addAnchorTargetBlank(html)).toBe(html);
  });
});
```

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run src/markdown/__tests__/parse.test.ts`
Expected: PASS (alle). Bei rotem Lauf zuerst die Kein-Leerzeichen-Regex und den KaTeX-Load prüfen.

- [ ] **Step 8: Typecheck + Lint**

Run: `npm run typecheck && npm run lint`
Expected: sauber. (`@types/katex` liefert die Typen; die `try/catch`-Auflösung braucht evtl. eine `eslint-disable`-Zeile wie im Code gezeigt.)

- [ ] **Step 9: Commit**

```bash
git add src/markdown package.json package-lock.json vite.config.ts
git commit -m "feat(markdown): Markdown+KaTeX-Renderer mit graceful degradation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Side-by-Side-Panel (`ui/preview.ts`)

**Files:**
- Create: `src/ui/preview.ts`
- Create: `src/ui/preview.css`
- Test: `src/ui/__tests__/preview.test.ts`

**Interfaces:**
- Consumes: `markdownToHtml` / `RenderOptions` aus `markdown/parse.ts`; `EditorView` (`@codemirror/view`), `EditorState` (`@codemirror/state`).
- Produces:
  - `createSideBySide(view: EditorView, opts: SideBySideOptions): SideBySide`
  - `interface SideBySide { dom: HTMLElement; toggle(): void; isActive(): boolean; update(state: EditorState): void; destroy(): void; }`
  - `interface SideBySideOptions { render: (text: string) => string; previewClass?: string | string[]; syncScroll?: boolean; }`

- [ ] **Step 1: Failing-Test schreiben** (`src/ui/__tests__/preview.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createSideBySide } from '../preview';

function viewWith(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({ state: EditorState.create({ doc }), parent });
}

describe('createSideBySide', () => {
  it('ist initial inaktiv und rendert erst bei toggle()', () => {
    const view = viewWith('# Hallo');
    const panel = createSideBySide(view, { render: (t) => `<rendered>${t}</rendered>` });
    expect(panel.isActive()).toBe(false);
    panel.toggle();
    expect(panel.isActive()).toBe(true);
    expect(panel.dom.innerHTML).toContain('# Hallo');
    view.destroy();
  });

  it('update() re-rendert nur bei aktivem Panel', () => {
    const view = viewWith('a');
    const panel = createSideBySide(view, { render: (t) => `R:${t}` });
    panel.update(EditorState.create({ doc: 'b' })); // inaktiv → No-op
    expect(panel.dom.innerHTML).toBe('');
    panel.toggle();
    panel.update(EditorState.create({ doc: 'c' }));
    expect(panel.dom.innerHTML).toBe('R:c');
    view.destroy();
  });

  it('previewClass wird auf das Panel gesetzt', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, previewClass: ['prose', 'foo'] });
    expect(panel.dom.classList.contains('prose')).toBe(true);
    expect(panel.dom.classList.contains('foo')).toBe(true);
    view.destroy();
  });

  it('destroy() entfernt das Panel aus dem DOM', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t });
    panel.toggle();
    panel.destroy();
    expect(panel.dom.isConnected).toBe(false);
    view.destroy();
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `npx vitest run src/ui/__tests__/preview.test.ts`
Expected: FAIL ("createSideBySide is not a function").

- [ ] **Step 3: `preview.ts` implementieren**

```ts
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
```

- [ ] **Step 4: `preview.css` schreiben**

```css
/* Side-by-Side: Container-Klasse legt Editor + Panel nebeneinander. */
.supamde-container.supamde-sided .cm-editor {
  width: 50%;
}
.supamde-preview-side {
  width: 50%;
  overflow-y: auto;
  padding: 0.5rem 1rem;
  border-left: 1px solid var(--supamde-border, #ddd);
  box-sizing: border-box;
}
.supamde-container.supamde-sided {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}
/* Der Editor + Panel liegen in einer Flex-Zeile; Toolbar/Statusbar bleiben
   volle Breite darüber/darunter (in index.ts außerhalb der Flex-Zeile). */
```

> **Hinweis:** Ob Editor und Panel eine eigene Flex-Zeile *innerhalb* des Containers brauchen (damit Toolbar/Statusbar volle Breite behalten), entscheidet sich an der DOM-Struktur aus Task 5. Falls Toolbar/Statusbar mit in die Flexrow geraten, in Task 5 einen `supamde-editor-row`-Wrapper um `view.dom` + Panel einführen und diese CSS-Regel darauf umschreiben. Der Test in Task 5 (Step-Layout) deckt das ab.

- [ ] **Step 5: Test laufen → PASS**

Run: `npx vitest run src/ui/__tests__/preview.test.ts`
Expected: PASS (alle 4).

- [ ] **Step 6: Typecheck + Lint + Commit**

```bash
npm run typecheck && npm run lint
git add src/ui/preview.ts src/ui/preview.css src/ui/__tests__/preview.test.ts
git commit -m "feat(ui): Side-by-Side-Vorschau-Panel mit Live-Update und Scroll-Sync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Fullscreen (`ui/fullscreen.ts`)

**Files:**
- Create: `src/ui/fullscreen.ts`
- Create: `src/ui/fullscreen.css`
- Test: `src/ui/__tests__/fullscreen.test.ts`

**Interfaces:**
- Consumes: nichts aus dem Projekt (nur DOM).
- Produces:
  - `createFullscreen(container: HTMLElement, opts?: FullscreenOptions): Fullscreen`
  - `interface Fullscreen { toggle(): void; isActive(): boolean; destroy(): void; }`
  - `interface FullscreenOptions { onToggleFullScreen?: (active: boolean) => void; }`

- [ ] **Step 1: Failing-Test schreiben** (`src/ui/__tests__/fullscreen.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest';
import { createFullscreen } from '../fullscreen';

function container(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'supamde-container';
  document.body.appendChild(el);
  return el;
}

describe('createFullscreen', () => {
  it('toggelt die Klasse supamde-fullscreen und isActive()', () => {
    const el = container();
    const fs = createFullscreen(el);
    expect(fs.isActive()).toBe(false);
    fs.toggle();
    expect(fs.isActive()).toBe(true);
    expect(el.classList.contains('supamde-fullscreen')).toBe(true);
    fs.toggle();
    expect(el.classList.contains('supamde-fullscreen')).toBe(false);
    fs.destroy();
  });

  it('sperrt/entsperrt body-overflow', () => {
    const el = container();
    document.body.style.overflow = 'auto';
    const fs = createFullscreen(el);
    fs.toggle();
    expect(document.body.style.overflow).toBe('hidden');
    fs.toggle();
    expect(document.body.style.overflow).toBe('auto');
    fs.destroy();
  });

  it('ruft onToggleFullScreen mit dem neuen Zustand', () => {
    const el = container();
    const cb = vi.fn();
    const fs = createFullscreen(el, { onToggleFullScreen: cb });
    fs.toggle();
    expect(cb).toHaveBeenCalledWith(true);
    fs.toggle();
    expect(cb).toHaveBeenCalledWith(false);
    fs.destroy();
  });

  it('Escape verlässt Fullscreen', () => {
    const el = container();
    const fs = createFullscreen(el);
    fs.toggle();
    expect(fs.isActive()).toBe(true);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fs.isActive()).toBe(false);
    fs.destroy();
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: FAIL ("createFullscreen is not a function").

- [ ] **Step 3: `fullscreen.ts` implementieren**

```ts
export interface FullscreenOptions {
  onToggleFullScreen?: (active: boolean) => void;
}

export interface Fullscreen {
  toggle(): void;
  isActive(): boolean;
  destroy(): void;
}

/**
 * Fullscreen-Toggle: reines CSS über die Klasse `supamde-fullscreen` auf dem
 * Container. Sperrt zusätzlich body-Scroll und lässt Escape den Modus
 * verlassen. Unabhängig von Side-by-Side (keine Zwangskopplung).
 */
export function createFullscreen(container: HTMLElement, opts: FullscreenOptions = {}): Fullscreen {
  let active = false;
  let savedOverflow = '';

  const set = (next: boolean): void => {
    if (next === active) return;
    active = next;
    container.classList.toggle('supamde-fullscreen', active);
    if (active) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = savedOverflow;
    }
    opts.onToggleFullScreen?.(active);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && active) set(false);
  };
  container.addEventListener('keydown', onKeydown);

  return {
    toggle: () => set(!active),
    isActive: () => active,
    destroy: () => {
      container.removeEventListener('keydown', onKeydown);
      if (active) set(false);
    },
  };
}
```

- [ ] **Step 4: `fullscreen.css` schreiben**

```css
.supamde-container.supamde-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--supamde-bg, #fff);
  max-width: none;
}
```

- [ ] **Step 5: Test laufen → PASS**

Run: `npx vitest run src/ui/__tests__/fullscreen.test.ts`
Expected: PASS (alle 4).

- [ ] **Step 6: Typecheck + Lint + Commit**

```bash
npm run typecheck && npm run lint
git add src/ui/fullscreen.ts src/ui/fullscreen.css src/ui/__tests__/fullscreen.test.ts
git commit -m "feat(ui): Fullscreen-Toggle (CSS, body-Scroll-Sperre, Escape)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Toolbar-Union & neue Icons

**Files:**
- Modify: `src/ui/actions.ts` (ToolbarAction → Union; `side-by-side`/`fullscreen`)
- Modify: `src/ui/toolbar.ts` (`buildItem`/`update` nach `kind` verzweigen)
- Modify: `src/ui/toolbar-config.ts` (`DEFAULT_TOOLBAR` ergänzen)
- Modify: `src/ui/icons.ts` (`side-by-side`, `fullscreen`)
- Test: `src/ui/__tests__/actions.test.ts` (erweitern), `src/ui/__tests__/toolbar.test.ts` (erweitern)

**Interfaces:**
- Consumes: `SupaMDE`-Instanz-Methoden `toggleSideBySide()`, `toggleFullScreen()`, `isSideBySideActive()`, `isFullscreenActive()` (in Task 5 definiert).
- Produces:
  - `type ToolbarAction = { kind: 'command'; command: SupaCommand; query?: (s: EditorState) => boolean; icon: string; title: string; shortcut?: Shortcut } | { kind: 'view'; run: (editor: SupaLike) => void; active?: (editor: SupaLike) => boolean; icon: string; title: string; shortcut?: Shortcut }`
  - `interface SupaLike { toggleSideBySide(): void; toggleFullScreen(): void; isSideBySideActive(): boolean; isFullscreenActive(): boolean; }` (strukturelles Minimal-Interface, damit `actions.ts` nicht zirkulär `index.ts` importiert)

> **Wichtig:** `actions.ts` darf `SupaMDE` aus `index.ts` NICHT importieren (Zyklus: `index.ts` → `toolbar.ts` → `actions.ts`). Deshalb ein strukturelles `SupaLike`-Interface in `actions.ts` definieren und die `SupaMDE`-Instanz strukturell durchreichen.

- [ ] **Step 1: Failing-Test schreiben** — `actions.ts`-Erweiterung (in `src/ui/__tests__/actions.test.ts` ergänzen)

Falls die Datei noch nicht existiert bzw. um diese Fälle erweitern:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getAction } from '../actions';

describe('view-Aktionen (side-by-side, fullscreen)', () => {
  it('side-by-side ist eine view-Aktion und ruft toggleSideBySide', () => {
    const action = getAction('side-by-side');
    expect(action?.kind).toBe('view');
    const editor = { toggleSideBySide: vi.fn(), toggleFullScreen: vi.fn(), isSideBySideActive: () => false, isFullscreenActive: () => false };
    if (action?.kind === 'view') action.run(editor);
    expect(editor.toggleSideBySide).toHaveBeenCalled();
  });

  it('fullscreen.active spiegelt isFullscreenActive', () => {
    const action = getAction('fullscreen');
    const editor = { toggleSideBySide: vi.fn(), toggleFullScreen: vi.fn(), isSideBySideActive: () => false, isFullscreenActive: () => true };
    if (action?.kind === 'view') expect(action.active?.(editor)).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `npx vitest run src/ui/__tests__/actions.test.ts`
Expected: FAIL (`action.kind` undefined / `getAction('side-by-side')` undefined).

- [ ] **Step 3: `actions.ts` zur Union umbauen**

Den `ToolbarAction`-Typ ersetzen und bestehende Built-ins auf `kind: 'command'` heben. Kopf der Datei anpassen:

```ts
import type { EditorState } from '@codemirror/state';
import type { SupaCommand } from '../commands/types';
// … bestehende command/query-Imports bleiben …

/** Plattformabhängiges Anzeige-Kürzel (unverändert). */
type Shortcut = string | { default: string; mac: string };

/** Strukturelles Minimal-Interface der SupaMDE-Instanz für view-Aktionen. */
export interface SupaLike {
  toggleSideBySide(): void;
  toggleFullScreen(): void;
  isSideBySideActive(): boolean;
  isFullscreenActive(): boolean;
}

/** Ein Built-in-Toolbar-Eintrag: entweder CM6-Command oder Instanz-Aktion. */
export type ToolbarAction =
  | {
      kind: 'command';
      command: SupaCommand;
      query?: (state: EditorState) => boolean;
      icon: string;
      title: string;
      shortcut?: Shortcut;
    }
  | {
      kind: 'view';
      run: (editor: SupaLike) => void;
      active?: (editor: SupaLike) => boolean;
      icon: string;
      title: string;
      shortcut?: Shortcut;
    };
```

Jeden bestehenden Eintrag in `BUILTIN_ACTIONS` um `kind: 'command'` ergänzen. Beispiel (analog für alle):

```ts
bold: { kind: 'command', command: bold, query: isBold, icon: 'bold', title: 'Fett', shortcut: 'Mod-b' },
// … usw. für alle vorhandenen Einträge …
```

Am Ende der Registry die zwei neuen `view`-Aktionen ergänzen:

```ts
  'side-by-side': {
    kind: 'view',
    run: (editor) => editor.toggleSideBySide(),
    active: (editor) => editor.isSideBySideActive(),
    icon: 'side-by-side',
    title: 'Nebeneinander-Vorschau',
    shortcut: 'F9',
  },
  fullscreen: {
    kind: 'view',
    run: (editor) => editor.toggleFullScreen(),
    active: (editor) => editor.isFullscreenActive(),
    icon: 'fullscreen',
    title: 'Vollbild',
    shortcut: 'F11',
  },
```

- [ ] **Step 4: `icons.ts` ergänzen**

Imports + Mapping erweitern (Lucide hat `Columns2` und `Fullscreen`):

```ts
import {
  // … bestehende …
  Columns2,
  Fullscreen,
  type IconNode,
} from 'lucide';

const ICONS: Record<string, IconNode> = {
  // … bestehende …
  'side-by-side': Columns2,
  fullscreen: Fullscreen,
};
```

- [ ] **Step 5: `toolbar.ts` — `buildItem` und `update` nach `kind` verzweigen**

In `buildItem` den `item.kind === 'builtin'`-Zweig anpassen: statt `action.command(view)` nach `action.kind` unterscheiden. Die Toolbar bekommt `editor: unknown` schon durchgereicht — für `view`-Aktionen als `SupaLike` behandeln.

```ts
if (item.kind === 'builtin') {
  const { action, name } = item;
  const label = action.shortcut
    ? `${action.title} (${formatShortcut(action.shortcut)})`
    : action.title;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.dataset.action = name;
  btn.appendChild(renderIcon(action.icon));
  if (action.kind === 'command') {
    const cmd = action.command;
    btn.addEventListener('click', () => {
      view.focus();
      cmd(view);
    });
    if (action.query) {
      activeButtons.push({ el: btn, query: (state) => action.query!(state) });
    }
  } else {
    const run = action.run;
    btn.addEventListener('click', () => run(editor as SupaLike));
    if (action.active) {
      viewButtons.push({ el: btn, active: action.active });
    }
  }
}
```

Dafür oben eine zweite Sammelliste + erweitertes `update`:

```ts
interface ViewButton {
  el: HTMLButtonElement;
  active: (editor: SupaLike) => boolean;
}
// … in createToolbar:
const viewButtons: ViewButton[] = [];
// … an buildItem durchreichen …

const update = (state: EditorState): void => {
  for (const { el, query } of activeButtons) {
    el.classList.toggle('active', query(state));
  }
  for (const { el, active } of viewButtons) {
    el.classList.toggle('active', active(editor as SupaLike));
  }
};
```

(Import `import type { SupaLike } from './actions';` ergänzen. `buildItem`-Signatur um `viewButtons` erweitern.)

- [ ] **Step 6: `toolbar-config.ts` — DEFAULT_TOOLBAR ergänzen**

Am Ende der `DEFAULT_TOOLBAR`-Liste (nach `'redo'`) ergänzen:

```ts
  'undo',
  'redo',
  '|',
  'side-by-side',
  'fullscreen',
];
```

- [ ] **Step 7: bestehende Toolbar-Tests anpassen + neue prüfen**

Falls bestehende Tests auf `action.command`/`action.query` ohne `kind` zugreifen, auf die Union anpassen (z.B. `if (action.kind === 'command')`). Dann:

Run: `npx vitest run src/ui/__tests__/actions.test.ts src/ui/__tests__/toolbar.test.ts src/ui/__tests__/toolbar-config.test.ts src/ui/__tests__/icons.test.ts`
Expected: PASS (alle). Bei Fehlern in Altbestand-Tests: Zugriffe auf `ToolbarAction` an die Union anpassen.

- [ ] **Step 8: Volltest + Typecheck + Lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: alles grün.

- [ ] **Step 9: Commit**

```bash
git add src/ui/actions.ts src/ui/toolbar.ts src/ui/toolbar-config.ts src/ui/icons.ts src/ui/__tests__
git commit -m "feat(ui): Toolbar-Action als Union (command|view); side-by-side/fullscreen-Buttons

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Fassade, Optionen & Verdrahtung (`index.ts`, `options.ts`)

**Files:**
- Modify: `src/options.ts` (neue Optionen + Auflösung)
- Modify: `src/index.ts` (Panel + Fullscreen verdrahten, Sink erweitern, Fassaden-Methoden, CSS-Imports)
- Test: `src/__tests__/index.test.ts` (erweitern), `src/__tests__/options.test.ts` (erweitern)

**Interfaces:**
- Consumes: `createSideBySide`/`SideBySide` (Task 2), `createFullscreen`/`Fullscreen` (Task 3), `markdownToHtml`/`RenderOptions` (Task 1).
- Produces (öffentliche SupaMDE-Methoden): `toggleSideBySide()`, `isSideBySideActive()`, `toggleFullScreen()`, `isFullscreenActive()`, `markdown(text: string): string`.

- [ ] **Step 1: Failing-Test schreiben** (`src/__tests__/index.test.ts` ergänzen)

```ts
import { describe, it, expect } from 'vitest';
import { SupaMDE } from '../index';

function makeTextarea(value = ''): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.value = value;
  document.body.appendChild(ta);
  return ta;
}

describe('SupaMDE — Preview & Fullscreen', () => {
  it('markdown() rendert Markdown+Formel zu HTML', () => {
    const editor = new SupaMDE({ element: makeTextarea('# Hi') });
    expect(editor.markdown('# Hi')).toContain('<h1>Hi</h1>');
    editor.toTextArea();
  });

  it('toggleSideBySide schaltet isSideBySideActive und setzt Container-Klasse', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    expect(editor.isSideBySideActive()).toBe(false);
    editor.toggleSideBySide();
    expect(editor.isSideBySideActive()).toBe(true);
    editor.toTextArea();
  });

  it('toggleFullScreen schaltet isFullscreenActive', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(false);
    editor.toTextArea();
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: FAIL ("editor.markdown is not a function" o.ä.).

- [ ] **Step 3: `options.ts` erweitern**

`SupaMDEOptions` um die neuen Felder ergänzen:

```ts
  /** Ersetzt den eingebauten Markdown-Renderer der Vorschau komplett. */
  previewRender?: (text: string) => string;
  /** Zusätzliche CSS-Klasse(n) aufs Vorschau-Panel. */
  previewClass?: string | string[];
  /** marked-Feintuning für die Vorschau. */
  renderingConfig?: { singleLineBreaks?: boolean };
  /** Bidirektionaler Scroll-Sync im Side-by-Side (Default true). */
  syncSideBySidePreviewScroll?: boolean;
  /** Callback bei Fullscreen-Wechsel. */
  onToggleFullScreen?: (active: boolean) => void;
```

`ResolvedOptions` + `resolveOptions` NICHT zwingend erweitern — diese Optionen werden in `index.ts` direkt aus `options` gelesen und an die Module durchgereicht (sie sind keine CM6-Extensions). `resolveOptions` bleibt unverändert. (In `options.test.ts` nur prüfen, dass die Typen existieren/optional sind — kein neuer Default nötig.)

- [ ] **Step 4: `index.ts` verdrahten**

CSS-Imports oben ergänzen:

```ts
import './ui/toolbar.css';
import './ui/statusbar.css';
import './ui/preview.css';
import './ui/fullscreen.css';
```

Weitere Imports:

```ts
import { createSideBySide, type SideBySide } from './ui/preview';
import { createFullscreen, type Fullscreen } from './ui/fullscreen';
import { markdownToHtml, type RenderOptions } from './markdown/parse';
```

Felder + Konstruktor-Verdrahtung. Der bestehende Sink wird um `preview?.update` erweitert, und die DOM-Struktur bekommt eine Editor-Zeile (`view.dom` + Panel) innerhalb des Containers, damit Toolbar/Statusbar volle Breite behalten:

```ts
  private readonly preview: SideBySide | null;
  private readonly fullscreen: Fullscreen;
  private readonly editorRow: HTMLElement;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;

    const sink = {
      onUpdate: (u: { state: EditorState; docChanged: boolean; selectionSet: boolean }): void => {
        this.toolbar?.update(u.state);
        this.statusbar?.update(u.state, { docChanged: u.docChanged, selectionSet: u.selectionSet });
        this.preview?.update(u.state);
      },
    };

    this.handle = editorFromTextArea(options, sink);
    this.codemirror = this.handle.view;

    this.toolbar = createToolbar(this.codemirror, options.toolbar, this);
    this.statusbar = createStatusbar(options.status);

    const renderOpts: RenderOptions = {
      singleLineBreaks: options.renderingConfig?.singleLineBreaks,
      previewRender: options.previewRender,
    };
    this.preview = createSideBySide(this.codemirror, {
      render: (text) => markdownToHtml(text, renderOpts),
      previewClass: options.previewClass,
      syncScroll: options.syncSideBySidePreviewScroll,
    });

    this.container = document.createElement('div');
    this.container.className = 'supamde-container';
    const viewDom = this.codemirror.dom;
    viewDom.parentNode?.insertBefore(this.container, viewDom);
    if (this.toolbar) this.container.appendChild(this.toolbar.dom);

    // Editor-Zeile: Editor + Vorschau-Panel nebeneinander (Flex via CSS).
    this.editorRow = document.createElement('div');
    this.editorRow.className = 'supamde-editor-row';
    this.editorRow.appendChild(viewDom);
    this.editorRow.appendChild(this.preview.dom);
    this.container.appendChild(this.editorRow);

    if (this.statusbar) this.container.appendChild(this.statusbar.dom);

    this.fullscreen = createFullscreen(this.container, {
      onToggleFullScreen: options.onToggleFullScreen,
    });

    const state = this.codemirror.state;
    this.toolbar?.update(state);
    this.statusbar?.update(state, { docChanged: true, selectionSet: true });
  }
```

Neue öffentliche Methoden:

```ts
  /** Rendert Markdown (inkl. LaTeX) zu HTML. */
  markdown(text: string): string {
    return markdownToHtml(text, {
      singleLineBreaks: this.options.renderingConfig?.singleLineBreaks,
      previewRender: this.options.previewRender,
    });
  }

  toggleSideBySide(): void {
    this.preview?.toggle();
    this.container.classList.toggle('supamde-sided', this.isSideBySideActive());
    this.toolbar?.update(this.codemirror.state);
  }
  isSideBySideActive(): boolean {
    return this.preview?.isActive() ?? false;
  }

  toggleFullScreen(): void {
    this.fullscreen.toggle();
    this.toolbar?.update(this.codemirror.state);
  }
  isFullscreenActive(): boolean {
    return this.fullscreen.isActive();
  }
```

`toTextArea()` um Aufräumen erweitern:

```ts
  toTextArea(): HTMLTextAreaElement {
    this.toolbar?.destroy();
    this.statusbar?.destroy();
    this.preview?.destroy();
    this.fullscreen.destroy();
    const textarea = this.handle.toTextArea();
    this.container.remove();
    return textarea;
  }
```

> **CSS-Nachzug:** In `preview.css` die Flex-Regel auf `.supamde-editor-row` umstellen (die Editor-Zeile ist der Flex-Container, nicht der ganze Container):
> ```css
> .supamde-editor-row { display: flex; flex-direction: row; align-items: stretch; }
> .supamde-container.supamde-sided .supamde-editor-row .cm-editor { width: 50%; }
> ```
> Und die frühere `.supamde-container.supamde-sided { display:flex }`-Regel aus Task 2 entfernen.

- [ ] **Step 5: `preview.css` an `.supamde-editor-row` anpassen** (siehe Hinweis oben)

- [ ] **Step 6: Test laufen → PASS**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: PASS (alle 3).

- [ ] **Step 7: Volltest + Typecheck + Lint + Build**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: alles grün; `dist/supamde.mjs` entsteht, KaTeX nicht gebündelt.

- [ ] **Step 8: Commit**

```bash
git add src/index.ts src/options.ts src/__tests__ src/ui/preview.css
git commit -m "feat: Preview/Fullscreen in Fassade verdrahten; markdown()-Methode und Optionen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Example-Demo (`example/index.html`)

**Files:**
- Modify: `example/index.html`

**Interfaces:**
- Consumes: die öffentliche SupaMDE-API + KaTeX-CSS von CDN (nur im Example).

- [ ] **Step 1: `example/index.html` erweitern**

Im `<head>` KaTeX-CSS + JS ergänzen (KaTeX ist optionale Peer-Dep; das Example stellt sie bereit). Version an die installierte `katex`-Version (0.18.x) anpassen:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.0/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.0/dist/katex.min.js" crossorigin="anonymous"></script>
```

> **Hinweis Modul-Auflösung:** Der Renderer löst KaTeX über `import('katex')` auf. Im Example-Setup (Vite dev-server) muss `katex` als Bare-Import auflösbar sein — da `katex` als devDependency installiert ist, funktioniert das im `vite`-dev-Server. Das CDN-CSS liefert die Fonts/Styles fürs Rendering. Falls das Example ohne Bundler (pures HTML) läuft, stattdessen `katex.min.js` global laden und im Renderer `globalThis.katex` als Fallback berücksichtigen — dieser Fallback ist optional und nur nötig, wenn das Example bundlerlos betrieben wird.

Den Textarea-Startinhalt um Formeln erweitern, damit die Vorschau etwas zeigt:

```html
<textarea id="editor">
# SupaMDE mit LaTeX

Inline-Formel: $E = mc^2$ mitten im Text.

Block-Formel:

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

Ausgerichtete Gleichungen:

$$
\begin{align}
a &= b + c \\
x &= y - z
\end{align}
$$

Ein Preis wie $5 und $10 bleibt Text.
</textarea>
```

- [ ] **Step 2: Manuell verifizieren**

Run: `npm run dev` und im Browser öffnen. Prüfen:
- Side-by-Side-Button zeigt die Vorschau rechts, Formeln sind gesetzt (inline, block, align).
- Scrollen synchronisiert Editor ↔ Vorschau.
- Fullscreen-Button füllt den Viewport; Escape verlässt ihn.
- „$5 und $10" bleibt als Text stehen.

- [ ] **Step 3: Commit**

```bash
git add example/index.html
git commit -m "docs(example): LaTeX-Demo mit Side-by-Side-Vorschau

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: README aktualisieren

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Status-Zeile & Peer-Dependency-Abschnitt aktualisieren**

Die Status-Zeile (aktuell „M3 — Toolbar & Statusbar") auf M4 heben:

```markdown
> **Status:** In Entwicklung. Aktueller Meilenstein: **M4 — LaTeX-Live-Vorschau
> & Fullscreen** (Side-by-Side-Vorschau mit Markdown+LaTeX-Rendering, Fullscreen).
> Autosave und Bild-Upload folgen in M5.
```

Im Peer-Dependency-Abschnitt KaTeX als **optionale** Peer-Dep ergänzen:

```markdown
### KaTeX (optional, für Formeln in der Vorschau)

Die Live-Vorschau rendert LaTeX-Formeln (`$…$`, `$$…$$`, `\begin{align}` in
`$$`) über **KaTeX**. KaTeX ist eine **optionale** Peer-Dependency — ist es
nicht installiert, zeigt die Vorschau reines Markdown und lässt Formeln als
Text stehen. Zum Aktivieren:

```bash
npm install katex
```

Zusätzlich das KaTeX-CSS (inkl. Schriften) in der Host-Seite einbinden, z.B.:

```html
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">
```
```

- [ ] **Step 2: Neue Optionen dokumentieren**

Unter der bestehenden Optionen-Tabelle einen M4-Block ergänzen:

```markdown
### Optionen (Preview/Fullscreen, M4)

| Option                         | Typ                               | Default | Bedeutung                                             |
| ------------------------------ | --------------------------------- | ------- | ----------------------------------------------------- |
| `previewRender`                | `(text) => string`                | —       | Ersetzt den eingebauten Markdown-Renderer komplett.   |
| `previewClass`                 | `string \| string[]`              | —       | Zusätzliche CSS-Klassen aufs Vorschau-Panel.          |
| `renderingConfig.singleLineBreaks` | `boolean`                     | `true`  | Einfacher Zeilenumbruch → `<br>`.                     |
| `syncSideBySidePreviewScroll`  | `boolean`                         | `true`  | Bidirektionaler Scroll-Sync im Side-by-Side.          |
| `onToggleFullScreen`           | `(active) => void`                | —       | Callback bei Fullscreen-Wechsel.                      |

Neue Methoden: `toggleSideBySide()`, `isSideBySideActive()`, `toggleFullScreen()`,
`isFullscreenActive()`, `markdown(text)`.
```

- [ ] **Step 3: Verifizieren & Commit**

Kurz gegenlesen (Markdown-Tabellen korrekt, Links gültig). Dann:

```bash
git add README.md
git commit -m "docs(readme): M4-Features (LaTeX-Vorschau, Fullscreen, KaTeX-Peer-Dep)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Abschluss-Verifikation (nach allen Tasks)

- [ ] **Volle Suite grün:** `npx vitest run`
- [ ] **Typecheck sauber:** `npm run typecheck`
- [ ] **Lint sauber:** `npm run lint`
- [ ] **Build erfolgreich, KaTeX extern:** `npm run build` — danach prüfen, dass `dist/supamde.mjs` KaTeX **nicht** enthält (z.B. `grep -c "renderToString" dist/supamde.mjs` sollte 0 sein bzw. nur den Import-Aufruf zeigen).
- [ ] **Example manuell:** `npm run dev` — Side-by-Side + Formeln + Fullscreen + Scroll-Sync + „$5"-Fall wie in Task 6 Step 2.
- [ ] **Definition of Done (Spec §10)** erfüllt.

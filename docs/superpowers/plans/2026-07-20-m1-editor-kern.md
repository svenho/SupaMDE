# M1 — Editor-Kern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus dem M0-Skelett einen sichtbaren, live formatierenden CodeMirror-6-Markdown-Editor bauen, der aus einer Textarea initialisiert wird, seinen Wert per `value()`/`getValue()`/`setValue()` les-/setzbar macht und per `toTextArea()` sauber zurückbaut.

**Architecture:** Dünne Fassade (`SupaMDE` in `index.ts`) delegiert an fokussierte Editor-Kern-Module: `options.ts` (Normalisierung), `editor/tokens.ts` (geteilte Style-Tokens), `editor/highlight.ts` + `editor/theme.ts` (Erscheinungsbild, aus Tokens), `editor/value.ts` (headless value-Logik), `editor/extensions.ts` (Optionen→CM6-Extensions), `editor/setup.ts` (`fromTextArea`-Äquivalent + Rückbau). Reine/headless-testbare Logik (Optionen, Tokens, value) ist von der Klasse getrennt. Keine Adapter-Schicht — echte CM6-Idiome.

**Tech Stack:** TypeScript (strict), CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/highlight`), Vite (Library-Mode, ESM+UMD), Vitest (jsdom).

## Global Constraints

- **Node-Engines:** `^20.19.0 || ^22.13.0 || >=24` (aus package.json, nicht ändern).
- **TypeScript bewusst 5.9.x**, nicht 7.x (wegen typescript-eslint) — Version nicht anheben.
- **strict + `noUncheckedIndexedAccess` + `noUnusedLocals`/`noUnusedParameters`** sind an — Code muss sauber durchgehen.
- **Test-Include-Pattern:** `src/**/__tests__/**/*.test.ts` — Tests in `__tests__/`-Ordnern ablegen.
- **Test-Imports:** `import { describe, it, expect } from 'vitest';` explizit (dem Stil aus `src/__tests__/index.test.ts` folgen, obwohl `globals: true` gesetzt ist).
- **CM6-Pakete in `dependencies`** (nicht `devDependencies`, nicht `peerDependencies`) — gebündelter Build. `@codemirror/commands` gehört zu M2, **nicht** installieren.
- **Sprache:** Code-Kommentare und Doku auf Deutsch, mit korrekten Umlauten (bestehender Projektstil).
- **value-Semantik:** `value()`/`getValue()` äquivalent (Getter); `value(x)`/`setValue(x)` äquivalent (Setter, ersetzt gesamten Doc).
- **Doc-Init einmalig** aus Textarea — kein Zwei-Wege-Live-Sync.
- **Spec:** `docs/superpowers/specs/2026-07-20-supamde-m1-editor-kern-design.md` (Akzeptanzkriterien AK-1..AK-13).

---

## File Structure

| Datei | Verantwortung | Status |
|---|---|---|
| `src/options.ts` | `SupaMDEOptions`-Typ (Kern-Set), Defaults, Normalisierung → `ResolvedOptions` | Create |
| `src/editor/tokens.ts` | geteilte Style-Tokens (Farben, Font-Stack) — eine Quelle für Highlight + Theme | Create |
| `src/editor/highlight.ts` | `HighlightStyle` für Kern-Formatierungen (Headings, strong/em/strike, code, quote, link) | Create |
| `src/editor/theme.ts` | `EditorView.theme` — Basis-Erscheinungsbild | Create |
| `src/editor/value.ts` | headless value-Logik (`readValue`/`writeValue`) über einer `EditorView` | Create |
| `src/editor/extensions.ts` | `buildExtensions(resolved)` → CM6-Extension-Liste | Create |
| `src/editor/setup.ts` | `editorFromTextArea(...)` + `EditorHandle` (View + Rückbau) | Create |
| `src/index.ts` | Fassade: Konstruktor ruft setup, delegiert value/getValue/setValue/toTextArea | Modify |
| `example/index.html` | zeigt live formatierenden Editor | Modify |
| `README.md` | Kurz-Doku (Installation, Grundnutzung, M1-Stand) | Create |
| `package.json` | CM6-Pakete in `dependencies` | Modify |

Test-Dateien (je Modul in `__tests__/`):
- `src/__tests__/options.test.ts`
- `src/editor/__tests__/highlight.test.ts`
- `src/editor/__tests__/value.test.ts`
- `src/editor/__tests__/extensions.test.ts`
- `src/editor/__tests__/setup.test.ts`
- `src/__tests__/index.test.ts` (Modify — value-API-Tests ergänzen)

> `tokens.ts` ist eine reine Konstanten-Datei ohne eigene Logik und bekommt keinen eigenen Test — es wird über `highlight.ts`/`theme.ts` mitgeprüft.

---

## Task 1: CM6-Abhängigkeiten installieren

**Files:**
- Modify: `package.json` (dependencies-Block)

**Interfaces:**
- Consumes: nichts
- Produces: Runtime-Verfügbarkeit von `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/highlight` für alle folgenden Tasks.

- [ ] **Step 1: Pakete als dependencies installieren**

```bash
npm install @codemirror/state @codemirror/view @codemirror/language @codemirror/lang-markdown @lezer/highlight
```

- [ ] **Step 2: Prüfen, dass sie in `dependencies` (nicht devDependencies) stehen**

Run: `node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}))"`
Expected: Ausgabe listet die fünf `@codemirror/*` bzw. `@lezer/highlight`-Pakete.

- [ ] **Step 3: Smoke-Import prüfen (Build-Toolchain zieht Pakete)**

Run: `npm run typecheck`
Expected: PASS (keine neuen Fehler; Pakete noch nicht importiert, nur installiert).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(m1): CodeMirror-6-Kernpakete als dependencies"
```

---

## Task 2: Optionen-Normalisierung (`options.ts`)

**Files:**
- Create: `src/options.ts`
- Test: `src/__tests__/options.test.ts`

**Interfaces:**
- Consumes: nichts (reine Logik)
- Produces:
  - `interface SupaMDEOptions { element?: HTMLElement | null; lineWrapping?: boolean; placeholder?: string; autofocus?: boolean; tabSize?: number; indentUnit?: number; initialValue?: string; }`
  - `interface ResolvedOptions { lineWrapping: boolean; placeholder: string | null; autofocus: boolean; tabSize: number; indentUnit: number; }`
  - `function resolveOptions(options: SupaMDEOptions): ResolvedOptions`
  - Defaults: `lineWrapping: true`, `placeholder: null`, `autofocus: false`, `tabSize: 2`, `indentUnit: 2`.

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/__tests__/options.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../options';

describe('resolveOptions', () => {
  it('setzt Defaults bei leeren Optionen', () => {
    const r = resolveOptions({});
    expect(r).toEqual({
      lineWrapping: true,
      placeholder: null,
      autofocus: false,
      tabSize: 2,
      indentUnit: 2,
    });
  });

  it('übernimmt gesetzte User-Werte', () => {
    const r = resolveOptions({
      lineWrapping: false,
      placeholder: 'Tippe hier …',
      autofocus: true,
      tabSize: 4,
      indentUnit: 4,
    });
    expect(r.lineWrapping).toBe(false);
    expect(r.placeholder).toBe('Tippe hier …');
    expect(r.autofocus).toBe(true);
    expect(r.tabSize).toBe(4);
    expect(r.indentUnit).toBe(4);
  });

  it('ignoriert `element` in ResolvedOptions (kein Extension-Belang)', () => {
    const el = document.createElement('textarea');
    const r = resolveOptions({ element: el });
    expect(r).not.toHaveProperty('element');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/__tests__/options.test.ts`
Expected: FAIL mit „Cannot find module '../options'" bzw. „resolveOptions is not a function".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/options.ts`:

```typescript
/** Öffentliche Konfigurationsoptionen für SupaMDE (Kern-Set, M1). */
export interface SupaMDEOptions {
  /** Das Textarea-Element, an das der Editor gebunden wird. */
  element?: HTMLElement | null;
  /** Zeilenumbruch statt horizontalem Scrollen (Default: true). */
  lineWrapping?: boolean;
  /** Platzhaltertext im leeren Editor. */
  placeholder?: string;
  /** Fokussiert den Editor nach Erzeugung (Default: false). */
  autofocus?: boolean;
  /** Tab-Breite in Spalten (Default: 2). */
  tabSize?: number;
  /** Einrücktiefe in Leerzeichen (Default: 2). */
  indentUnit?: number;
  /** Startwert; überschreibt den Textarea-Inhalt, falls gesetzt. */
  initialValue?: string;
}

/** Normalisierte, immer vollständig belegte Optionen für die Extension-Erzeugung. */
export interface ResolvedOptions {
  lineWrapping: boolean;
  placeholder: string | null;
  autofocus: boolean;
  tabSize: number;
  indentUnit: number;
}

/** Füllt fehlende Optionen mit Defaults und liefert eine vollständige Form. */
export function resolveOptions(options: SupaMDEOptions): ResolvedOptions {
  return {
    lineWrapping: options.lineWrapping ?? true,
    placeholder: options.placeholder ?? null,
    autofocus: options.autofocus ?? false,
    tabSize: options.tabSize ?? 2,
    indentUnit: options.indentUnit ?? 2,
  };
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/__tests__/options.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/options.ts src/__tests__/options.test.ts
git commit -m "feat(m1): Optionen-Normalisierung (Kern-Set)"
```

---

## Task 3: Style-Tokens (`editor/tokens.ts`)

**Files:**
- Create: `src/editor/tokens.ts`

**Interfaces:**
- Consumes: nichts (reine Konstanten)
- Produces:
  - `const colors` — geteilte Farbwerte (quote, link, Rahmen).
  - `const fontStack` — der System-Font-Stack.

> **Warum eigene Datei:** Highlight (Task 4) und Theme (Task 5) greifen sonst je hart­kodierte Magic-Values ab (`#6a737d`, `#0366d6`, Font-Stack). Die Spec kündigt für M3/M6 einen Farb-/px-Feinschliff an — mit einer Token-Quelle fasst dieser Feinschliff **eine** Datei an statt zwei. Kein eigener Test (reine Konstanten); über Highlight/Theme mitgeprüft.

- [ ] **Step 1: `src/editor/tokens.ts` schreiben**

```typescript
/**
 * Geteilte Style-Tokens für Highlight (`highlight.ts`) und Theme (`theme.ts`).
 * EINE Quelle für Farben und Font-Stack, damit der Feinschliff in M3/M6 nur hier
 * ansetzt. Exakte Werte sind bewusst vorläufig (easyMDE-Look, keine px-Parität).
 */

/** Kern-Farbwerte des SupaMDE-Basis-Looks. */
export const colors = {
  /** Blockquote-Text (gedämpftes Grau). */
  quote: '#6a737d',
  /** Links (GitHub-Blau). */
  link: '#0366d6',
  /** Container-Rahmen. */
  border: '#ddd',
} as const;

/** System-Font-Stack (kein Web-Font-Load in M1). */
export const fontStack = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS (Datei wird noch nicht importiert; nur Syntax-/Typ-Check).

- [ ] **Step 3: Commit**

```bash
git add src/editor/tokens.ts
git commit -m "feat(m1): geteilte Style-Tokens (Farben, Font-Stack)"
```

---

## Task 4: HighlightStyle (`editor/highlight.ts`)

**Files:**
- Create: `src/editor/highlight.ts`
- Test: `src/editor/__tests__/highlight.test.ts`

**Interfaces:**
- Consumes: `@lezer/highlight` (`tags`), `@codemirror/language` (`HighlightStyle`)
- Produces:
  - `const supaHighlightStyle: HighlightStyle`
  - `const highlightExtension: Extension` (= `syntaxHighlighting(supaHighlightStyle)`)

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/editor/__tests__/highlight.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { HighlightStyle } from '@codemirror/language';
import { supaHighlightStyle, highlightExtension } from '../highlight';

describe('supaHighlightStyle', () => {
  it('ist ein HighlightStyle', () => {
    expect(supaHighlightStyle).toBeInstanceOf(HighlightStyle);
  });

  it('ist als Extension in einem State nutzbar (Style gültig)', () => {
    // Robuster als das Inspizieren von HighlightStyle-Interna (`.specs` ist
    // kein garantiertes öffentliches API): Wenn der Style ungültig wäre,
    // würde EditorState.create() werfen.
    const state = EditorState.create({ doc: '# H', extensions: [highlightExtension] });
    expect(state.doc.toString()).toBe('# H');
  });

  it('stellt eine Extension bereit', () => {
    expect(highlightExtension).toBeDefined();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/editor/__tests__/highlight.test.ts`
Expected: FAIL mit „Cannot find module '../highlight'".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/editor/highlight.ts`:

```typescript
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { colors } from './tokens';

/**
 * Kern-Formatierungen für die easyMDE-„Quasi-WYSIWYG"-Parität: der Markdown-
 * Quelltext bleibt sichtbar, wird aber live formatiert. Farben stammen aus
 * `tokens.ts`; exakte px/Farben sind bewusst NICHT Teil von M1 (Feinschliff
 * folgt in M3/M6, dann nur an der Token-Quelle).
 */
export const supaHighlightStyle: HighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.25em', fontWeight: 'bold' },
  { tag: t.heading4, fontSize: '1.15em', fontWeight: 'bold' },
  { tag: [t.heading5, t.heading6], fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: 'monospace' },
  { tag: t.quote, color: colors.quote, fontStyle: 'italic' },
  { tag: t.link, color: colors.link, textDecoration: 'underline' },
  { tag: t.url, color: colors.link },
]);

/** Fertige Extension: Syntax-Highlighting mit dem SupaMDE-Stil. */
export const highlightExtension: Extension = syntaxHighlighting(supaHighlightStyle);
```

> Hinweis für den Implementierer: Falls eines der `t.*`-Tags im installierten `@lezer/highlight` nicht existiert oder zu breit greift, die betreffende Regel entfernen — die restlichen Tags decken den Look ab. Der Test prüft nur, dass der Style als Extension gültig ist, nicht welche Regeln enthalten sind.

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/editor/__tests__/highlight.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editor/highlight.ts src/editor/__tests__/highlight.test.ts
git commit -m "feat(m1): HighlightStyle für easyMDE-Kern-Formatierungen"
```

---

## Task 5: Basis-Theme (`editor/theme.ts`)

**Files:**
- Create: `src/editor/theme.ts`
- Test: `src/editor/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: `@codemirror/view` (`EditorView`), `tokens.ts` (`colors`, `fontStack`)
- Produces: `const supaTheme: Extension` (Rückgabe von `EditorView.theme(...)`)

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/editor/__tests__/theme.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { supaTheme } from '../theme';

describe('supaTheme', () => {
  it('ist definiert und als Extension nutzbar', () => {
    expect(supaTheme).toBeDefined();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/editor/__tests__/theme.test.ts`
Expected: FAIL mit „Cannot find module '../theme'".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/editor/theme.ts`:

```typescript
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { colors, fontStack } from './tokens';

/**
 * Basis-Erscheinungsbild des SupaMDE-Editors (Container, Font, Padding).
 * Ersetzt das CM5-'easymde'-Theme. Farben/Font stammen aus `tokens.ts`;
 * Feinschliff (Farben/Abstände) folgt in M3/M6, dann nur an der Token-Quelle.
 */
export const supaTheme: Extension = EditorView.theme({
  '&': {
    fontFamily: fontStack,
    fontSize: '16px',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
  },
  '.cm-content': {
    padding: '10px 12px',
    lineHeight: '1.5',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
  },
});
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/editor/__tests__/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/theme.ts src/editor/__tests__/theme.test.ts
git commit -m "feat(m1): Basis-Theme für den Editor-Container"
```

---

## Task 6: value-Logik (`editor/value.ts`)

**Files:**
- Create: `src/editor/value.ts`
- Test: `src/editor/__tests__/value.test.ts`

**Interfaces:**
- Consumes: `@codemirror/view` (`EditorView`)
- Produces:
  - `function readValue(view: EditorView): string` (= `view.state.doc.toString()`)
  - `function writeValue(view: EditorView, val: string): void` (ersetzt gesamten Doc via `dispatch`)

> **Warum eigene Datei:** Die Spec (Abschnitt 3) verlangt, dass die value-Logik „rein/headless testbar" ist. Läge sie in der `SupaMDE`-Klasse, wäre sie nur über den Konstruktor (mit Textarea) testbar. Als freie Funktionen über einer `EditorView` sind sie direkt testbar und in M2 (Commands) wiederverwendbar. `index.ts` (Task 9) delegiert an diese Funktionen.

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/editor/__tests__/value.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { readValue, writeValue } from '../value';

function viewWith(doc: string): EditorView {
  return new EditorView({ doc });
}

describe('readValue / writeValue', () => {
  it('readValue liefert den aktuellen Doc-Inhalt', () => {
    const view = viewWith('# Titel');
    expect(readValue(view)).toBe('# Titel');
    view.destroy();
  });

  it('writeValue ersetzt den gesamten Doc-Inhalt', () => {
    const view = viewWith('alt');
    writeValue(view, 'neu');
    expect(readValue(view)).toBe('neu');
    view.destroy();
  });

  it('Roundtrip für Mehrzeiler und Leerstring', () => {
    const view = viewWith('start');
    writeValue(view, 'Zeile 1\nZeile 2\n');
    expect(readValue(view)).toBe('Zeile 1\nZeile 2\n');
    writeValue(view, '');
    expect(readValue(view)).toBe('');
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/editor/__tests__/value.test.ts`
Expected: FAIL mit „Cannot find module '../value'".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/editor/value.ts`:

```typescript
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
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/editor/__tests__/value.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editor/value.ts src/editor/__tests__/value.test.ts
git commit -m "feat(m1): headless value-Logik (readValue/writeValue)"
```

---

## Task 7: Extension-Zusammenstellung (`editor/extensions.ts`)

**Files:**
- Create: `src/editor/extensions.ts`
- Test: `src/editor/__tests__/extensions.test.ts`

**Interfaces:**
- Consumes: `ResolvedOptions` (Task 2), `highlightExtension` (Task 4), `supaTheme` (Task 5), CM6-Pakete.
- Produces: `function buildExtensions(resolved: ResolvedOptions): Extension[]`
  - Enthält immer: `markdown()`, `highlightExtension`, `supaTheme`, `EditorState.tabSize.of(...)`, `indentUnit.of(...)`.
  - Bedingt: `EditorView.lineWrapping` (wenn `lineWrapping`), `placeholder(text)` (wenn `placeholder !== null`).
  - `autofocus` ist **kein** Extension-Belang (wird im View-Konstruktor gesetzt) → taucht hier nicht auf.

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/editor/__tests__/extensions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { buildExtensions } from '../extensions';
import type { ResolvedOptions } from '../../options';

const base: ResolvedOptions = {
  lineWrapping: true,
  placeholder: null,
  autofocus: false,
  tabSize: 2,
  indentUnit: 2,
};

/** Baut einen State aus den Extensions — schlägt fehl, wenn Extensions inkompatibel sind. */
function stateFrom(resolved: ResolvedOptions) {
  return EditorState.create({ doc: '# Test', extensions: buildExtensions(resolved) });
}

describe('buildExtensions', () => {
  it('liefert immer eine nicht-leere Extension-Liste', () => {
    const ext = buildExtensions(base);
    expect(Array.isArray(ext)).toBe(true);
    expect(ext.length).toBeGreaterThan(0);
  });

  it('erzeugt einen gültigen State (Extensions kompatibel)', () => {
    const state = stateFrom(base);
    expect(state.doc.toString()).toBe('# Test');
  });

  it('aktiviert lineWrapping-Facet, wenn lineWrapping=true', () => {
    const view = new EditorView({ state: stateFrom({ ...base, lineWrapping: true }) });
    expect(view.state.facet(EditorView.lineWrapping)).toBe(true);
    view.destroy();
  });

  it('aktiviert lineWrapping-Facet NICHT, wenn lineWrapping=false', () => {
    const view = new EditorView({ state: stateFrom({ ...base, lineWrapping: false }) });
    expect(view.state.facet(EditorView.lineWrapping)).toBe(false);
    view.destroy();
  });

  it('übernimmt tabSize in den State', () => {
    const state = stateFrom({ ...base, tabSize: 4 });
    expect(state.tabSize).toBe(4);
  });

  it('übernimmt indentUnit in den State', () => {
    // indentUnit ist als String (Leerzeichen) im Facet hinterlegt.
    const state = stateFrom({ ...base, indentUnit: 4 });
    expect(state.facet(indentUnit)).toBe('    ');
  });

  it('erzeugt bei gesetztem placeholder das .cm-placeholder-DOM', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const view = new EditorView({
      state: stateFrom({ ...base, placeholder: 'Los geht’s …' }),
      parent: ta.parentNode as HTMLElement,
    });
    // Placeholder erscheint nur im leeren Doc; hier ist doc='# Test' → wir
    // prüfen stattdessen, dass die Extension aktiv ist, indem wir leeren.
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    expect(view.dom.querySelector('.cm-placeholder')).not.toBeNull();
    view.destroy();
    ta.remove();
  });

  it('erzeugt KEIN .cm-placeholder-DOM, wenn placeholder=null', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const view = new EditorView({
      state: stateFrom({ ...base, placeholder: null }),
      parent: ta.parentNode as HTMLElement,
    });
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    expect(view.dom.querySelector('.cm-placeholder')).toBeNull();
    view.destroy();
    ta.remove();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/editor/__tests__/extensions.test.ts`
Expected: FAIL mit „Cannot find module '../extensions'".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/editor/extensions.ts`:

```typescript
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import type { ResolvedOptions } from '../options';
import { highlightExtension } from './highlight';
import { supaTheme } from './theme';

/**
 * Übersetzt normalisierte Optionen in die CM6-Extension-Liste. Jede easyMDE-
 * Option wird hier zur echten Extension (kein Flag-Layer). `autofocus` ist
 * bewusst nicht enthalten — es ist eine View-Konstruktor-Option, keine Extension.
 */
export function buildExtensions(resolved: ResolvedOptions): Extension[] {
  const extensions: Extension[] = [
    markdown(),
    highlightExtension,
    supaTheme,
    EditorState.tabSize.of(resolved.tabSize),
    indentUnit.of(' '.repeat(resolved.indentUnit)),
  ];

  if (resolved.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }
  if (resolved.placeholder !== null) {
    extensions.push(placeholder(resolved.placeholder));
  }

  return extensions;
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/editor/__tests__/extensions.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editor/extensions.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat(m1): Optionen→CM6-Extensions (Kern-Set)"
```

---

## Task 8: fromTextArea-Äquivalent + Rückbau (`editor/setup.ts`)

**Files:**
- Create: `src/editor/setup.ts`
- Test: `src/editor/__tests__/setup.test.ts`

**Interfaces:**
- Consumes: `SupaMDEOptions`, `resolveOptions` (Task 2), `buildExtensions` (Task 7), CM6 `EditorView`.
- Produces:
  - `interface EditorHandle { view: EditorView; toTextArea(): HTMLTextAreaElement; forceSync(): void; }`
  - `function editorFromTextArea(options: SupaMDEOptions): EditorHandle`
  - Wirft `Error` bei fehlendem/nicht-`HTMLTextAreaElement`-`element`.
  - Verhalten: View vor Textarea eingefügt, Textarea `display:none`; Form-Submit-Listener schreibt Doc→Textarea; `toTextArea()` synct, zerstört View, stellt Textarea her, entfernt Listener, entfernt `view.dom`.

- [ ] **Step 1: Failing-Test schreiben**

Datei `src/editor/__tests__/setup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { editorFromTextArea } from '../setup';

function makeTextarea(value = '', attach = true): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.value = value;
  if (attach) document.body.appendChild(ta);
  return ta;
}

describe('editorFromTextArea', () => {
  it('wirft bei fehlendem element', () => {
    expect(() => editorFromTextArea({})).toThrow(/element/i);
  });

  it('wirft bei nicht-Textarea-element', () => {
    const div = document.createElement('div');
    expect(() => editorFromTextArea({ element: div })).toThrow(/textarea/i);
  });

  it('initialisiert das Doc aus dem Textarea-Wert', () => {
    const ta = makeTextarea('# Hallo');
    const h = editorFromTextArea({ element: ta });
    expect(h.view.state.doc.toString()).toBe('# Hallo');
    h.toTextArea();
  });

  it('initialValue überschreibt den Textarea-Wert', () => {
    const ta = makeTextarea('aus Textarea');
    const h = editorFromTextArea({ element: ta, initialValue: 'aus initialValue' });
    expect(h.view.state.doc.toString()).toBe('aus initialValue');
    h.toTextArea();
  });

  it('fügt view.dom vor der Textarea ein und versteckt die Textarea', () => {
    const ta = makeTextarea('x');
    const h = editorFromTextArea({ element: ta });
    expect(h.view.dom.parentNode).toBe(ta.parentNode);
    expect(ta.previousSibling).toBe(h.view.dom);
    expect(ta.style.display).toBe('none');
    h.toTextArea();
  });

  it('toTextArea entfernt view.dom, stellt Textarea her und schreibt den Wert zurück', () => {
    const ta = makeTextarea('start');
    const h = editorFromTextArea({ element: ta });
    h.view.dispatch({ changes: { from: 0, to: h.view.state.doc.length, insert: 'geändert' } });
    const returned = h.toTextArea();
    expect(returned).toBe(ta);
    expect(ta.value).toBe('geändert');
    expect(ta.style.display).not.toBe('none');
    expect(document.body.contains(h.view.dom)).toBe(false);
  });

  it('forceSync und Form-Submit schreiben den Doc-Wert in die Textarea', () => {
    const form = document.createElement('form');
    const ta = makeTextarea('a', false);
    form.appendChild(ta);
    document.body.appendChild(form);

    const h = editorFromTextArea({ element: ta });
    h.view.dispatch({ changes: { from: 0, to: h.view.state.doc.length, insert: 'b' } });

    // submit abbrechen, um Navigation in jsdom zu vermeiden
    form.addEventListener('submit', (e) => e.preventDefault());
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(ta.value).toBe('b');

    h.toTextArea();
    form.remove();
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/editor/__tests__/setup.test.ts`
Expected: FAIL mit „Cannot find module '../setup'".

- [ ] **Step 3: Minimale Implementierung**

Datei `src/editor/setup.ts`:

```typescript
import { EditorView } from '@codemirror/view';
import type { SupaMDEOptions } from '../options';
import { resolveOptions } from '../options';
import { buildExtensions } from './extensions';

/** Steuerungs-Handle über den erzeugten Editor inkl. Rückbau. */
export interface EditorHandle {
  /** Die zugrunde liegende CM6-EditorView. */
  view: EditorView;
  /** Baut den Editor zurück und liefert die wiederhergestellte Textarea. */
  toTextArea(): HTMLTextAreaElement;
  /** Schreibt den aktuellen Doc-Inhalt sofort in die Textarea. */
  forceSync(): void;
}

/**
 * CM6-Nachbau von `fromTextArea`: erzeugt eine EditorView aus dem Textarea-
 * Inhalt, fügt sie davor ein, versteckt die Textarea und hält den Form-Submit-
 * Wert synchron. Der Textarea-Wert ist die Quelle NUR bei Konstruktion.
 */
export function editorFromTextArea(options: SupaMDEOptions): EditorHandle {
  const element = options.element;
  if (!element) {
    throw new Error('SupaMDE: `element` ist erforderlich (eine <textarea>).');
  }
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('SupaMDE: `element` muss ein <textarea> sein.');
  }
  const textarea = element;

  const resolved = resolveOptions(options);
  const doc = options.initialValue ?? textarea.value;

  // Ohne `parent` erzeugt; view.dom wird gleich manuell vor der Textarea platziert.
  const view = new EditorView({
    doc,
    extensions: buildExtensions(resolved),
  });

  // vor die Textarea einfügen, Textarea verstecken
  textarea.parentNode?.insertBefore(view.dom, textarea);
  const previousDisplay = textarea.style.display;
  textarea.style.display = 'none';

  const forceSync = (): void => {
    textarea.value = view.state.doc.toString();
  };

  // Form-Submit-Listener referenziert halten, damit toTextArea ihn entfernen kann
  const onSubmit = (): void => forceSync();
  const form = textarea.form;
  form?.addEventListener('submit', onSubmit);

  if (resolved.autofocus) {
    view.focus();
  }

  const toTextArea = (): HTMLTextAreaElement => {
    forceSync();
    form?.removeEventListener('submit', onSubmit);
    view.destroy();
    view.dom.remove();
    textarea.style.display = previousDisplay;
    return textarea;
  };

  return { view, toTextArea, forceSync };
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/editor/__tests__/setup.test.ts`
Expected: PASS (8 Tests).

- [ ] **Step 5: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editor/setup.ts src/editor/__tests__/setup.test.ts
git commit -m "feat(m1): fromTextArea-Äquivalent mit sauberem Rückbau"
```

---

## Task 9: Fassade verdrahten (`index.ts`)

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `SupaMDEOptions` (Task 2), `readValue`/`writeValue` (Task 6), `EditorHandle`/`editorFromTextArea` (Task 8), `EditorView`.
- Produces (öffentliche API):
  - `class SupaMDE` mit `options: SupaMDEOptions`, `codemirror: EditorView` (die View), Methoden:
    - `value(): string` und `value(val: string): void` (überladen)
    - `getValue(): string`
    - `setValue(val: string): void`
    - `toTextArea(): HTMLTextAreaElement`
  - Re-Export `SupaMDEOptions` aus `./options`.

- [ ] **Step 1: Failing-Test schreiben (bestehende Datei erweitern)**

An `src/__tests__/index.test.ts` anhängen (nach dem bestehenden `describe`), und den `element: {}`-Fall des Skelett-Tests ersetzen, da der Konstruktor jetzt eine echte Textarea braucht.

Zuerst den bestehenden Test „übernimmt übergebene Optionen" ändern — er darf keinen Editor mehr bauen, da `element` nun ein echtes Textarea sein muss:

```typescript
// ERSETZEN: der bisherige Test 'übernimmt übergebene Optionen' baute keinen Editor.
// Neuer, getrennter describe-Block für die Editor-API:

describe('SupaMDE (Editor-API, M1)', () => {
  function attachedTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('baut einen Editor aus der Textarea und liest den Wert', () => {
    const ta = attachedTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });
    expect(editor.value()).toBe('# Titel');
    expect(editor.getValue()).toBe('# Titel');
    editor.toTextArea();
  });

  it('setValue und value(val) ersetzen den Doc-Inhalt (äquivalent)', () => {
    const ta = attachedTextarea('alt');
    const editor = new SupaMDE({ element: ta });
    editor.setValue('neu');
    expect(editor.getValue()).toBe('neu');
    editor.value('via value');
    expect(editor.value()).toBe('via value');
    editor.toTextArea();
  });

  it('Roundtrip für Mehrzeiler und Leerstring', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });
    editor.setValue('Zeile 1\nZeile 2\n');
    expect(editor.getValue()).toBe('Zeile 1\nZeile 2\n');
    editor.setValue('');
    expect(editor.getValue()).toBe('');
    editor.toTextArea();
  });

  it('exponiert die EditorView als `codemirror`', () => {
    const ta = attachedTextarea('x');
    const editor = new SupaMDE({ element: ta });
    expect(editor.codemirror).toBe(editor.codemirror); // stabil
    expect(typeof editor.codemirror.state.doc.toString()).toBe('string');
    editor.toTextArea();
  });

  it('wirft bei fehlendem element', () => {
    expect(() => new SupaMDE({})).toThrow(/element/i);
  });
});
```

Im **bestehenden** `describe('SupaMDE (Skelett)')`: den Test „übernimmt übergebene Optionen" und „lässt sich ohne Optionen instanziieren" entfernen (der Konstruktor braucht jetzt eine Textarea; diese Fälle sind durch den neuen Block bzw. den Fehler-Test abgedeckt). Die Tests für Default-/Named-Export und Version **bleiben**.

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm run test:run -- src/__tests__/index.test.ts`
Expected: FAIL (z. B. „editor.value is not a function").

- [ ] **Step 3: Implementierung — `index.ts` ersetzen**

Datei `src/index.ts`:

```typescript
import type { EditorView } from '@codemirror/view';
import { VERSION } from './version';
import type { SupaMDEOptions } from './options';
import { editorFromTextArea, type EditorHandle } from './editor/setup';
import { readValue, writeValue } from './editor/value';

export type { SupaMDEOptions } from './options';

/**
 * SupaMDE — moderner Markdown-Editor auf Basis von CodeMirror 6.
 *
 * Dünne Fassade: der Konstruktor baut über `editor/setup.ts` eine EditorView
 * aus der übergebenen Textarea; alle Methoden delegieren an diese View bzw. an
 * die headless value-Logik (`editor/value.ts`). Keine Editor-Logik in der Klasse.
 */
export class SupaMDE {
  /** Aktuelle SupaMDE-Version. */
  static readonly version = VERSION;

  /** Die (rohen) Optionen dieser Instanz. */
  readonly options: SupaMDEOptions;

  /** Die zugrunde liegende CM6-EditorView (NICHT das CM5-Objekt). */
  readonly codemirror: EditorView;

  private readonly handle: EditorHandle;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;
    this.handle = editorFromTextArea(options);
    this.codemirror = this.handle.view;
  }

  /** Liest (ohne Argument) oder setzt (mit Argument) den Editor-Inhalt. */
  value(): string;
  value(val: string): void;
  value(val?: string): string | void {
    if (val === undefined) {
      return this.getValue();
    }
    this.setValue(val);
  }

  /** Liefert den aktuellen Editor-Inhalt als String. */
  getValue(): string {
    return readValue(this.codemirror);
  }

  /** Ersetzt den gesamten Editor-Inhalt. */
  setValue(val: string): void {
    writeValue(this.codemirror, val);
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    return this.handle.toTextArea();
  }
}

export { VERSION } from './version';
export default SupaMDE;
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm run test:run -- src/__tests__/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Vollständige Suite + typecheck + lint**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: PASS (alle Tests grün).

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat(m1): SupaMDE-Fassade mit value/getValue/setValue/toTextArea"
```

---

## Task 10: Example-Seite auf echten Editor umstellen

**Files:**
- Modify: `example/index.html`

**Interfaces:**
- Consumes: gebauter Library-Output `../dist/supamde.mjs` (Default-Export `SupaMDE`).
- Produces: manuell verifizierbare, live formatierende Editor-Seite (AK-3).

> **Wichtig — Build/Dev-Kopplung:** Das Example importiert aus `../dist/supamde.mjs` (bestehende Projektkonvention aus M0), **nicht** aus `../src`. Der Vite-Dev-Server bedient zwar die Seite, liefert aber **kein** frisches `dist`. Die visuelle Abnahme sieht also nur den Stand des **letzten** `npm run build`. Deshalb: vor jeder Abnahme neu bauen (Step 1) und bei Code-Änderungen erneut. (Ein Umstieg des Imports auf `../src/index.ts` wäre für den Dev-Flow bequemer, weicht aber von der M0-Konvention ab — bewusst zurückgestellt, ggf. eigener Meilenstein.)

- [ ] **Step 1: Build erzeugen (Pflicht vor der Abnahme)**

Run: `npm run build`
Expected: PASS; `dist/supamde.mjs` und `dist/supamde.css` (falls Theme CSS emittiert) vorhanden.

- [ ] **Step 2: `example/index.html` ersetzen**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SupaMDE — M1 Editor-Kern</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    </style>
  </head>
  <body>
    <h1>SupaMDE</h1>
    <p>M1: Live formatierender CodeMirror-6-Editor. Bearbeite den Markdown-Text unten.</p>
    <form>
      <textarea id="editor">
# Überschrift 1
## Überschrift 2

Ein Absatz mit **fettem**, *kursivem* und ~~durchgestrichenem~~ Text.

Inline-`code` und ein Block:

```
const x = 42;
```

> Ein Zitat.

Ein [Link](https://example.org).
</textarea>
      <button type="submit">Absenden (forceSync-Demo)</button>
    </form>
    <script type="module">
      import SupaMDE from '../dist/supamde.mjs';
      const editor = new SupaMDE({
        element: document.getElementById('editor'),
        placeholder: 'Schreibe etwas Markdown …',
      });
      // eslint-disable-next-line no-console
      console.log('SupaMDE-Version:', SupaMDE.version, editor.getValue());
    </script>
  </body>
</html>
```

- [ ] **Step 3: Manuelle visuelle Abnahme (AK-3)**

Run: `npm run dev` und im Browser `example/index.html` öffnen (bzw. Vite-Dev-URL). **Voraussetzung:** `dist` ist aktuell (Step 1 gelaufen; bei zwischenzeitlichen Code-Änderungen `npm run build` erneut ausführen — der Dev-Server baut `dist` nicht selbst).
Prüfen: Überschriften größer/fett, `**fett**` fett, `*kursiv*` kursiv, Inline-/Block-Code monospace, Zitat abgesetzt, Link erkennbar. Absenden schreibt Wert in die (versteckte) Textarea (via `forceSync`).

- [ ] **Step 4: Commit**

```bash
git add example/index.html
git commit -m "feat(m1): Example-Seite zeigt live formatierenden Editor"
```

---

## Task 11: README erstellen

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: die öffentliche M1-API (`SupaMDE`, `value/getValue/setValue/toTextArea`, Kern-Optionen).
- Produces: Einstiegs-Doku.

> Sinnvoll, weil bislang **keine** README existiert. Statt „Aktualisierung" wird die Datei erstmalig angelegt, mit einem M1-Stand-Hinweis.

- [ ] **Step 1: `README.md` schreiben**

```markdown
# SupaMDE

Ein moderner, einbettbarer Markdown-Editor auf Basis von **CodeMirror 6** — die
modernisierte Neufassung von [easyMDE](https://github.com/Ionaru/easy-markdown-editor).

> **Status:** In Entwicklung. Aktueller Meilenstein: **M1 — Editor-Kern**
> (sichtbarer, live formatierender Editor; Wert-API; `toTextArea`).
> Toolbar, Kommandos, Preview und weitere Features folgen in späteren Meilensteinen.

## Installation

```bash
npm install supamde
```

CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.

## Grundnutzung

```html
<textarea id="editor"># Hallo **Welt**</textarea>
<script type="module">
  import SupaMDE from 'supamde';
  const editor = new SupaMDE({ element: document.getElementById('editor') });
</script>
```

## Optionen (Kern-Set, M1)

| Option | Typ | Default | Bedeutung |
|---|---|---|---|
| `element` | `HTMLTextAreaElement` | — | **Pflicht.** Die zu ersetzende Textarea. |
| `lineWrapping` | `boolean` | `true` | Zeilenumbruch statt horizontalem Scrollen. |
| `placeholder` | `string` | — | Platzhaltertext im leeren Editor. |
| `autofocus` | `boolean` | `false` | Fokussiert den Editor nach Erzeugung. |
| `tabSize` | `number` | `2` | Tab-Breite in Spalten. |
| `indentUnit` | `number` | `2` | Einrücktiefe in Leerzeichen. |
| `initialValue` | `string` | Textarea-Inhalt | Startwert (überschreibt Textarea). |

## API (M1)

| Methode | Beschreibung |
|---|---|
| `value()` / `getValue()` | Aktuellen Inhalt als String lesen. |
| `value(val)` / `setValue(val)` | Gesamten Inhalt ersetzen. |
| `toTextArea()` | Editor abbauen, ursprüngliche Textarea wiederherstellen. |
| `codemirror` | Die zugrunde liegende CodeMirror-6-`EditorView`. |

## Entwicklung

```bash
npm install
npm run dev        # Vite-Dev-Server (example/)
npm run test:run   # Vitest (einmalig)
npm run build      # Library-Build (ESM + UMD) + Typdeklarationen
npm run lint       # ESLint
npm run typecheck  # TypeScript ohne Emit
```

## Lizenz

MIT © Sven Deginther
```

- [ ] **Step 2: Lint über Doku/Repo laufen lassen (Konsistenz)**

Run: `npm run lint`
Expected: PASS (README wird von ESLint nicht erfasst, dient nur als Gesamt-Check).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(m1): README mit Installation, Optionen und API"
```

---

## Task 12: M1-Abnahme (Definition of Done)

**Files:** keine Änderung — reiner Verifikationslauf.

- [ ] **Step 1: Vollständige Verifikations-Kommandos (AK-12)**

Run: `npm run build && npm run test:run && npm run lint && npm run typecheck`
Expected: alle vier grün.

- [ ] **Step 2: Akzeptanzkriterien gegen die Spec abhaken**

Prüfen, dass AK-1..AK-13 aus `docs/superpowers/specs/2026-07-20-supamde-m1-editor-kern-design.md` erfüllt sind:
- AK-4..AK-6 (value-API): durch `value.test.ts` (Task 6) + `index.test.ts` (Task 9) belegt.
- AK-9..AK-10 (Optionen/Extensions): durch `options.test.ts` (Task 2) + `extensions.test.ts` (Task 7) belegt.
- AK-1..AK-2, AK-7..AK-8, AK-11 (Setup/Rückbau/Fehler): durch `setup.test.ts` (Task 8) + `index.test.ts` (Task 9) belegt.
- AK-3: manuelle visuelle Abnahme (Task 10, Step 3).
- AK-12: Step 1 hier.
- AK-13: CM6 in `dependencies` (Task 1), Build gebündelt (Step 1).

- [ ] **Step 3: Abschluss-Commit (falls offene Änderungen)**

```bash
git status
# nur falls noch Unstaged/Untracked relevant:
# git add -A && git commit -m "chore(m1): Abnahme Editor-Kern"
```

---

## Notizen für den Implementierer

- **`@lezer/highlight`-Tags:** Die verfügbaren Tags (`t.heading1`…`t.link`) können je nach Version leicht abweichen. Falls ein Tag nicht existiert, den TypeScript-Fehler beachten und das Tag weglassen — der Highlight-Test prüft nur, dass der Style als Extension gültig ist, nicht welche Tags enthalten sind.
- **`HighlightStyle.specs` meiden:** Der Highlight-Test inspiziert bewusst keine `HighlightStyle`-Interna (`.specs` ist kein garantiert stabiles API), sondern prüft die Gültigkeit über `EditorState.create`. Nicht auf Interna zurückfallen.
- **jsdom + CM6:** CM6 läuft headless in jsdom, aber Layout-Messungen (`getBoundingClientRect`) sind 0. Tests dürfen sich nicht auf gerenderte Pixel verlassen — nur auf State/DOM-Struktur (so gebaut). Das `.cm-placeholder`-DOM (Task 7) wird jedoch von CM6 auch in jsdom eingehängt und ist prüfbar.
- **`view.dom.remove()`** statt manuellem `parentNode.removeChild` — robuster, falls die View schon detached ist.
- **Reihenfolge einhalten:** Task 4/5 brauchen die Tokens (Task 3). Task 7 (Extensions) braucht Task 2 + 4 + 5. Task 8 (Setup) braucht Task 7. Task 9 (Fassade) braucht Task 6 (value) + Task 8 (Setup). Task 10/11 brauchen einen erfolgreichen Build (Task 9).
```
# SupaMDE M2 — Aktionen (CM6-Commands) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Toolbar-Aktionen von SupaMDE als reine, unit-getestete CM6-Commands umsetzen, per Default-Shortcuts (`supaKeymap`) und History (Undo/Redo) verdrahten.

**Architecture:** Jede Aktion ist eine reine Funktion `(view: EditorView) => boolean` unter `src/commands/`. Inline-Toggle nutzt den Lezer-Syntaxbaum (`syntaxTree`), Block/Listen arbeiten zeilenorientiert über kleine reine Helfer in `src/utils/text.ts`. Wiederkehrende Bausteine sind zentralisiert: der Change-Typ `DocChange` und die Zeilen-Präfix-Erkennung (`prefixes.ts`, genutzt von `block.ts`/`list.ts`/`cleanBlock`), damit sich die Regexes nicht über Module hinweg auseinanderentwickeln. Ein `supaKeymap` bindet die easyMDE-Default-Kürzel an die Commands und wird zusammen mit `history()` in das bestehende `buildExtensions` (M1) eingehängt.

**Tech Stack:** TypeScript 5.9, CodeMirror 6 (`@codemirror/{state,view,language,commands,lang-markdown}`, `@lezer/{highlight,markdown}`), Vitest (jsdom, headless `EditorView`).

## Global Constraints

- **Dependency-Pin:** `@codemirror/commands@^6.10.4` (aktuelle 6er-Linie, passend zu den übrigen `@codemirror/*` auf `^6`). TypeScript bleibt auf `^5.9.3` (NICHT 7.x — typescript-eslint-Peer-Range).
- **Command-Signatur:** `type SupaCommand = (view: EditorView) => boolean`. Rückgabe `true` nur, wenn das Doc verändert wurde, sonst `false` (kein Werfen bei normaler Nutzung).
- **Reinheit:** Commands sind ohne DOM/Mock in einem headless `EditorView` aufrufbar und getestet. Prompt-basierte Eingabe (Link/Bild) sitzt im dünnen Wrapper, nicht im Kern.
- **Code-Konventionen (aus M0/M1):** deutsche JSDoc/Kommentare, ESM-Imports, keine `var`/`prototype`; Tests mit Vitest `describe/it/expect`, headless `EditorView`, `view.destroy()` am Test-Ende.
- **Scope-Grenzen (nicht in M2):** kein Toolbar-DOM/keine statischen Aliase (M3), keine Auswertung der `shortcuts`-Option (M3), kein echter Bild-Upload (M5), keine Preview/SideBySide/Fullscreen-Shortcuts (M4).
- **Qualitäts-Gate je Commit:** relevanter Test grün; am Ende `npm run test:run`, `npm run typecheck`, `npm run lint` grün.
- **Spec:** `docs/superpowers/specs/2026-07-21-supamde-m2-commands-design.md`.

---

## Dateistruktur (M2)

Neu bzw. geändert:

```
src/
  commands/
    types.ts        (neu) → SupaCommand-Typ + DocChange
    prefixes.ts     (neu) → zentrale Zeilen-Präfixe (LINE_PREFIXES, stripLinePrefix)
    inline.ts       (neu) → bold, italic, strikethrough, inlineCode
    block.ts        (neu) → setHeading, headingSmaller/Bigger, quote, codeBlock, horizontalRule, cleanBlock
    list.ts         (neu) → unorderedList, orderedList, checkList, continueList (Extension)
    link-image.ts   (neu) → insertLink, insertImage (reine Kerne) + drawLink/drawImage (Wrapper)
    table.ts        (neu) → table
    history.ts      (neu) → undo, redo (Re-Export über @codemirror/commands)
    keymap.ts       (neu) → supaKeymap
    __tests__/      (neu) → je Modul ein *.test.ts
  utils/
    text.ts         (neu) → reine Zeilen-/Range-Helfer
    __tests__/text.test.ts (neu)
  editor/
    extensions.ts   (mod) → history() + keymap.of([...]) einhängen
example/index.html  (mod) → Shortcut-Demo-Hinweis, Undo/Redo
README.md           (mod) → Commands/Shortcuts-Abschnitt
package.json        (mod) → @codemirror/commands
```

---

## Task 1: Dependency + Command-Typ + Text-Helfer (Fundament)

**Files:**
- Modify: `package.json` (dependencies)
- Create: `src/commands/types.ts`
- Create: `src/commands/prefixes.ts`
- Create: `src/utils/text.ts`
- Test: `src/utils/__tests__/text.test.ts`

**Interfaces:**
- Consumes: nichts (Fundament).
- Produces:
  - `type SupaCommand = (view: EditorView) => boolean` (aus `src/commands/types.ts`).
  - `interface DocChange { from; to; insert }` (aus `src/commands/types.ts`) — geteilter Change-Typ.
  - `LINE_PREFIXES` + `stripLinePrefix(text): { prefix; rest } | null` (aus `src/commands/prefixes.ts`) — zentrale Definition aller Zeilen-Präfixe (Heading, Quote, ul/ol/check), genutzt von `block.ts`, `list.ts`, `cleanBlock`.
  - `selectedLineRange(state: EditorState): { from: number; to: number; firstLine: number; lastLine: number }` — Doc-Offsets, die den vollständigen Zeilenbereich der aktuellen Hauptselektion umschließen.
  - `toggleLinePrefix(view: EditorView, prefix: string): boolean` — setzt/entfernt `prefix` an jedem Zeilenanfang des Selektions-Zeilenbereichs; gibt `true` zurück, wenn eine Änderung dispatcht wurde.
  - `wrapSelection(view: EditorView, before: string, after: string): boolean` — umschließt die Hauptselektion mit `before`/`after`; bei leerer Selektion Marker einfügen und Cursor dazwischen setzen. Gibt `true` zurück.

- [ ] **Step 1: `@codemirror/commands` als Dependency ergänzen**

In `package.json`, im `"dependencies"`-Block (alphabetisch vor `@codemirror/lang-markdown`) einfügen:

```json
    "@codemirror/commands": "^6.10.4",
```

Danach installieren:

Run: `npm install`
Expected: Installation ohne Peer-Fehler; `node_modules/@codemirror/commands` existiert.

- [ ] **Step 2: Command-Typ + geteilter Change-Typ anlegen**

Create `src/commands/types.ts`:

```typescript
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
```

- [ ] **Step 3: Zentrale Zeilen-Präfixe anlegen**

Create `src/commands/prefixes.ts`:

```typescript
/**
 * Zentrale Definition aller markdown-Zeilen-Präfixe, die von mehreren Command-
 * Modulen erkannt/entfernt werden. Eine einzige Quelle verhindert, dass sich
 * `block.ts`, `list.ts` und `cleanBlock` in ihren Regexes auseinanderentwickeln.
 * Reihenfolge ist bedeutsam: spezifischere Muster (Checkliste) VOR allgemeineren
 * (Aufzählungsstrich) prüfen.
 */
export const LINE_PREFIXES: readonly RegExp[] = [
  /^#{1,6} /, // Heading
  /^> /, // Blockzitat
  /^- \[[ xX]\] /, // Checkliste (vor "- ")
  /^\d+\. /, // geordnete Liste
  /^[-*] /, // ungeordnete Liste: SupaMDE erzeugt "* ", erkennt aber auch "- "
];

/**
 * Trennt ein erkanntes Zeilen-Präfix vom Rest der Zeile. Liefert `null`, wenn die
 * Zeile mit keinem bekannten Präfix beginnt.
 */
export function stripLinePrefix(text: string): { prefix: string; rest: string } | null {
  for (const re of LINE_PREFIXES) {
    const m = re.exec(text);
    if (m) return { prefix: m[0], rest: text.slice(m[0].length) };
  }
  return null;
}
```

- [ ] **Step 4: Failing test für Text-Helfer + Präfixe schreiben**

Create `src/utils/__tests__/text.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { selectedLineRange, toggleLinePrefix, wrapSelection } from '../text';
import { stripLinePrefix } from '../../commands/prefixes';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('selectedLineRange', () => {
  it('umfasst die volle Zeile bei Cursor in der Zeilenmitte', () => {
    const view = viewWith('abc\ndef', 5); // in "def"
    const r = selectedLineRange(view.state);
    expect(view.state.sliceDoc(r.from, r.to)).toBe('def');
    view.destroy();
  });

  it('umfasst mehrere Zeilen bei mehrzeiliger Selektion', () => {
    const view = viewWith('a\nb\nc', 0, 3); // "a\nb"
    const r = selectedLineRange(view.state);
    expect(view.state.sliceDoc(r.from, r.to)).toBe('a\nb');
    view.destroy();
  });
});

describe('toggleLinePrefix', () => {
  it('fügt das Präfix jeder Zeile hinzu', () => {
    const view = viewWith('a\nb', 0, 3);
    const changed = toggleLinePrefix(view, '> ');
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('> a\n> b');
    view.destroy();
  });

  it('entfernt das Präfix, wenn alle Zeilen es tragen', () => {
    const view = viewWith('> a\n> b', 0, 7);
    toggleLinePrefix(view, '> ');
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('wrapSelection', () => {
  it('umschließt die Selektion mit Markern', () => {
    const view = viewWith('abc', 0, 3);
    const changed = wrapSelection(view, '**', '**');
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('**abc**');
    view.destroy();
  });

  it('fügt bei leerer Selektion ein Marker-Paar ein und setzt den Cursor dazwischen', () => {
    const view = viewWith('', 0);
    wrapSelection(view, '**', '**');
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
    view.destroy();
  });
});

describe('stripLinePrefix', () => {
  it('erkennt Checkliste vor dem allgemeinen Aufzählungsstrich', () => {
    expect(stripLinePrefix('- [ ] Aufgabe')).toEqual({ prefix: '- [ ] ', rest: 'Aufgabe' });
  });

  it('erkennt Heading, Quote und geordnete Liste', () => {
    expect(stripLinePrefix('## Titel')?.prefix).toBe('## ');
    expect(stripLinePrefix('> zitat')?.prefix).toBe('> ');
    expect(stripLinePrefix('3. Punkt')?.prefix).toBe('3. ');
  });

  it('liefert null ohne bekanntes Präfix', () => {
    expect(stripLinePrefix('Klartext')).toBeNull();
  });
});
```

- [ ] **Step 5: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/utils/__tests__/text.test.ts`
Expected: FAIL — `Failed to resolve import "../text"` bzw. „is not a function".

- [ ] **Step 6: Text-Helfer implementieren**

Create `src/utils/text.ts`:

```typescript
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { DocChange } from '../commands/types';

/** Der volle Zeilenbereich, den die Hauptselektion berührt. */
export interface LineRange {
  /** Doc-Offset am Anfang der ersten berührten Zeile. */
  from: number;
  /** Doc-Offset am Ende der letzten berührten Zeile. */
  to: number;
  /** 1-basierte Nummer der ersten Zeile. */
  firstLine: number;
  /** 1-basierte Nummer der letzten Zeile. */
  lastLine: number;
}

/** Ermittelt den vollständigen Zeilenbereich der Hauptselektion. */
export function selectedLineRange(state: EditorState): LineRange {
  const sel = state.selection.main;
  const first = state.doc.lineAt(sel.from);
  const last = state.doc.lineAt(sel.to);
  return {
    from: first.from,
    to: last.to,
    firstLine: first.number,
    lastLine: last.number,
  };
}

/**
 * Toggelt ein Zeilen-Präfix über den Selektions-Zeilenbereich: tragen ALLE
 * Zeilen das Präfix, wird es entfernt, sonst überall hinzugefügt.
 *
 * `detect` bestimmt, ob eine Zeile als „bereits mit Präfix" gilt und welche
 * Länge dann entfernt wird — nötig, wenn mehrere Marker denselben Listentyp
 * bezeichnen (z. B. `- ` und `* ` als ungeordnete Liste). Ohne `detect` gilt
 * ein exakter `startsWith(prefix)` (die Länge ist dann `prefix.length`).
 */
export function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  detect: RegExp = new RegExp(`^${escapeForRegExp(prefix)}`),
): boolean {
  const { state } = view;
  const range = selectedLineRange(state);
  const changes: DocChange[] = [];

  let allHavePrefix = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    if (!detect.test(state.doc.line(n).text)) {
      allHavePrefix = false;
      break;
    }
  }

  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    const existing = detect.exec(line.text);
    if (allHavePrefix) {
      const len = existing ? existing[0].length : 0;
      changes.push({ from: line.from, to: line.from + len, insert: '' });
    } else if (!existing) {
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}

/** Escaped Sonderzeichen eines Strings für die wörtliche Nutzung in einem RegExp. */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Umschließt die Hauptselektion mit `before`/`after`. Bei leerer Selektion
 * wird ein Marker-Paar eingefügt und der Cursor dazwischen platziert.
 */
export function wrapSelection(view: EditorView, before: string, after: string): boolean {
  const sel = view.state.selection.main;
  view.dispatch({
    changes: [
      { from: sel.from, insert: before },
      { from: sel.to, insert: after },
    ],
    selection: sel.empty
      ? { anchor: sel.from + before.length }
      : {
          anchor: sel.from + before.length,
          head: sel.to + before.length,
        },
  });
  return true;
}
```

- [ ] **Step 7: Test ausführen (muss grün sein)**

Run: `npx vitest run src/utils/__tests__/text.test.ts`
Expected: PASS (alle Tests grün — Text-Helfer und `stripLinePrefix`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/commands/types.ts src/commands/prefixes.ts src/utils/text.ts src/utils/__tests__/text.test.ts
git commit -m "feat(m2): Command-Typ, DocChange, Zeilen-Präfixe, Text-Helfer und @codemirror/commands-Dependency"
```

---

## Task 2: Inline-Commands (bold/italic/strikethrough/inline-code)

**Files:**
- Create: `src/commands/inline.ts`
- Test: `src/commands/__tests__/inline.test.ts`

**Interfaces:**
- Consumes: `SupaCommand` (Task 1), `wrapSelection` (Task 1).
- Produces: `bold`, `italic`, `strikethrough`, `inlineCode` — je `SupaCommand`.

Toggle-Erkennung über den Lezer-Syntaxbaum: Knoten `StrongEmphasis` (bold), `Emphasis` (italic), `Strikethrough`, `InlineCode`. Liegt die Selektion vollständig innerhalb eines solchen Knotens, werden dessen Marker-Kinder (`EmphasisMark` bzw. `CodeMark`) entfernt (unformatieren); sonst `wrapSelection`.

- [ ] **Step 1: Failing test schreiben**

Create `src/commands/__tests__/inline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { bold, italic, strikethrough, inlineCode } from '../inline';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ extensions: GFM })],
  });
  return new EditorView({ state });
}

describe('bold', () => {
  it('umschließt die Selektion mit ** (AC-I1)', () => {
    const view = viewWith('Wort', 0, 4);
    expect(bold(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('**Wort**');
    view.destroy();
  });

  it('fügt am Cursor ein Marker-Paar ein und setzt den Cursor dazwischen (AC-I2)', () => {
    const view = viewWith('', 0);
    bold(view);
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
    view.destroy();
  });

  it('entfernt vorhandene ** (Toggle-Off, AC-I3)', () => {
    const view = viewWith('**Wort**', 2, 6); // "Wort" selektiert
    bold(view);
    expect(view.state.doc.toString()).toBe('Wort');
    view.destroy();
  });

  it('umschließt eine mehrzeilige Selektion als einen Bereich (AC-I5)', () => {
    const view = viewWith('a\nb', 0, 3);
    bold(view);
    expect(view.state.doc.toString()).toBe('**a\nb**');
    view.destroy();
  });
});

describe('verschachteltes Toggle (AC-I4)', () => {
  it('italic-Toggle-Off wirkt nur auf den inneren *b*, ** bleibt intakt', () => {
    // Ausgangsdoc mit real verschachteltem Emphasis-Knoten:
    // "**a *b* c**" → StrongEmphasis(…, Emphasis(*b*), …). italic-Toggle auf "b"
    // findet den inneren Emphasis-Knoten und entfernt NUR dessen *-Marker;
    // die umschließende **-Ebene bleibt unangetastet.
    const view = viewWith('**a *b* c**', 5, 6); // "b" innerhalb des Emphasis (Pos 5='b')
    italic(view);
    expect(view.state.doc.toString()).toBe('**a b c**');
    view.destroy();
  });

  it('italic-Toggle-On fügt inneres *…* ein, ohne die **-Ebene zu berühren', () => {
    // Gegenprobe ohne inneren Knoten: hier greift der wrapSelection-Zweig.
    const view = viewWith('**a b c**', 4, 5); // "b" selektiert (Pos 4='b'), kein Emphasis darum
    italic(view);
    expect(view.state.doc.toString()).toBe('**a *b* c**');
    view.destroy();
  });
});

describe('italic / strikethrough / inlineCode', () => {
  it('italic umschließt mit *', () => {
    const view = viewWith('x', 0, 1);
    italic(view);
    expect(view.state.doc.toString()).toBe('*x*');
    view.destroy();
  });

  it('strikethrough umschließt mit ~~', () => {
    const view = viewWith('x', 0, 1);
    strikethrough(view);
    expect(view.state.doc.toString()).toBe('~~x~~');
    view.destroy();
  });

  it('inlineCode umschließt mit `', () => {
    const view = viewWith('x', 0, 1);
    inlineCode(view);
    expect(view.state.doc.toString()).toBe('`x`');
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/inline.test.ts`
Expected: FAIL — `Failed to resolve import "../inline"`.

- [ ] **Step 3: Inline-Commands implementieren**

Create `src/commands/inline.ts`:

```typescript
import type { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { SupaCommand } from './types';
import { wrapSelection } from '../utils/text';

/** Lezer-Knoten je Inline-Formatierung + zugehöriger Marker-Kindname. */
interface InlineSpec {
  /** Umschließender Syntaxknoten (z. B. StrongEmphasis). */
  node: string;
  /** Name der Marker-Kindknoten (EmphasisMark bzw. CodeMark). */
  mark: string;
  /** Vor der Selektion einzufügender Marker. */
  before: string;
  /** Nach der Selektion einzufügender Marker. */
  after: string;
}

/** Sucht einen umschließenden Knoten `spec.node` um die Selektion. */
function enclosingNode(view: EditorView, spec: InlineSpec): SyntaxNode | null {
  const sel = view.state.selection.main;
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(sel.from, 1);
  while (node) {
    if (node.name === spec.node && node.from <= sel.from && node.to >= sel.to) {
      return node;
    }
    node = node.parent;
  }
  return null;
}

/** Entfernt die Marker-Kinder eines Formatierungs-Knotens (Toggle-Off). */
function unwrap(view: EditorView, node: SyntaxNode, markName: string): boolean {
  const marks: { from: number; to: number }[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === markName) marks.push({ from: child.from, to: child.to });
  }
  if (marks.length === 0) return false;
  view.dispatch({ changes: marks.map((m) => ({ from: m.from, to: m.to, insert: '' })) });
  return true;
}

function toggle(spec: InlineSpec): SupaCommand {
  return (view) => {
    const node = enclosingNode(view, spec);
    if (node) return unwrap(view, node, spec.mark);
    return wrapSelection(view, spec.before, spec.after);
  };
}

/** Fettdruck (`**…**`) ein-/ausschalten. */
export const bold: SupaCommand = toggle({
  node: 'StrongEmphasis',
  mark: 'EmphasisMark',
  before: '**',
  after: '**',
});

/** Kursiv (`*…*`) ein-/ausschalten. */
export const italic: SupaCommand = toggle({
  node: 'Emphasis',
  mark: 'EmphasisMark',
  before: '*',
  after: '*',
});

/** Durchstreichen (`~~…~~`) ein-/ausschalten. */
export const strikethrough: SupaCommand = toggle({
  node: 'Strikethrough',
  mark: 'StrikethroughMark',
  before: '~~',
  after: '~~',
});

/** Inline-Code (`` `…` ``) ein-/ausschalten. */
export const inlineCode: SupaCommand = toggle({
  node: 'InlineCode',
  mark: 'CodeMark',
  before: '`',
  after: '`',
});
```

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/inline.test.ts`
Expected: PASS.

Die Marker-Kindnamen sind gegen `@lezer/markdown` (mit GFM) verifiziert und in den
`InlineSpec`s bereits korrekt hinterlegt: `StrongEmphasis`/`Emphasis` → `EmphasisMark`,
`Strikethrough` → `StrikethroughMark`, `InlineCode` → `CodeMark`. **Keine** nachträgliche
Anpassung der Test-Erwartungen an das Ist-Ergebnis — die erwarteten Doc-Strings sind
Vorgabe (TDD). Schlägt ein Test fehl, liegt der Fehler im Command, nicht im Test.

Hinweis zur Robustheit (Spec 4.1): Fehlt wider Erwarten ein Knoten (z. B. Cursor am
Marker-Rand), fällt `toggle` auf `wrapSelection` zurück — nie ein Wurf.

- [ ] **Step 5: Commit**

```bash
git add src/commands/inline.ts src/commands/__tests__/inline.test.ts
git commit -m "feat(m2): inline-Commands (bold/italic/strikethrough/inline-code) mit Syntaxbaum-Toggle"
```

---

## Task 3: Block-Commands (heading/quote/code-block/hr/clean-block)

**Files:**
- Create: `src/commands/block.ts`
- Test: `src/commands/__tests__/block.test.ts`

**Interfaces:**
- Consumes: `SupaCommand`, `DocChange`, `stripLinePrefix` (Task 1), `toggleLinePrefix`, `selectedLineRange`, `wrapSelection` (Task 1).
- Produces:
  - `setHeading(level: 1|2|3|4|5|6): SupaCommand`
  - `headingSmaller: SupaCommand`, `headingBigger: SupaCommand`
  - `quote: SupaCommand`, `codeBlock: SupaCommand`
  - `horizontalRule: SupaCommand`, `cleanBlock: SupaCommand`

- [ ] **Step 1: Failing test schreiben**

Create `src/commands/__tests__/block.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  horizontalRule,
  cleanBlock,
} from '../block';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ extensions: GFM })],
  });
  return new EditorView({ state });
}

describe('setHeading', () => {
  it('setzt ## vor eine Klartextzeile (AC-B1)', () => {
    const view = viewWith('Titel', 0);
    expect(setHeading(2)(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('## Titel');
    view.destroy();
  });

  it('entfernt die Überschrift bei erneutem gleichem Level (Toggle, AC-B1)', () => {
    const view = viewWith('## Titel', 0);
    setHeading(2)(view);
    expect(view.state.doc.toString()).toBe('Titel');
    view.destroy();
  });
});

describe('headingSmaller / headingBigger (AC-B2)', () => {
  it('headingSmaller macht aus Klartext H1 und dann H2', () => {
    const view = viewWith('T', 0);
    headingSmaller(view);
    expect(view.state.doc.toString()).toBe('# T');
    headingSmaller(view);
    expect(view.state.doc.toString()).toBe('## T');
    view.destroy();
  });

  it('headingBigger macht aus H1 Klartext und bleibt dann bei Klartext (Untergrenze)', () => {
    const view = viewWith('# T', 0);
    headingBigger(view);
    expect(view.state.doc.toString()).toBe('T');
    headingBigger(view);
    expect(view.state.doc.toString()).toBe('T');
    view.destroy();
  });
});

describe('quote (AC-B3)', () => {
  it('setzt und entfernt > Präfix', () => {
    const view = viewWith('a\nb', 0, 3);
    quote(view);
    expect(view.state.doc.toString()).toBe('> a\n> b');
    quote(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('codeBlock (AC-B4)', () => {
  it('umschließt die Selektion mit Fences', () => {
    const view = viewWith('x', 0, 1);
    codeBlock(view);
    expect(view.state.doc.toString()).toBe('```\nx\n```');
    view.destroy();
  });

  it('entfernt die Fences auf bereits umschlossener Selektion (Toggle-Off)', () => {
    const view = viewWith('```\nx\n```', 4, 5); // "x" innerhalb der Fences selektiert
    codeBlock(view);
    expect(view.state.doc.toString()).toBe('x');
    view.destroy();
  });
});

describe('horizontalRule (AC-B5)', () => {
  it('fügt eine Trennlinie an der Cursorzeile ein', () => {
    const view = viewWith('a', 1);
    horizontalRule(view);
    expect(view.state.doc.toString()).toBe('a\n---\n');
    view.destroy();
  });
});

describe('cleanBlock (AC-B6)', () => {
  it('entfernt Heading-, Quote- und Listen-Präfixe', () => {
    const view = viewWith('## a\n> b\n- c\n1. d', 0, 16);
    cleanBlock(view);
    expect(view.state.doc.toString()).toBe('a\nb\nc\nd');
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/block.test.ts`
Expected: FAIL — `Failed to resolve import "../block"`.

- [ ] **Step 3: Block-Commands implementieren**

Create `src/commands/block.ts`:

```typescript
import type { EditorView } from '@codemirror/view';
import type { DocChange, SupaCommand } from './types';
import { stripLinePrefix } from './prefixes';
import { selectedLineRange, toggleLinePrefix, wrapSelection } from '../utils/text';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Liefert das aktuelle Heading-Level der ersten Selektionszeile (0 = keins). */
function currentLevel(view: EditorView): number {
  const { firstLine } = selectedLineRange(view.state);
  const text = view.state.doc.line(firstLine).text;
  const match = /^(#{1,6}) /.exec(text);
  // match[0] (voller Match: #-Folge + Leerzeichen) ist unter noUncheckedIndexedAccess
  // stets definiert — anders als die Capture-Gruppe match[1]. Länge − 1 = Heading-Level.
  return match ? match[0].length - 1 : 0;
}

/** Setzt jede Selektionszeile auf `level` #-Zeichen; `level === 0` entfernt sie. */
function applyHeading(view: EditorView, level: number): boolean {
  const range = selectedLineRange(view.state);
  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    const existing = /^(#{1,6}) /.exec(line.text);
    const oldLen = existing ? existing[0].length : 0;
    const insert = level === 0 ? '' : '#'.repeat(level) + ' ';
    changes.push({ from: line.from, to: line.from + oldLen, insert });
  }
  // Rückgabe-Constraint: nur bei echter Doc-Änderung dispatchen und true liefern.
  const hasRealChange = changes.some((c) => c.from !== c.to || c.insert !== '');
  if (!hasRealChange) return false;
  view.dispatch({ changes });
  return true;
}

/** Setzt ein absolutes Heading-Level; erneutes Setzen desselben Levels entfernt es. */
export function setHeading(level: HeadingLevel): SupaCommand {
  return (view) => applyHeading(view, currentLevel(view) === level ? 0 : level);
}

/** Verkleinert die Überschrift (mehr #, Grenze 6); aus Klartext wird H1. */
export const headingSmaller: SupaCommand = (view) => {
  const next = Math.min(currentLevel(view) + 1, 6);
  return applyHeading(view, next);
};

/** Vergrößert die Überschrift (weniger #); H1 → Klartext, bleibt bei Klartext. */
export const headingBigger: SupaCommand = (view) => {
  const next = Math.max(currentLevel(view) - 1, 0);
  return applyHeading(view, next);
};

/** Blockzitat (`> `) je Zeile ein-/ausschalten. */
export const quote: SupaCommand = (view) => toggleLinePrefix(view, '> ');

/**
 * Umschließt die Selektion mit ```-Fences (Codeblock) bzw. entfernt sie, wenn die
 * Selektion bereits exakt von einem `` ```-Fence-Paar `` umschlossen ist (Toggle).
 */
export const codeBlock: SupaCommand = (view) => {
  const sel = view.state.selection.main;
  const before = '```\n';
  const after = '\n```';
  const pre = view.state.sliceDoc(Math.max(0, sel.from - before.length), sel.from);
  const post = view.state.sliceDoc(sel.to, Math.min(view.state.doc.length, sel.to + after.length));
  if (pre === before && post === after) {
    // Toggle-Off: die umschließenden Fences entfernen.
    view.dispatch({
      changes: [
        { from: sel.from - before.length, to: sel.from, insert: '' },
        { from: sel.to, to: sel.to + after.length, insert: '' },
      ],
    });
    return true;
  }
  return wrapSelection(view, before, after);
};

/** Fügt eine horizontale Trennlinie (`\n---\n`) an der Cursorzeile ein. */
export const horizontalRule: SupaCommand = (view) => {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({ changes: { from: line.to, insert: '\n---\n' } });
  return true;
};

/** Entfernt erkannte Block-/Listen-Präfixe (#, >, -, 1., - [ ]) der selektierten Zeilen. */
export const cleanBlock: SupaCommand = (view) => {
  const range = selectedLineRange(view.state);
  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    const stripped = stripLinePrefix(line.text);
    if (stripped) {
      changes.push({ from: line.from, to: line.from + stripped.prefix.length, insert: '' });
    }
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
};
```

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/block.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/block.ts src/commands/__tests__/block.test.ts
git commit -m "feat(m2): block-Commands (heading/quote/code-block/hr/clean-block)"
```

---

## Task 4: Listen-Commands + Listen-Fortsetzung

**Files:**
- Create: `src/commands/list.ts`
- Test: `src/commands/__tests__/list.test.ts`

**Interfaces:**
- Consumes: `SupaCommand`, `DocChange` (Task 1), `toggleLinePrefix`, `selectedLineRange` (Task 1).
- Produces:
  - `unorderedList: SupaCommand` (`- `), `unorderedListStar: SupaCommand` (`* `), `orderedList: SupaCommand`, `checkList: SupaCommand`
  - `continueList: (view: EditorView) => boolean` — Enter-Handler; setzt Listen-Präfix fort bzw. beendet die Liste; `false`, wenn keine Listenzeile.

> Hinweis: `continueList` baut seine Enter-Transaktion selbst (inkl. Nummern-Inkrement bei
> geordneten Listen) und nutzt **nicht** `insertNewlineAndIndent` aus `@codemirror/commands`.

- [ ] **Step 1: Failing test schreiben**

Create `src/commands/__tests__/list.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { unorderedList, orderedList, checkList, continueList } from '../list';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('unorderedList (AC-L1)', () => {
  it('setzt und entfernt "- "', () => {
    const view = viewWith('a\nb', 0, 3);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- a\n- b');
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('orderedList (AC-L2)', () => {
  it('nummeriert fortlaufend', () => {
    const view = viewWith('a\nb\nc', 0, 5);
    orderedList(view);
    expect(view.state.doc.toString()).toBe('1. a\n2. b\n3. c');
    view.destroy();
  });
});

describe('checkList (AC-L3)', () => {
  it('setzt "- [ ] "', () => {
    const view = viewWith('a', 0, 1);
    checkList(view);
    expect(view.state.doc.toString()).toBe('- [ ] a');
    view.destroy();
  });
});

describe('continueList (AC-L4/L5)', () => {
  it('setzt das Präfix in der neuen Zeile fort', () => {
    const view = viewWith('- item', 6); // Cursor am Zeilenende
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- item\n- ');
    view.destroy();
  });

  it('beendet die Liste bei leerer Listenzeile', () => {
    const view = viewWith('- ', 2);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('');
    view.destroy();
  });

  it('gibt false zurück außerhalb einer Liste', () => {
    const view = viewWith('kein Listeneintrag', 5);
    expect(continueList(view)).toBe(false);
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/list.test.ts`
Expected: FAIL — `Failed to resolve import "../list"`.

- [ ] **Step 3: Listen-Commands implementieren**

Create `src/commands/list.ts`:

```typescript
import type { EditorView } from '@codemirror/view';
import type { DocChange, SupaCommand } from './types';
import { stripLinePrefix } from './prefixes';
import { selectedLineRange, toggleLinePrefix } from '../utils/text';

/** Ungeordnete Liste (`- `) je Zeile ein-/ausschalten. */
/** Ein ungeordneter Bullet-Marker am Zeilenanfang (`- ` oder `* `). */
const BULLET_PREFIX = /^[-*] /;

/**
 * Toggelt einen ungeordneten Bullet-Marker über die Selektion mit Konvertier-
 * Semantik, sodass NIE ein zweiter Marker davorgesetzt wird:
 * - Tragen ALLE Zeilen bereits exakt `marker`, wird er entfernt (Toggle-Off).
 * - Sonst wird jede Zeile auf `marker` gebracht: ein vorhandener Fremd-Bullet
 *   (`- ` ↔ `* `) wird ERSETZT (Konvertierung), Klartextzeilen bekommen `marker`.
 */
function toggleBulletList(view: EditorView, marker: '- ' | '* '): boolean {
  const range = selectedLineRange(view.state);
  const lines = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    lines.push(view.state.doc.line(n));
  }

  const allHaveMarker = lines.every((line) => line.text.startsWith(marker));
  const changes: DocChange[] = [];
  for (const line of lines) {
    const existing = BULLET_PREFIX.exec(line.text);
    if (allHaveMarker) {
      changes.push({ from: line.from, to: line.from + marker.length, insert: '' });
    } else if (existing) {
      changes.push({ from: line.from, to: line.from + existing[0].length, insert: marker });
    } else {
      changes.push({ from: line.from, to: line.from, insert: marker });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}

/** Ungeordnete Liste mit Spiegelstrich (`- `) ein-/ausschalten (Default, Cmd+L). */
export const unorderedList: SupaCommand = (view) => toggleBulletList(view, '- ');

/** Ungeordnete Liste mit Sternchen (`* `) ein-/ausschalten (Shift+Alt+Cmd+L). */
export const unorderedListStar: SupaCommand = (view) => toggleBulletList(view, '* ');

/** Checkliste (`- [ ] `) je Zeile ein-/ausschalten. */
export const checkList: SupaCommand = (view) => toggleLinePrefix(view, '- [ ] ');

/** Geordnete Liste (`1. `, `2. `, …) fortlaufend setzen bzw. entfernen. */
export const orderedList: SupaCommand = (view) => {
  const range = selectedLineRange(view.state);
  // Wenn ALLE Zeilen bereits nummeriert sind → entfernen.
  let allNumbered = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    if (!/^\d+\. /.test(view.state.doc.line(n).text)) {
      allNumbered = false;
      break;
    }
  }
  const changes: DocChange[] = [];
  let counter = 1;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    if (allNumbered) {
      const match = /^\d+\. /.exec(line.text);
      const len = match ? match[0].length : 0;
      changes.push({ from: line.from, to: line.from + len, insert: '' });
    } else {
      changes.push({ from: line.from, to: line.from, insert: `${counter}. ` });
      counter++;
    }
  }
  view.dispatch({ changes });
  return true;
};

/**
 * Berechnet aus einem erkannten Ist-Präfix das Präfix für die FORTSETZUNGSZEILE:
 * geordnete Listen werden inkrementiert (`3. ` → `4. `), Checklisten starten leer
 * (`- [x] ` → `- [ ] `), ungeordnete bleiben gleich. `null`, wenn kein Listenpräfix.
 */
function continuationPrefix(currentPrefix: string): string | null {
  if (/^- \[[ xX]\] $/.test(currentPrefix)) return '- [ ] ';
  const ordered = /^(\d+)\. $/.exec(currentPrefix);
  if (ordered) return `${Number(ordered[1]) + 1}. `;
  // Bullet-Marker der aktuellen Zeile beibehalten (`* ` oder ein Bestands-`- `).
  if (currentPrefix === '* ' || currentPrefix === '- ') return currentPrefix;
  return null;
}

/**
 * Enter-Handler für Listen: setzt das Präfix in der neuen Zeile fort; ist die
 * aktuelle Listenzeile leer (nur Präfix), wird die Liste beendet (Präfix weg).
 * `false`, wenn die Cursorzeile keine Liste ist (Standard-Enter greift dann).
 *
 * Die Präfix-Erkennung teilt sich mit `cleanBlock` die zentrale `stripLinePrefix`
 * (Task 1); nur die Fortsetzungs-Logik (Inkrement) ist listenspezifisch.
 */
export function continueList(view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.head);
  const stripped = stripLinePrefix(line.text);
  if (stripped === null) return false;
  // Heading/Quote sind zwar Präfixe, aber keine Listen → Standard-Enter.
  const prefix = continuationPrefix(stripped.prefix);
  if (prefix === null) return false;

  if (stripped.rest.length === 0) {
    // Leere Listenzeile → Liste beenden: Präfix entfernen.
    view.dispatch({ changes: { from: line.from, to: line.to, insert: '' } });
    return true;
  }

  view.dispatch({
    changes: { from: sel.head, insert: `\n${prefix}` },
    selection: { anchor: sel.head + 1 + prefix.length },
  });
  return true;
}
```

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/list.ts src/commands/__tests__/list.test.ts
git commit -m "feat(m2): Listen-Commands (ul/ol/check) + Listen-Fortsetzung"
```

---

## Task 5: Link/Bild-Commands (reiner Kern + Wrapper)

**Files:**
- Create: `src/commands/link-image.ts`
- Test: `src/commands/__tests__/link-image.test.ts`

**Interfaces:**
- Consumes: `SupaCommand` (Task 1).
- Produces:
  - `insertLink(url: string, text?: string): SupaCommand`
  - `insertImage(url: string, altText?: string): SupaCommand`
  - `drawLink(view: EditorView): boolean` — Wrapper, holt URL via `window.prompt`.
  - `drawImage(view: EditorView): boolean` — Wrapper, holt URL via `window.prompt`.

- [ ] **Step 1: Failing test schreiben**

Create `src/commands/__tests__/link-image.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { insertLink, insertImage, drawLink } from '../link-image';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('insertLink', () => {
  it('nutzt die Selektion als Linktext (AC-K1)', () => {
    const view = viewWith('Text', 0, 4);
    expect(insertLink('http://x')(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('[Text](http://x)');
    view.destroy();
  });

  it('nutzt das text-Argument ohne Selektion (AC-K2)', () => {
    const view = viewWith('', 0);
    insertLink('http://x', 'Text')(view);
    expect(view.state.doc.toString()).toBe('[Text](http://x)');
    view.destroy();
  });

  it('ist ein No-op bei leerer URL und gibt false zurück (AC-K4)', () => {
    const view = viewWith('abc', 0, 3);
    expect(insertLink('')(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('abc');
    view.destroy();
  });
});

describe('insertImage (AC-K3)', () => {
  it('erzeugt ![alt](url)', () => {
    const view = viewWith('', 0);
    insertImage('http://x', 'alt')(view);
    expect(view.state.doc.toString()).toBe('![alt](http://x)');
    view.destroy();
  });
});

describe('drawLink (Wrapper)', () => {
  it('fragt via prompt und fügt den Link ein', () => {
    const view = viewWith('Text', 0, 4);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue('http://y');
    expect(drawLink(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('[Text](http://y)');
    stub.mockRestore();
    view.destroy();
  });

  it('bricht ab, wenn prompt null liefert', () => {
    const view = viewWith('Text', 0, 4);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(drawLink(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('Text');
    stub.mockRestore();
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/link-image.test.ts`
Expected: FAIL — `Failed to resolve import "../link-image"`.

- [ ] **Step 3: Link/Bild-Commands implementieren**

Create `src/commands/link-image.ts`:

```typescript
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
```

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/link-image.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/link-image.ts src/commands/__tests__/link-image.test.ts
git commit -m "feat(m2): Link/Bild-Commands (reiner Kern insertLink/insertImage + prompt-Wrapper)"
```

---

## Task 6: Tabellen-Command + History-Re-Export

**Files:**
- Create: `src/commands/table.ts`
- Create: `src/commands/history.ts`
- Test: `src/commands/__tests__/table.test.ts`

**Interfaces:**
- Consumes: `SupaCommand` (Task 1), `undo`/`redo` (`@codemirror/commands`).
- Produces:
  - `table: SupaCommand`
  - `undo`, `redo` — re-exportiert (Typ `Command` aus `@codemirror/view`, kompatibel zu `SupaCommand`).

- [ ] **Step 1: Failing test schreiben**

Create `src/commands/__tests__/table.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { table } from '../table';

function viewWith(doc: string, anchor = 0): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor),
  });
  return new EditorView({ state });
}

describe('table (AC-T1)', () => {
  it('fügt ein GFM-Tabellengerüst ein', () => {
    const view = viewWith('', 0);
    expect(table(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      '| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n',
    );
    view.destroy();
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/table.test.ts`
Expected: FAIL — `Failed to resolve import "../table"`.

- [ ] **Step 3: Tabelle + History implementieren**

Create `src/commands/table.ts`:

```typescript
import type { SupaCommand } from './types';

/** Fügt ein GFM-Tabellengerüst (Header, Trennzeile, eine Datenzeile) am Cursor ein. */
export const table: SupaCommand = (view) => {
  const skeleton = '| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n';
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: skeleton },
    selection: { anchor: sel.from + skeleton.length },
  });
  return true;
};
```

Create `src/commands/history.ts`:

```typescript
/**
 * Undo/Redo als dünne Re-Exports über `@codemirror/commands`. Der zugehörige
 * History-State wird über die `history()`-Extension bereitgestellt (siehe
 * `editor/extensions.ts`). Der CM6-`Command`-Typ ist zu `SupaCommand` kompatibel.
 */
export { undo, redo } from '@codemirror/commands';
```

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/table.ts src/commands/history.ts src/commands/__tests__/table.test.ts
git commit -m "feat(m2): table-Command und undo/redo-Re-Export"
```

---

## Task 7: supaKeymap + Extensions-Integration (History & Shortcuts)

**Files:**
- Create: `src/commands/keymap.ts`
- Modify: `src/editor/extensions.ts`
- Test: `src/commands/__tests__/keymap.test.ts`
- Test: `src/editor/__tests__/extensions.test.ts` (ergänzen)

**Interfaces:**
- Consumes: alle Commands (Tasks 2–6), `continueList` (Task 4), `keymap`/`KeyBinding` (`@codemirror/view`), `history`/`historyKeymap`/`defaultKeymap` (`@codemirror/commands`).
- Produces: `supaKeymap: KeyBinding[]`.

- [ ] **Step 1: Failing test für supaKeymap schreiben**

Create `src/commands/__tests__/keymap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { supaKeymap } from '../keymap';

describe('supaKeymap', () => {
  it('enthält die zentralen easyMDE-Default-Shortcuts', () => {
    const keys = supaKeymap.map((b) => b.key ?? b.mac ?? '');
    expect(keys).toContain('Mod-b');
    expect(keys).toContain('Mod-i');
    expect(keys).toContain('Mod-k');
    expect(keys).toContain("Mod-'");
  });

  it('bindet Enter an die Listen-Fortsetzung', () => {
    const enter = supaKeymap.find((b) => b.key === 'Enter');
    expect(enter).toBeDefined();
    expect(typeof enter?.run).toBe('function');
  });

  it('jede Bindung hat eine run-Funktion', () => {
    for (const b of supaKeymap) {
      expect(typeof b.run).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npx vitest run src/commands/__tests__/keymap.test.ts`
Expected: FAIL — `Failed to resolve import "../keymap"`.

- [ ] **Step 3: supaKeymap implementieren**

Create `src/commands/keymap.ts`:

```typescript
import type { KeyBinding } from '@codemirror/view';
import { bold, italic, strikethrough, inlineCode } from './inline';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  cleanBlock,
} from './block';
import { unorderedList, unorderedListStar, orderedList, checkList, continueList } from './list';
import { drawLink, drawImage } from './link-image';

/**
 * Default-Tastenkürzel aus easyMDE (Cmd → CM6 `Mod`, plattformgerecht). Nur die
 * M2-relevanten Aktionen — Preview/SideBySide/Fullscreen (F9/F11/Mod-P) folgen
 * mit ihren Features. `strikethrough`/`inlineCode`/`hr`/`table` haben in easyMDE
 * keinen Default-Shortcut und sind über Command/Toolbar erreichbar.
 */
export const supaKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: bold, preventDefault: true },
  { key: 'Mod-i', run: italic, preventDefault: true },
  { key: 'Mod-k', run: drawLink, preventDefault: true },
  { key: 'Mod-h', run: headingSmaller, preventDefault: true },
  { key: 'Shift-Mod-h', run: headingBigger, preventDefault: true },
  { key: 'Ctrl-Alt-1', run: setHeading(1), preventDefault: true },
  { key: 'Ctrl-Alt-2', run: setHeading(2), preventDefault: true },
  { key: 'Ctrl-Alt-3', run: setHeading(3), preventDefault: true },
  { key: 'Ctrl-Alt-4', run: setHeading(4), preventDefault: true },
  { key: 'Ctrl-Alt-5', run: setHeading(5), preventDefault: true },
  { key: 'Ctrl-Alt-6', run: setHeading(6), preventDefault: true },
  { key: 'Mod-e', run: cleanBlock, preventDefault: true },
  { key: 'Mod-Alt-i', run: drawImage, preventDefault: true },
  { key: "Mod-'", run: quote, preventDefault: true },
  // Zweitkürzel für Blockzitat: Mod-' liegt auf DE-Mac-Tastaturen auf Shift+#
  // und ist dort unzuverlässig. Ctrl-Alt-Q ist layout-unabhängig erreichbar.
  { key: 'Ctrl-Alt-q', run: quote, preventDefault: true },
  { key: 'Mod-Alt-l', run: orderedList, preventDefault: true },
  { key: 'Mod-l', run: unorderedList, preventDefault: true },
  { key: 'Shift-Mod-l', run: checkList, preventDefault: true },
  // Ungeordnete Liste mit Sternchen-Marker (Alternative zum Spiegelstrich-Default).
  { key: 'Shift-Alt-Mod-l', run: unorderedListStar, preventDefault: true },
  { key: 'Mod-Alt-c', run: codeBlock, preventDefault: true },
  // Listen-Fortsetzung: greift nur in Listenzeilen, sonst false → Standard-Enter.
  { key: 'Enter', run: continueList },
];
```

Hinweis zum Typ: Die Command-Signaturen `(view: EditorView) => boolean` sind
identisch mit dem CM6-`Command`-Typ; `setHeading(n)` liefert eine solche
Funktion. Keine Casts nötig.

- [ ] **Step 4: Test ausführen (muss grün sein)**

Run: `npx vitest run src/commands/__tests__/keymap.test.ts`
Expected: PASS.

- [ ] **Step 5: Extensions-Test ergänzen (History + Keymap wirken)**

In `src/editor/__tests__/extensions.test.ts` einen Test ergänzen, der belegt, dass `buildExtensions` History und Keymap enthält (Verhalten statt Struktur). Am Dateiende innerhalb des bestehenden `describe`-Blocks hinzufügen (Imports oben ergänzen: `EditorState`, `EditorView`, `resolveOptions`, `undo`):

```typescript
it('bindet History ein: eine Änderung ist per undo rücknehmbar', async () => {
  const { EditorState } = await import('@codemirror/state');
  const { EditorView } = await import('@codemirror/view');
  const { undo } = await import('@codemirror/commands');
  const { resolveOptions } = await import('../../options');

  const state = EditorState.create({
    doc: 'a',
    extensions: buildExtensions(resolveOptions({})),
  });
  const view = new EditorView({ state });
  view.dispatch({ changes: { from: 1, insert: 'b' } });
  expect(view.state.doc.toString()).toBe('ab');
  undo(view);
  expect(view.state.doc.toString()).toBe('a');
  view.destroy();
});
```

- [ ] **Step 6: `buildExtensions` erweitern**

Modify `src/editor/extensions.ts` — Imports oben ergänzen:

```typescript
import { keymap } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { supaKeymap } from '../commands/keymap';
```

(`keymap` zusätzlich zum bestehenden `EditorView, placeholder`-Import aus `@codemirror/view` aufnehmen.)

Dann im `extensions`-Array (nach `highlightExtension`, vor `supaTheme`) einfügen:

```typescript
    history(),
    keymap.of([...supaKeymap, ...historyKeymap, ...defaultKeymap]),
```

Das Array-Literal sieht danach so aus:

```typescript
  const extensions: Extension[] = [
    markdown({ extensions: GFM }),
    highlightExtension,
    history(),
    keymap.of([...supaKeymap, ...historyKeymap, ...defaultKeymap]),
    supaTheme,
    EditorState.tabSize.of(resolved.tabSize),
    indentUnit.of(' '.repeat(resolved.indentUnit)),
  ];
```

- [ ] **Step 7: Extensions-Test ausführen (muss grün sein)**

Run: `npx vitest run src/editor/__tests__/extensions.test.ts`
Expected: PASS (neuer History-Test grün, bestehende Tests weiterhin grün).

- [ ] **Step 8: Volle Suite + Typecheck + Lint**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alle grün.

- [ ] **Step 9: Commit**

```bash
git add src/commands/keymap.ts src/commands/__tests__/keymap.test.ts src/editor/extensions.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat(m2): supaKeymap + history()/keymap in buildExtensions integrieren"
```

---

## Task 8: example/ — Shortcuts sichtbar machen

**Files:**
- Modify: `example/index.html`

**Interfaces:**
- Consumes: bestehende `SupaMDE`-Fassade (M1) + jetzt aktive Shortcuts (Task 7). Keine neue API nötig — die Shortcuts wirken automatisch über die Extensions.

- [ ] **Step 1: Beschreibung + Shortcut-Hinweis ergänzen**

Modify `example/index.html` — den einleitenden Absatz und Titel auf M2 aktualisieren.

Ersetze:

```html
    <title>SupaMDE — M1 Editor-Kern</title>
```
durch:
```html
    <title>SupaMDE — M2 Aktionen</title>
```

Ersetze:

```html
    <p>M1: Live formatierender CodeMirror-6-Editor. Bearbeite den Markdown-Text unten.</p>
```
durch:
```html
    <p>M2: Live formatierender Editor mit Tastenkürzeln. Probiere
      <kbd>Strg/Cmd</kbd>+<kbd>B</kbd> (fett), <kbd>Strg/Cmd</kbd>+<kbd>I</kbd> (kursiv),
      <kbd>Strg/Cmd</kbd>+<kbd>K</kbd> (Link), <kbd>Strg/Cmd</kbd>+<kbd>'</kbd> (Zitat),
      <kbd>Strg/Cmd</kbd>+<kbd>L</kbd> (Liste), <kbd>Strg/Cmd</kbd>+<kbd>Z</kbd> (undo).
      Enter in einer Listenzeile setzt die Liste fort.</p>
```

- [ ] **Step 2: Build erzeugen und im Dev-Server sichten (manueller Check)**

Run: `npm run build`
Expected: Build grün (das example lädt `../dist/supamde.mjs`).

Danach optional `npm run dev`, im Browser `Strg/Cmd+B` auf markiertem Text testen — Text wird mit `**…**` umschlossen, `Strg/Cmd+Z` nimmt es zurück. (Manuelle Sichtprüfung; kein automatisierter Test.)

- [ ] **Step 3: Commit**

```bash
git add example/index.html
git commit -m "docs(m2): example zeigt Tastenkürzel und Undo/Redo"
```

---

## Task 9: README — Commands & Shortcuts dokumentieren (Abschluss)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nichts (reine Doku). Beschreibt die in M2 verfügbaren Shortcuts.

- [ ] **Step 1: Status-Zeile auf M2 heben**

Modify `README.md` — ersetze den Status-Block:

```markdown
> **Status:** In Entwicklung. Aktueller Meilenstein: **M1 — Editor-Kern**
> (sichtbarer, live formatierender Editor; Wert-API; `toTextArea`).
> Toolbar, Kommandos, Preview und weitere Features folgen in späteren Meilensteinen.
```
durch:
```markdown
> **Status:** In Entwicklung. Aktueller Meilenstein: **M2 — Aktionen**
> (Formatierungs-Commands per Tastenkürzel, Undo/Redo). Die grafische Toolbar,
> Preview und weitere Features folgen in späteren Meilensteinen.
```

- [ ] **Step 2: Shortcuts-Abschnitt einfügen**

Modify `README.md` — nach dem `## API (M1)`-Abschnitt (vor `## Entwicklung`) einfügen:

```markdown
## Tastenkürzel (M2)

Alle Formatierungs-Aktionen sind als CodeMirror-6-Commands umgesetzt und per
Tastenkürzel erreichbar (`Mod` = `Cmd` auf macOS, `Ctrl` sonst). Eine grafische
Toolbar folgt in M3.

| Kürzel | Aktion |
|---|---|
| `Mod-B` | Fett |
| `Mod-I` | Kursiv |
| `Mod-K` | Link |
| `Mod-H` / `Shift-Mod-H` | Überschrift kleiner / größer |
| `Ctrl-Alt-1` … `Ctrl-Alt-6` | Überschrift H1 … H6 |
| `Mod-'` / `Ctrl-Alt-Q` | Blockzitat (Zweitkürzel für DE-Mac-Tastatur) |
| `Mod-L` / `Mod-Alt-L` / `Shift-Mod-L` | Liste (`- `) / nummeriert / Checkliste |
| `Shift-Alt-Mod-L` | Liste mit Sternchen (`* `) |
| `Mod-Alt-C` | Codeblock |
| `Mod-Alt-I` | Bild einfügen |
| `Mod-E` | Blockformat entfernen |
| `Mod-Z` / `Mod-Y` | Rückgängig / Wiederholen |

`Enter` in einer Listenzeile setzt die Liste fort; in einer leeren Listenzeile
beendet es sie. `Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle` sind
als Commands vorhanden und werden mit der Toolbar (M3) auch per Klick erreichbar.
```

- [ ] **Step 3: Konsistenz prüfen (kein automatisierter Test, Sichtprüfung)**

Run: `npx prettier --check README.md`
Expected: „All matched files use Prettier code style!" — falls nicht, `npx prettier --write README.md` und erneut prüfen.

- [ ] **Step 4: Abschließendes Qualitäts-Gate**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: alle grün (Definition of Done M2 erfüllt).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(m2): README um Commands und Tastenkürzel ergänzen"
```

---

## Abschluss

Nach Task 9 ist die Definition of Done (Spec Abschnitt 9) erfüllt: alle Commands außer echtem Bild-Upload implementiert und unit-getestet, `supaKeymap` + `history()` integriert, Akzeptanzkriterien (Abschnitt 8) durch Tests belegt, `example/` demonstriert die Shortcuts, README aktualisiert, alle Gates grün.

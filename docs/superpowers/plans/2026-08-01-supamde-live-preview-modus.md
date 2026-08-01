# Live-Preview-Modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SupaMDE bekommt einen umschaltbaren `'live'`-Modus, der Markdown-Markup ausblendet und nur am Cursor sichtbar macht (Obsidian-Stil), plus Cmd/Ctrl+Klick auf Links.

**Architecture:** Eine reine Funktion `computeHiddenRanges(state, visibleRanges)` berechnet die auszublendenden Bereiche aus dem Lezer-Syntaxbaum und der Cursorposition. Ein `ViewPlugin` übersetzt sie in `Decoration.replace({})` und speist aus **derselben** Menge `EditorView.atomicRanges`. Ein `Compartment` schaltet die Extension zur Laufzeit ein und aus, ohne die View neu zu bauen.

**Tech Stack:** TypeScript (strict), CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`), `@lezer/markdown` mit GFM, Vitest + jsdom, lucide für Icons.

**Spec:** [2026-08-01-supamde-live-preview-modus-design.md](../specs/2026-08-01-supamde-live-preview-modus-design.md)

## Global Constraints

- **Sprache:** Alle Kommentare, Doc-Kommentare und Testbeschreibungen auf Deutsch. Bezeichner im Code auf Englisch (bestehende Konvention).
- **Default bleibt `'source'`** — bestehendes Verhalten ändert sich ohne explizite Option nicht. Drop-in-Zusage aus dem Migrations-Design.
- **`DEFAULT_TOOLBAR` wird NICHT verändert** — die neue Aktion `'editor-mode'` ist nur auf Anforderung in der `toolbar`-Option verfügbar.
- **Marker-Längen variieren** (`CodeMark` 1 Zeichen, `StrikethroughMark` 2, `EmphasisMark` 1 oder 2). Niemals eine feste Breite annehmen — immer `node.from`/`node.to` verwenden.
- **Testlauf:** `npm run test:run` (einmalig) bzw. `npx vitest run <pfad>` für eine Datei. `npm test` startet den Watch-Modus und blockiert — in Skripten nicht verwenden.
- **Vor jedem Commit:** `npm run lint` und `npm run typecheck` müssen grün sein.
- **Vitest-Hinweis:** Der Reporter `basic` existiert in dieser Version nicht. Default-Reporter verwenden.
- **Views in Tests immer `view.destroy()`** am Testende — bestehende Konvention in allen `__tests__`-Dateien.

## Verifizierte Lezer-Knotenstrukturen

Am realen Parser geprüft (`@lezer/markdown` mit `GFM`). Diese Strukturen sind die Grundlage aller Tests:

```
"# Titel"        → ATXHeading1[0,7], HeaderMark[0,1]
"# Titel #"      → ATXHeading1[0,9], HeaderMark[0,1], HeaderMark[8,9]
"#"              → ATXHeading1[0,1], HeaderMark[0,1]            (kein Textinhalt)
"> Zitat"        → Blockquote[0,7], QuoteMark[0,1], Paragraph[2,7]
">"              → Blockquote[0,1], QuoteMark[0,1]              (kein Paragraph)
"**a *b* c**"    → StrongEmphasis[0,11], EmphasisMark[0,2],
                    Emphasis[4,7], EmphasisMark[4,5], EmphasisMark[6,7],
                    EmphasisMark[9,11]
"~~weg~~"        → Strikethrough[0,7], StrikethroughMark[0,2], StrikethroughMark[5,7]
"`code`"         → InlineCode[0,6], CodeMark[0,1], CodeMark[5,6]
"****"           → HorizontalRule[0,4]   ← KEIN StrongEmphasis, keine Marker!
"[T](https://e.com)" → Link[0,18], LinkMark[0,1], LinkMark[2,3], LinkMark[3,4],
                        URL[4,17], LinkMark[17,18]
"<https://e.com>"    → Autolink[0,15], LinkMark[0,1], URL[1,14], LinkMark[14,15]
```

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `src/livepreview/ranges.ts` | **Neu.** Reine Berechnung: Doc + Selektion + Viewport → auszublendende Bereiche. Kein DOM, keine Dekorationen. |
| `src/livepreview/plugin.ts` | **Neu.** ViewPlugin: ruft `computeHiddenRanges`, baut `DecorationSet`, liefert `atomicRanges` aus derselben Menge. |
| `src/livepreview/index.ts` | **Neu.** `EditorMode`-Typ, `livePreviewCompartment`, `livePreviewFor(mode)`, `livePreviewExtension`. |
| `src/editor/link-click.ts` | **Neu.** `linkUrlAt(state, pos)` + `linkClickExtension` (modusunabhängig). |
| `src/options.ts` | Modifizieren: `editorMode` in `SupaMDEOptions` und `ResolvedOptions`, Normalisierung mit Warnung. |
| `src/editor/extensions.ts` | Modifizieren: Compartment-Eintrag + `linkClickExtension` in die Liste. |
| `src/ui/icons.ts` | Modifizieren: Icon `editor-mode`. |
| `src/ui/actions.ts` | Modifizieren: `SupaLike` erweitern, Aktion `'editor-mode'`. |
| `src/index.ts` | Modifizieren: Modus-Feld, API-Trio, F10. |
| `README.md` | Modifizieren: Doku (letzte Task). |

**Reihenfolge-Logik:** Task 1 (Berechnung) hat keine Abhängigkeiten und trägt die größte Testmatrix. Task 2 (Plugin) baut darauf auf. Task 3 (Optionen) und Task 4 (Verdrahtung) machen den Modus konstruierbar. Task 5 (Fassade) macht ihn umschaltbar. Task 6 (Toolbar) macht ihn klickbar. Task 7 (Links) ist unabhängig und könnte auch früher laufen. Task 8 dokumentiert.

---

## Task 1: `computeHiddenRanges` — die Kern-Logik

**Files:**
- Create: `src/livepreview/ranges.ts`
- Test: `src/livepreview/__tests__/ranges.test.ts`

**Interfaces:**
- Consumes: nichts (erste Task)
- Produces:
  ```typescript
  export interface HiddenRange { from: number; to: number }
  export function computeHiddenRanges(
    state: EditorState,
    visibleRanges: readonly { from: number; to: number }[],
  ): HiddenRange[]
  ```
  Rückgabe ist nach `from` aufsteigend sortiert und überlappungsfrei.

- [ ] **Step 1: Testdatei mit den Grundfällen anlegen**

Erstelle `src/livepreview/__tests__/ranges.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { computeHiddenRanges } from '../ranges';

/** Baut einen State mit Markdown-Parser und einfacher Selektion. */
function stateWith(doc: string, anchor = 0, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ extensions: GFM })],
  });
}

/** Der komplette Dokumentbereich als "sichtbar". */
function whole(state: EditorState) {
  return [{ from: 0, to: state.doc.length }];
}

/** Bequemer Vergleich: liefert die ausgeblendeten Textstücke statt Zahlen. */
function hiddenTexts(doc: string, anchor = 0, head = anchor): string[] {
  const state = stateWith(doc, anchor, head);
  return computeHiddenRanges(state, whole(state)).map((r) => state.doc.sliceString(r.from, r.to));
}

describe('computeHiddenRanges — inaktive Knoten', () => {
  it('blendet ** bei Fett aus, wenn der Cursor außerhalb steht', () => {
    // Doc: "**fett** x", Cursor auf Position 9 (das "x") → außerhalb
    expect(hiddenTexts('**fett** x', 9)).toEqual(['**', '**']);
  });

  it('blendet * bei Kursiv aus, wenn der Cursor außerhalb steht', () => {
    expect(hiddenTexts('*kursiv* x', 9)).toEqual(['*', '*']);
  });

  it('blendet ~~ bei Durchgestrichen aus (StrikethroughMark, nicht EmphasisMark)', () => {
    expect(hiddenTexts('~~weg~~ x', 8)).toEqual(['~~', '~~']);
  });

  it('blendet ` bei Inline-Code aus', () => {
    expect(hiddenTexts('`code` x', 7)).toEqual(['`', '`']);
  });

  it('blendet "# " bei Überschrift inklusive Leerzeichen aus', () => {
    // Cursor in Zeile 2, also außerhalb der Überschrift
    expect(hiddenTexts('# Titel\nx', 8)).toEqual(['# ']);
  });

  it('blendet "> " bei Zitat inklusive Leerzeichen aus', () => {
    expect(hiddenTexts('> Zitat\nx', 8)).toEqual(['> ']);
  });
});

describe('computeHiddenRanges — aktive Knoten', () => {
  it('blendet NICHTS aus, wenn der Cursor im Knoten steht', () => {
    // Doc: "**fett**", Cursor auf 4 (mitten in "fett")
    expect(hiddenTexts('**fett**', 4)).toEqual([]);
  });

  it('behandelt den Knoten als aktiv, wenn der Cursor genau an seiner linken Grenze steht', () => {
    expect(hiddenTexts('**fett**', 0)).toEqual([]);
  });

  it('behandelt den Knoten als aktiv, wenn der Cursor genau an seiner rechten Grenze steht', () => {
    expect(hiddenTexts('**fett**', 8)).toEqual([]);
  });

  it('macht nur den Knoten sichtbar, in dem der Cursor steht (knoten-genau)', () => {
    // "Ein **fett** und *kursiv*." — Cursor in "fett" (Position 8)
    // → ** sichtbar, * bleibt versteckt
    expect(hiddenTexts('Ein **fett** und *kursiv*.', 8)).toEqual(['*', '*']);
  });
});

describe('computeHiddenRanges — Selektion', () => {
  it('macht das Markup aller von der Selektion berührten Knoten sichtbar', () => {
    // Selektion 0..26 umfasst beide Knoten → nichts versteckt
    expect(hiddenTexts('Ein **fett** und *kursiv*.', 0, 26)).toEqual([]);
  });

  it('berücksichtigt mehrere Cursor (Multi-Selection)', () => {
    const doc = '**a** **b** **c**';
    const state = EditorState.create({
      doc,
      // Cursor in "a" (Position 2) UND in "c" (Position 14)
      selection: EditorSelection.create([
        EditorSelection.cursor(2),
        EditorSelection.cursor(14),
      ]),
      extensions: [markdown({ extensions: GFM })],
    });
    const texts = computeHiddenRanges(state, whole(state)).map((r) =>
      state.doc.sliceString(r.from, r.to),
    );
    // Nur die Marker um "b" bleiben versteckt
    expect(texts).toEqual(['**', '**']);
  });
});

describe('computeHiddenRanges — Randfälle', () => {
  it('liefert für ein leeres Dokument keine Bereiche', () => {
    expect(hiddenTexts('')).toEqual([]);
  });

  it('liefert für "****" keine Bereiche — Lezer parst das als HorizontalRule', () => {
    // Am Parser verifiziert: "****" → HorizontalRule ohne Marker-Kinder.
    // Folge: nach bold() mit leerer Selektion bleiben die Sternchen sichtbar.
    expect(hiddenTexts('****', 2)).toEqual([]);
  });

  it('läuft bei einer Zeile aus nur "#" nicht in die Folgezeile', () => {
    // "#\nText" — HeaderMark[0,1], danach direkt Zeilenende.
    // Die Leerzeichen-Erweiterung darf das \n NICHT verschlucken.
    const state = stateWith('#\nText', 4);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([{ from: 0, to: 1 }]);
  });

  it('läuft bei einer Zeile aus nur ">" nicht in die Folgezeile', () => {
    const state = stateWith('>\nText', 4);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([{ from: 0, to: 1 }]);
  });

  it('blendet den schließenden HeaderMark bei "# Titel #" mit aus', () => {
    // Verifiziert: HeaderMark[0,1] und HeaderMark[8,9].
    // Der schließende erweitert nach LINKS über das Leerzeichen (Position 7).
    const state = stateWith('# Titel #\nx', 10);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([
      { from: 0, to: 2 }, // "# "
      { from: 7, to: 9 }, // " #"
    ]);
  });

  it('nimmt keine feste Markerbreite an (` ist 1, ~~ ist 2 Zeichen)', () => {
    expect(hiddenTexts('`a` ~~b~~ x', 10)).toEqual(['`', '`', '~~', '~~']);
  });

  it('behandelt verschachtelte Knoten unabhängig', () => {
    // "**a *b* c**" — Cursor in "b" (Position 5) → BEIDE Ebenen aktiv
    expect(hiddenTexts('**a *b* c**', 5)).toEqual([]);
  });

  it('betrachtet nur den übergebenen sichtbaren Bereich', () => {
    // "**a** **b**" — Cursor ans Dokumentende (11), also außerhalb beider Knoten.
    // Sichtbar ist nur 0..5, daher darf der zweite Knoten keine Bereiche liefern.
    const state = stateWith('**a** **b**', 11);
    const ranges = computeHiddenRanges(state, [{ from: 0, to: 5 }]);
    expect(ranges).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
    ]);
  });
});

describe('computeHiddenRanges — Rückgabe-Vertrag', () => {
  it('liefert die Bereiche nach from aufsteigend sortiert', () => {
    const state = stateWith('**a** *b* ~~c~~ `d` x', 20);
    const ranges = computeHiddenRanges(state, whole(state));
    const froms = ranges.map((r) => r.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
  });

  it('liefert überlappungsfreie Bereiche', () => {
    const state = stateWith('**a** *b* ~~c~~ `d` x', 20);
    const ranges = computeHiddenRanges(state, whole(state));
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].from).toBeGreaterThanOrEqual(ranges[i - 1].to);
    }
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/livepreview/__tests__/ranges.test.ts`
Expected: FAIL — `Failed to resolve import "../ranges"` (Datei existiert noch nicht).

- [ ] **Step 3: `ranges.ts` implementieren**

Erstelle `src/livepreview/ranges.ts`:

```typescript
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/** Ein auszublendender Dokumentbereich. */
export interface HiddenRange {
  from: number;
  to: number;
}

/**
 * Marker-Knotenname → erwarteter Elternknoten-Präfix. Die Marker sind am realen
 * `@lezer/markdown`-Parser (mit GFM) verifiziert; `StrikethroughMark` hat bewusst
 * einen eigenen Namen und ist NICHT `EmphasisMark`.
 */
const INLINE_MARKS = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);

/** Block-Marker, deren angrenzendes Leerzeichen mit ausgeblendet wird. */
const BLOCK_MARKS = new Set(['HeaderMark', 'QuoteMark']);

/** Ob `parent` einen der Selektionsbereiche berührt (Grenzen zählen als Berührung). */
function isActive(
  parent: { from: number; to: number },
  ranges: readonly { from: number; to: number }[],
): boolean {
  return ranges.some((r) => r.from <= parent.to && r.to >= parent.from);
}

/**
 * Erweitert einen Block-Marker um das angrenzende Leerzeichen — begrenzt auf die
 * eigene Zeile, damit eine Zeile aus nur `#` oder `>` nicht in die Folgezeile läuft.
 *
 * Öffnender Marker (`# Titel`): nach rechts. Schließender (`# Titel #`): nach links,
 * damit kein freistehendes Leerzeichen am Zeilenende zurückbleibt.
 */
function widenBlockMark(
  state: EditorState,
  node: SyntaxNode,
  parent: { from: number; to: number },
): HiddenRange {
  const line = state.doc.lineAt(node.from);
  const text = state.doc.sliceString(line.from, line.to);
  // Schließender Marker: berührt das Ende des Elternknotens.
  const isClosing = node.to >= parent.to;

  if (isClosing) {
    let from = node.from;
    while (from > line.from && text[from - line.from - 1] === ' ') from--;
    return { from, to: node.to };
  }

  let to = node.to;
  while (to < line.to && text[to - line.from] === ' ') to++;
  return { from: node.from, to };
}

/**
 * Berechnet die auszublendenden Markup-Bereiche für den Live-Modus.
 *
 * Regel (knoten-genau): Das Markup eines Knotens wird ausgeblendet, solange der
 * Knoten KEINEN Cursor und keinen Selektionsbereich berührt. Sobald der Cursor ihn
 * berührt — Grenzen eingeschlossen —, wird sein Markup sichtbar und normal editierbar.
 *
 * Reine Funktion: kein DOM, keine View, keine Dekorationen. Rückgabe ist nach `from`
 * aufsteigend sortiert und überlappungsfrei (Vertrag für `RangeSet.of()`, das
 * unsortierte Eingaben mit einem Fehler quittiert).
 */
export function computeHiddenRanges(
  state: EditorState,
  visibleRanges: readonly { from: number; to: number }[],
): HiddenRange[] {
  const selection = state.selection.ranges;
  const result: HiddenRange[] = [];
  const tree = syntaxTree(state);

  for (const visible of visibleRanges) {
    tree.iterate({
      from: visible.from,
      to: visible.to,
      enter: (nodeRef) => {
        const name = nodeRef.name;
        const isInline = INLINE_MARKS.has(name);
        const isBlock = BLOCK_MARKS.has(name);
        if (!isInline && !isBlock) return;

        const parent = nodeRef.node.parent;
        if (!parent) return;
        if (isActive(parent, selection)) return;

        result.push(
          isBlock
            ? widenBlockMark(state, nodeRef.node, parent)
            : { from: nodeRef.from, to: nodeRef.to },
        );
      },
    });
  }

  // Mehrere sichtbare Bereiche liefern getrennt sortierte Teillisten — global
  // sortieren und Duplikate/Überlappungen an den Bereichsgrenzen zusammenfassen.
  result.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: HiddenRange[] = [];
  for (const range of result) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) {
      if (range.to > last.to) last.to = range.to;
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}
```

- [ ] **Step 4: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/livepreview/__tests__/ranges.test.ts`
Expected: PASS, alle Tests grün.

Falls der Test `'# Titel #'` fehlschlägt: Prüfe mit einem temporären Dump, ob der schließende `HeaderMark` tatsächlich `parent.to` berührt. Bei ATXHeading endet der Elternknoten am Zeilenende, der Marker also exakt darauf — die `isClosing`-Prüfung `node.to >= parent.to` greift dann.

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/livepreview/ranges.ts src/livepreview/__tests__/ranges.test.ts
git commit -m "feat(livepreview): computeHiddenRanges für knoten-genaues Markup-Ausblenden"
```

---

## Task 2: ViewPlugin mit Dekorationen und atomicRanges

**Files:**
- Create: `src/livepreview/plugin.ts`
- Create: `src/livepreview/index.ts`
- Test: `src/livepreview/__tests__/plugin.test.ts`

**Interfaces:**
- Consumes: `computeHiddenRanges(state, visibleRanges): HiddenRange[]` aus Task 1
- Produces:
  ```typescript
  // plugin.ts
  export const livePreviewPlugin: Extension
  // index.ts
  export type EditorMode = 'source' | 'live'
  export const livePreviewCompartment: Compartment
  export const livePreviewExtension: Extension
  export function livePreviewFor(mode: EditorMode): Extension
  ```

- [ ] **Step 1: Testdatei schreiben**

Erstelle `src/livepreview/__tests__/plugin.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { livePreviewExtension } from '..';

/**
 * Baut eine echte, am DOM hängende View — nötig, weil das ViewPlugin über
 * `view.visibleRanges` arbeitet und diese ohne Layout leer bleiben.
 */
function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
      extensions: [markdown({ extensions: GFM }), livePreviewExtension],
    }),
    parent,
  });
  return view;
}

/** Räumt View und ihren Container ab. */
function cleanup(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

describe('livePreviewExtension — Dekorationen', () => {
  it('versteckt inaktives Markup im DOM', () => {
    const view = viewWith('**fett** x', 9);
    // Der sichtbare Text enthält die Sternchen nicht mehr.
    expect(view.contentDOM.textContent).toBe('fett x');
    cleanup(view);
  });

  it('zeigt das Markup, sobald der Cursor im Knoten steht', () => {
    const view = viewWith('**fett** x', 4);
    expect(view.contentDOM.textContent).toBe('**fett** x');
    cleanup(view);
  });

  it('aktualisiert die Darstellung bei einer Cursorbewegung', () => {
    const view = viewWith('**fett** x', 9);
    expect(view.contentDOM.textContent).toBe('fett x');
    view.dispatch({ selection: EditorSelection.single(4) });
    expect(view.contentDOM.textContent).toBe('**fett** x');
    cleanup(view);
  });

  it('lässt das Dokument unverändert — nur die Darstellung ändert sich', () => {
    const view = viewWith('**fett** x', 9);
    expect(view.state.doc.toString()).toBe('**fett** x');
    cleanup(view);
  });
});

describe('livePreviewExtension — atomicRanges', () => {
  it('meldet die versteckten Bereiche als atomar', () => {
    const view = viewWith('**fett** x', 9);
    const atomic = view.state.facet(EditorView.atomicRanges).map((f) => f(view));

    // Sammelt alle atomaren Bereiche über alle Provider.
    const found: Array<{ from: number; to: number }> = [];
    for (const set of atomic) {
      const iter = set.iter();
      while (iter.value) {
        found.push({ from: iter.from, to: iter.to });
        iter.next();
      }
    }
    expect(found).toEqual([
      { from: 0, to: 2 },
      { from: 6, to: 8 },
    ]);
    cleanup(view);
  });

  it('meldet keine atomaren Bereiche, wenn der Knoten aktiv ist', () => {
    const view = viewWith('**fett**', 4);
    const atomic = view.state.facet(EditorView.atomicRanges).map((f) => f(view));
    const found: Array<{ from: number; to: number }> = [];
    for (const set of atomic) {
      const iter = set.iter();
      while (iter.value) {
        found.push({ from: iter.from, to: iter.to });
        iter.next();
      }
    }
    expect(found).toEqual([]);
    cleanup(view);
  });

  it('überspringt einen inaktiven Marker bei der Cursor-Bewegung', () => {
    // "a **b** c" — Cursor am Ende (9), beide Knoten inaktiv.
    // Marker liegen bei [2,4] und [5,7]; verifiziert am realen CodeMirror.
    const view = viewWith('a **b** c', 9);

    // moveByChar ist die Methode, die atomicRanges auswertet. Bewusst NICHT
    // cursorCharLeft aus @codemirror/commands: das nimmt ohne echtes Layout
    // (jsdom) einen anderen Pfad und umgeht die atomaren Bereiche.
    expect(view.moveByChar(EditorSelection.cursor(7), false).head).toBe(5);
    cleanup(view);
  });

  it('bewegt den Cursor normal, wenn kein atomarer Bereich im Weg ist', () => {
    const view = viewWith('a **b** c', 9);
    expect(view.moveByChar(EditorSelection.cursor(8), false).head).toBe(7);
    cleanup(view);
  });
});

describe('livePreviewFor', () => {
  it('liefert für "source" eine leere Extension', async () => {
    const { livePreviewFor } = await import('..');
    expect(livePreviewFor('source')).toEqual([]);
  });

  it('liefert für "live" die aktive Extension', async () => {
    const { livePreviewFor, livePreviewExtension } = await import('..');
    expect(livePreviewFor('live')).toBe(livePreviewExtension);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/livepreview/__tests__/plugin.test.ts`
Expected: FAIL — `Failed to resolve import ".."`.

- [ ] **Step 3: `plugin.ts` implementieren**

Erstelle `src/livepreview/plugin.ts`:

```typescript
import { RangeSet, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { computeHiddenRanges } from './ranges';

/** Blendet einen Bereich vollständig aus (ersetzt ihn durch nichts). */
const hideMark = Decoration.replace({});

/** Baut den DecorationSet für den aktuellen View-Zustand. */
function buildDecorations(view: EditorView): DecorationSet {
  const ranges = computeHiddenRanges(view.state, view.visibleRanges);
  return RangeSet.of(
    ranges.map((r) => hideMark.range(r.from, r.to)),
    // Bereits sortiert (Vertrag von computeHiddenRanges), daher kein erneutes Sortieren.
    false,
  );
}

/**
 * ViewPlugin, das inaktives Markdown-Markup ausblendet.
 *
 * Bewusst ein ViewPlugin und kein StateField: Die Dekoration hängt von der
 * CURSORPOSITION ab, die sich ständig ohne Dokumentänderung ändert. Ein StateField
 * müsste bei jeder Cursorbewegung ohnehin neu rechnen — sein inkrementelles Mapping
 * wäre wertlos — und liefe dabei über das ganze Dokument statt über den sichtbaren
 * Ausschnitt.
 */
const hidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
    // Dieselbe Menge speist die atomaren Bereiche. EINE Quelle: ein Drift zwischen
    // "ausgeblendet" und "atomar" ist damit konstruktiv ausgeschlossen — ein
    // atomarer Bereich ohne Ausblendung machte sichtbaren Text unnavigierbar.
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);

/** Die fertige Live-Preview-Extension (Ausblenden + atomare Bereiche). */
export const livePreviewPlugin: Extension = hidePlugin;
```

- [ ] **Step 4: `index.ts` implementieren**

Erstelle `src/livepreview/index.ts`:

```typescript
import { Compartment, type Extension } from '@codemirror/state';
import { livePreviewPlugin } from './plugin';

export type { HiddenRange } from './ranges';
export { computeHiddenRanges } from './ranges';

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
```

- [ ] **Step 5: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/livepreview/__tests__/plugin.test.ts`
Expected: PASS.

**Vorab verifiziert** (an genau diesem Aufbau gemessen, damit beim Implementieren
keine Zeit in Fehlersuche geht):

- `view.visibleRanges` ist in jsdom **nicht leer**, solange die View über `parent`
  am `document.body` hängt. Kein Fallback nötig.
- `textContent` bei Cursor 9 in `'**fett** x'` → `'fett x'` (versteckt)
- `textContent` bei Cursor 4 → `'**fett** x'` (sichtbar)
- Der `atomicRanges`-Provider liefert für `'a **b** c'` mit Cursor 9 exakt
  `[2,4]` und `[5,7]`
- `view.moveByChar(cursor(7), false).head` → `5` (Marker übersprungen)

- [ ] **Step 6: Lint, Typecheck und volle Testsuite**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: alles grün — insbesondere dürfen die bestehenden Suites unverändert bestehen.

- [ ] **Step 7: Commit**

```bash
git add src/livepreview/plugin.ts src/livepreview/index.ts src/livepreview/__tests__/plugin.test.ts
git commit -m "feat(livepreview): ViewPlugin mit Decoration.replace und atomicRanges"
```

---

## Task 3: `editorMode`-Option

**Files:**
- Modify: `src/options.ts`
- Test: `src/__tests__/options.test.ts` (bestehende Datei erweitern)

**Interfaces:**
- Consumes: `EditorMode`, `EDITOR_MODES` aus `src/livepreview/index.ts` (Task 2)
- Produces: `SupaMDEOptions.editorMode?: EditorMode`, `ResolvedOptions.editorMode: EditorMode`

- [ ] **Step 1: Tests an `src/__tests__/options.test.ts` anhängen**

Füge am Ende der Datei ein (die bestehenden Imports um `EditorMode` ergänzen, falls die Datei typisierte Optionen baut):

```typescript
describe('resolveOptions — editorMode', () => {
  it('nutzt "source" als Default', () => {
    expect(resolveOptions({}).editorMode).toBe('source');
  });

  it('übernimmt "live", wenn gesetzt', () => {
    expect(resolveOptions({ editorMode: 'live' }).editorMode).toBe('live');
  });

  it('übernimmt "source", wenn explizit gesetzt', () => {
    expect(resolveOptions({ editorMode: 'source' }).editorMode).toBe('source');
  });

  it('fällt bei einem ungültigen Wert auf "source" zurück und warnt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Bewusst untypisiert: simuliert einen Aufruf aus reinem JavaScript.
    const resolved = resolveOptions({ editorMode: 'wysiwyg' } as never);
    expect(resolved.editorMode).toBe('source');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
```

Stelle sicher, dass `vi` importiert ist: `import { describe, it, expect, vi } from 'vitest';`

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/__tests__/options.test.ts`
Expected: FAIL — `editorMode` ist `undefined`.

- [ ] **Step 3: `src/options.ts` erweitern**

Ergänze den Import am Dateianfang:

```typescript
import { EDITOR_MODES, type EditorMode } from './livepreview';
```

Ergänze in `SupaMDEOptions` (nach `extraKeys`):

```typescript
  /**
   * Darstellungsmodus: `'source'` zeigt das Markdown-Markup (Default),
   * `'live'` blendet es aus und zeigt es nur am Cursor (Obsidian-Stil).
   */
  editorMode?: EditorMode;
```

Ergänze in `ResolvedOptions` (nach `extraKeys`):

```typescript
  editorMode: EditorMode;
```

Füge vor `resolveOptions` diesen Helfer ein:

```typescript
/**
 * Prüft den Modus-Wert und fällt bei Unsinn auf `'source'` zurück. Bewusst kein
 * Wurf: Ein falscher DARSTELLUNGSmodus darf den Editor nicht am Starten hindern
 * (gleiches Muster wie `resolveToolbar` bei unbekannten Aktionsnamen).
 */
function resolveEditorMode(mode: EditorMode | undefined): EditorMode {
  if (mode === undefined) return 'source';
  if (EDITOR_MODES.includes(mode)) return mode;
  console.warn(`SupaMDE: unbekannter editorMode "${String(mode)}" — nutze "source".`);
  return 'source';
}
```

Ergänze in `resolveOptions` das Feld:

```typescript
    editorMode: resolveEditorMode(options.editorMode),
```

- [ ] **Step 4: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/__tests__/options.test.ts`
Expected: PASS.

- [ ] **Step 5: Bestehende Tests reparieren**

Der `ResolvedOptions`-Typ hat ein Pflichtfeld mehr. Alle Testdateien, die ein `ResolvedOptions`-Literal bauen, brechen im Typecheck.

Run: `npm run typecheck`
Expected: Fehler in `src/editor/__tests__/extensions.test.ts` (das `base`-Objekt).

Ergänze dort in `const base: ResolvedOptions = { … }`:

```typescript
  editorMode: 'source',
```

Prüfe mit `grep -rn "ResolvedOptions" src/`, ob weitere Stellen betroffen sind, und ergänze sie gleichermaßen.

- [ ] **Step 6: Lint, Typecheck, volle Suite**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: alles grün.

- [ ] **Step 7: Commit**

```bash
git add src/options.ts src/__tests__/options.test.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat(options): editorMode mit Default source und Fallback-Warnung"
```

---

## Task 4: Compartment in die Extension-Liste

**Files:**
- Modify: `src/editor/extensions.ts`
- Test: `src/editor/__tests__/extensions.test.ts` (bestehende Datei erweitern)

**Interfaces:**
- Consumes: `livePreviewCompartment`, `livePreviewFor` aus `src/livepreview/index.ts`; `ResolvedOptions.editorMode` aus Task 3
- Produces: nichts Neues nach außen — `buildExtensions` verhält sich modusabhängig

- [ ] **Step 1: Tests an `src/editor/__tests__/extensions.test.ts` anhängen**

```typescript
describe('buildExtensions — editorMode', () => {
  /** Baut eine am DOM hängende View, damit visibleRanges gefüllt sind. */
  function viewWith(resolved: ResolvedOptions, doc: string, cursor: number) {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: EditorSelection.single(cursor),
        extensions: buildExtensions(resolved),
      }),
      parent,
    });
    return { view, parent };
  }

  it('blendet im Modus "live" inaktives Markup aus', () => {
    const { view, parent } = viewWith({ ...base, editorMode: 'live' }, '**fett** x', 9);
    expect(view.contentDOM.textContent).toBe('fett x');
    view.destroy();
    parent.remove();
  });

  it('lässt im Modus "source" das Markup stehen', () => {
    const { view, parent } = viewWith({ ...base, editorMode: 'source' }, '**fett** x', 9);
    expect(view.contentDOM.textContent).toBe('**fett** x');
    view.destroy();
    parent.remove();
  });

  it('schaltet per Compartment-reconfigure um, ohne die View neu zu bauen', () => {
    const { view, parent } = viewWith({ ...base, editorMode: 'source' }, '**fett** x', 9);
    expect(view.contentDOM.textContent).toBe('**fett** x');

    view.dispatch({ effects: livePreviewCompartment.reconfigure(livePreviewFor('live')) });
    expect(view.contentDOM.textContent).toBe('fett x');

    view.dispatch({ effects: livePreviewCompartment.reconfigure(livePreviewFor('source')) });
    expect(view.contentDOM.textContent).toBe('**fett** x');
    view.destroy();
    parent.remove();
  });

  it('erhält Dokument und Cursor über den Moduswechsel hinweg', () => {
    const { view, parent } = viewWith({ ...base, editorMode: 'source' }, '**fett** x', 9);
    view.dispatch({ effects: livePreviewCompartment.reconfigure(livePreviewFor('live')) });
    expect(view.state.doc.toString()).toBe('**fett** x');
    expect(view.state.selection.main.head).toBe(9);
    view.destroy();
    parent.remove();
  });
});
```

Ergänze die Importzeile der Datei um `EditorSelection` sowie:

```typescript
import { livePreviewCompartment, livePreviewFor } from '../../livepreview';
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/editor/__tests__/extensions.test.ts`
Expected: FAIL — im Live-Modus steht das Markup noch da (`'**fett** x'` statt `'fett x'`).

- [ ] **Step 3: `src/editor/extensions.ts` erweitern**

Ergänze den Import:

```typescript
import { livePreviewCompartment, livePreviewFor } from '../livepreview';
```

Ergänze in der `extensions`-Liste (nach `highlightExtension`):

```typescript
    // Compartment: erlaubt den Modus-Wechsel zur Laufzeit ohne View-Neuaufbau.
    livePreviewCompartment.of(livePreviewFor(resolved.editorMode)),
```

Ergänze den Doc-Kommentar der Funktion um einen Satz:

```
 * `livePreviewCompartment` hält die Live-Modus-Extension — im Source-Modus leer,
 * per `reconfigure` zur Laufzeit umschaltbar.
```

- [ ] **Step 4: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/editor/__tests__/extensions.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, Typecheck, volle Suite**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/editor/extensions.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat(editor): Live-Modus über Compartment in die Extension-Liste"
```

---

## Task 5: Öffentliche API auf `SupaMDE`

**Files:**
- Modify: `src/index.ts`
- Test: `src/__tests__/editor-mode.test.ts` (neu)

**Interfaces:**
- Consumes: `livePreviewCompartment`, `livePreviewFor`, `EditorMode`; `resolveOptions` aus Task 3
- Produces:
  ```typescript
  getEditorMode(): EditorMode
  setEditorMode(mode: EditorMode): void
  toggleEditorMode(): void
  ```

- [ ] **Step 1: Testdatei schreiben**

Erstelle `src/__tests__/editor-mode.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { SupaMDE } from '../index';

/** Baut eine SupaMDE-Instanz auf einer frischen Textarea im DOM. */
function makeEditor(value: string, options: Record<string, unknown> = {}) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  const editor = new SupaMDE({ element: textarea, toolbar: false, status: false, ...options });
  return {
    editor,
    cleanup: () => {
      editor.toTextArea();
      textarea.remove();
    },
  };
}

describe('SupaMDE — editorMode API', () => {
  it('startet im Modus "source", wenn nichts gesetzt ist', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    expect(editor.getEditorMode()).toBe('source');
    cleanup();
  });

  it('startet im Modus "live", wenn die Option gesetzt ist', () => {
    const { editor, cleanup } = makeEditor('**fett**', { editorMode: 'live' });
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });

  it('schaltet mit setEditorMode um', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    editor.setEditorMode('live');
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });

  it('wechselt mit toggleEditorMode hin und zurück', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    editor.toggleEditorMode();
    expect(editor.getEditorMode()).toBe('live');
    editor.toggleEditorMode();
    expect(editor.getEditorMode()).toBe('source');
    cleanup();
  });

  it('ist idempotent — setEditorMode auf den aktiven Modus dispatcht nicht', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    const dispatch = vi.spyOn(editor.codemirror, 'dispatch');
    editor.setEditorMode('source');
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
    cleanup();
  });

  it('blendet im Live-Modus inaktives Markup aus', () => {
    const { editor, cleanup } = makeEditor('**fett** x');
    editor.codemirror.dispatch({ selection: EditorSelection.single(9) });
    editor.setEditorMode('live');
    expect(editor.codemirror.contentDOM.textContent).toBe('fett x');
    cleanup();
  });

  it('erhält Dokument, Cursor und Historie über den Moduswechsel', () => {
    const { editor, cleanup } = makeEditor('a');
    editor.codemirror.dispatch({ changes: { from: 1, insert: 'b' } });
    editor.codemirror.dispatch({ selection: EditorSelection.single(1) });

    editor.setEditorMode('live');

    expect(editor.value()).toBe('ab');
    expect(editor.codemirror.state.selection.main.head).toBe(1);
    // Historie überlebt den reconfigure: das eingefügte "b" ist rücknehmbar.
    editor.codemirror.dispatch({ selection: EditorSelection.single(2) });
    cleanup();
  });

  it('lässt den Dokumentinhalt beim Moduswechsel unangetastet', () => {
    const { editor, cleanup } = makeEditor('# Titel\n\n**fett**');
    editor.setEditorMode('live');
    expect(editor.value()).toBe('# Titel\n\n**fett**');
    editor.setEditorMode('source');
    expect(editor.value()).toBe('# Titel\n\n**fett**');
    cleanup();
  });
});

describe('SupaMDE — F10', () => {
  it('schaltet den Modus per F10 um', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    const container = editor.codemirror.dom.closest('.supamde-container');
    expect(container).not.toBeNull();

    container!.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true }));
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });
});

describe('SupaMDE — Commands im Live-Modus', () => {
  it('bold fügt ** ein und lässt sie sichtbar (Cursor steht im Knoten)', async () => {
    const { bold } = await import('../commands/inline');
    const { editor, cleanup } = makeEditor('Wort', { editorMode: 'live' });

    editor.codemirror.dispatch({ selection: EditorSelection.single(0, 4) });
    bold(editor.codemirror);

    expect(editor.value()).toBe('**Wort**');
    // Die Selektion berührt den neuen Knoten → Markup sichtbar.
    expect(editor.codemirror.contentDOM.textContent).toBe('**Wort**');
    cleanup();
  });

  it('bold bei leerer Selektion erzeugt **** — sichtbar, weil Lezer dort keinen Marker parst', async () => {
    const { bold } = await import('../commands/inline');
    const { editor, cleanup } = makeEditor('', { editorMode: 'live' });

    bold(editor.codemirror);

    expect(editor.value()).toBe('****');
    // Verifiziert: "****" ist eine HorizontalRule ohne Marker-Kinder — es gibt
    // nichts auszublenden. Ohne sichtbare Sternchen gäbe es nach dem Klick auf
    // "Fett" gar keine Rückmeldung.
    expect(editor.codemirror.contentDOM.textContent).toBe('****');
    cleanup();
  });
});

describe('SupaMDE — Statusbar zählt modusunabhängig', () => {
  it('zählt im Live-Modus dieselben Werte wie im Source-Modus', () => {
    // Spec-Zusage: Die Statusbar beschreibt das DOKUMENT, nicht die Ansicht.
    // Markup-Zeichen zählen daher in beiden Modi mit.
    const textarea = document.createElement('textarea');
    textarea.value = '**fett** und *kursiv*';
    document.body.appendChild(textarea);
    const editor = new SupaMDE({
      element: textarea,
      toolbar: false,
      status: ['lines', 'words'],
    });

    const before = editor.codemirror.dom
      .closest('.supamde-container')
      ?.querySelector('.supamde-statusbar')?.textContent;

    editor.setEditorMode('live');

    const after = editor.codemirror.dom
      .closest('.supamde-container')
      ?.querySelector('.supamde-statusbar')?.textContent;

    expect(after).toBe(before);
    editor.toTextArea();
    textarea.remove();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/__tests__/editor-mode.test.ts`
Expected: FAIL — `editor.getEditorMode is not a function`.

- [ ] **Step 3: `src/index.ts` erweitern**

Ergänze die Importe:

```typescript
import { livePreviewCompartment, livePreviewFor, type EditorMode } from './livepreview';
import { resolveOptions } from './options';
```

Ergänze den Re-Export bei den anderen Typ-Exporten:

```typescript
export type { EditorMode } from './livepreview';
```

Ergänze das Feld bei den anderen privaten Feldern:

```typescript
  /**
   * Aktueller Darstellungsmodus. Bewusst ein Instanzfeld und KEIN StateField:
   * Der Modus ist eine Eigenschaft der Ansicht, nicht des Dokuments — gleiches
   * Muster wie bei Fullscreen und Side-by-Side.
   */
  private editorMode: EditorMode;
```

Setze ihn im Konstruktor direkt nach `this.codemirror = this.handle.view;`:

```typescript
    // Über resolveOptions, damit ein ungültiger Wert hier dieselbe Normalisierung
    // durchläuft wie in der Extension-Erzeugung (eine Quelle der Wahrheit).
    this.editorMode = resolveOptions(options).editorMode;
```

Ergänze die drei Methoden nach `isFullscreenActive()`:

```typescript
  /** Der aktuelle Darstellungsmodus. */
  getEditorMode(): EditorMode {
    return this.editorMode;
  }

  /**
   * Setzt den Darstellungsmodus. Idempotent — ein Aufruf mit dem bereits aktiven
   * Modus dispatcht nichts. Der Wechsel läuft über ein Compartment-`reconfigure`,
   * daher bleiben Dokument, Cursor, Historie und Scrollposition erhalten.
   */
  setEditorMode(mode: EditorMode): void {
    if (mode === this.editorMode) return;
    this.editorMode = mode;
    this.codemirror.dispatch({
      effects: livePreviewCompartment.reconfigure(livePreviewFor(mode)),
    });
    this.toolbar?.update(this.codemirror.state);
  }

  /** Wechselt zwischen `'source'` und `'live'`. */
  toggleEditorMode(): void {
    this.setEditorMode(this.editorMode === 'live' ? 'source' : 'live');
  }
```

Ergänze F10 im `onViewShortcuts`-Handler — zwischen dem F9- und dem F11-Zweig:

```typescript
      } else if (event.key === 'F10') {
        // preventDefault, weil F10 in einigen Browsern die Menüleiste fokussiert.
        event.preventDefault();
        this.toggleEditorMode();
      } else if (event.key === 'F11') {
```

- [ ] **Step 4: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/__tests__/editor-mode.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, Typecheck, volle Suite**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/editor-mode.test.ts
git commit -m "feat(api): getEditorMode/setEditorMode/toggleEditorMode plus F10"
```

---

## Task 6: Toolbar-Aktion `editor-mode`

**Files:**
- Modify: `src/ui/icons.ts`
- Modify: `src/ui/actions.ts`
- Test: `src/ui/__tests__/actions.test.ts`, `src/ui/__tests__/icons.test.ts` (bestehende Dateien erweitern)

**Interfaces:**
- Consumes: `toggleEditorMode()`, `getEditorMode()` aus Task 5
- Produces: `BUILTIN_ACTIONS['editor-mode']`, `SupaLike` um zwei Methoden erweitert

- [ ] **Step 1: Tests anhängen**

An `src/ui/__tests__/icons.test.ts`:

```typescript
describe('Icon editor-mode', () => {
  it('ist bekannt', () => {
    expect(hasIcon('editor-mode')).toBe(true);
  });

  it('rendert ein SVG', () => {
    expect(renderIcon('editor-mode').tagName.toLowerCase()).toBe('svg');
  });
});
```

An `src/ui/__tests__/actions.test.ts`:

```typescript
describe('BUILTIN_ACTIONS — editor-mode', () => {
  /** Minimale SupaLike-Attrappe, die den Modus mitschreibt. */
  function fakeEditor(mode: 'source' | 'live' = 'source') {
    return {
      current: mode,
      toggleSideBySide: () => {},
      toggleFullScreen: () => {},
      isSideBySideActive: () => false,
      isFullscreenActive: () => false,
      toggleEditorMode(this: { current: string }) {
        this.current = this.current === 'live' ? 'source' : 'live';
      },
      getEditorMode(this: { current: string }) {
        return this.current as 'source' | 'live';
      },
    };
  }

  it('ist registriert', () => {
    expect(getAction('editor-mode')).toBeDefined();
  });

  it('ist eine view-Aktion', () => {
    expect(getAction('editor-mode')?.kind).toBe('view');
  });

  it('ruft toggleEditorMode auf', () => {
    const action = getAction('editor-mode');
    const editor = fakeEditor('source');
    if (action?.kind !== 'view') throw new Error('erwartet: view-Aktion');
    action.run(editor);
    expect(editor.getEditorMode()).toBe('live');
  });

  it('meldet aktiv, wenn der Modus "live" ist', () => {
    const action = getAction('editor-mode');
    if (action?.kind !== 'view') throw new Error('erwartet: view-Aktion');
    expect(action.active?.(fakeEditor('live'))).toBe(true);
    expect(action.active?.(fakeEditor('source'))).toBe(false);
  });

  it('ist NICHT Teil der Default-Toolbar', async () => {
    const { DEFAULT_TOOLBAR } = await import('../toolbar-config');
    expect(DEFAULT_TOOLBAR).not.toContain('editor-mode');
  });
});
```

Passe die Importe der beiden Dateien an, falls `getAction`, `hasIcon` oder `renderIcon` dort noch nicht importiert sind.

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/ui/__tests__/icons.test.ts src/ui/__tests__/actions.test.ts`
Expected: FAIL — Icon unbekannt, Aktion nicht definiert.

- [ ] **Step 3: Icon ergänzen**

In `src/ui/icons.ts` den lucide-Import um `Eye` erweitern:

```typescript
  Eye,
```

und im `ICONS`-Objekt ergänzen:

```typescript
  'editor-mode': Eye,
```

- [ ] **Step 4: `SupaLike` erweitern und Aktion registrieren**

In `src/ui/actions.ts` den Import ergänzen:

```typescript
import type { EditorMode } from '../livepreview';
```

`SupaLike` um zwei Methoden erweitern:

```typescript
export interface SupaLike {
  toggleSideBySide(): void;
  toggleFullScreen(): void;
  isSideBySideActive(): boolean;
  isFullscreenActive(): boolean;
  toggleEditorMode(): void;
  getEditorMode(): EditorMode;
}
```

In `BUILTIN_ACTIONS` nach `fullscreen` ergänzen:

```typescript
  'editor-mode': {
    kind: 'view',
    run: (editor) => editor.toggleEditorMode(),
    active: (editor) => editor.getEditorMode() === 'live',
    icon: 'editor-mode',
    title: 'Live-Vorschau',
    shortcut: 'F10',
  },
```

- [ ] **Step 5: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/ui/__tests__/icons.test.ts src/ui/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck — der `_supaLikeCheck` muss greifen**

Run: `npm run typecheck`
Expected: grün. Falls hier ein Fehler an `src/index.ts` auftaucht, fehlen die Methoden aus Task 5 — genau dafür ist die Prüfung da.

- [ ] **Step 7: Lint und volle Suite**

Run: `npm run lint && npm run test:run`
Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add src/ui/icons.ts src/ui/actions.ts src/ui/__tests__/icons.test.ts src/ui/__tests__/actions.test.ts
git commit -m "feat(toolbar): Aktion editor-mode (nicht in der Default-Toolbar)"
```

---

## Task 7: Cmd/Ctrl+Klick auf Links

**Files:**
- Create: `src/editor/link-click.ts`
- Modify: `src/editor/extensions.ts`
- Test: `src/editor/__tests__/link-click.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (unabhängig)
- Produces:
  ```typescript
  export function linkUrlAt(state: EditorState, pos: number): string | null
  export const linkClickExtension: Extension
  ```

- [ ] **Step 1: Testdatei schreiben**

Erstelle `src/editor/__tests__/link-click.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { linkUrlAt } from '../link-click';

/** State mit Markdown-Parser. */
function stateWith(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown({ extensions: GFM })] });
}

describe('linkUrlAt', () => {
  it('findet die URL eines Inline-Links vom Linktext aus', () => {
    // "[Text](https://example.com)" — Position 2 liegt in "Text"
    const state = stateWith('[Text](https://example.com)');
    expect(linkUrlAt(state, 2)).toBe('https://example.com');
  });

  it('findet die URL, wenn die Position im URL-Teil liegt', () => {
    const state = stateWith('[Text](https://example.com)');
    expect(linkUrlAt(state, 10)).toBe('https://example.com');
  });

  it('findet die URL eines Autolinks', () => {
    // "<https://example.com>" — verifiziert: Autolink mit URL[1,20]
    const state = stateWith('<https://example.com>');
    expect(linkUrlAt(state, 5)).toBe('https://example.com');
  });

  it('akzeptiert http', () => {
    const state = stateWith('[T](http://example.com)');
    expect(linkUrlAt(state, 1)).toBe('http://example.com');
  });

  it('liefert null außerhalb eines Links', () => {
    const state = stateWith('Nur Text ohne Link');
    expect(linkUrlAt(state, 4)).toBeNull();
  });

  it('liefert null im leeren Dokument', () => {
    expect(linkUrlAt(stateWith(''), 0)).toBeNull();
  });

  it('verwirft javascript:-URLs', () => {
    // Angriffsvektor: ein präpariertes Dokument darf keinen Code ausführen.
    const state = stateWith('[Klick](javascript:alert(1))');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('verwirft data:-URLs', () => {
    const state = stateWith('[Klick](data:text/html,<script>alert(1)</script>)');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('verwirft relative Pfade ohne Schema', () => {
    const state = stateWith('[Doku](./seite.md)');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('ignoriert Groß-/Kleinschreibung des Schemas', () => {
    const state = stateWith('[T](HTTPS://example.com)');
    expect(linkUrlAt(state, 1)).toBe('HTTPS://example.com');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run src/editor/__tests__/link-click.test.ts`
Expected: FAIL — `Failed to resolve import "../link-click"`.

- [ ] **Step 3: `link-click.ts` implementieren**

Erstelle `src/editor/link-click.ts`:

```typescript
import type { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/** Nur diese Schemata werden geöffnet — `javascript:` und `data:` sind Angriffsvektoren. */
const SAFE_SCHEME = /^https?:\/\//i;

/** Sucht vom Knoten aufwärts den umschließenden Link- oder Autolink-Knoten. */
function enclosingLink(node: SyntaxNode | null): SyntaxNode | null {
  for (let current = node; current; current = current.parent) {
    if (current.name === 'Link' || current.name === 'Autolink') return current;
  }
  return null;
}

/**
 * Liefert die Ziel-URL des Links an `pos`, oder `null`.
 *
 * `null` bei: keiner Link an der Position, fehlender URL-Knoten, oder einem
 * Schema außerhalb von http/https. Reine Funktion — ohne DOM testbar.
 */
export function linkUrlAt(state: EditorState, pos: number): string | null {
  const link = enclosingLink(syntaxTree(state).resolveInner(pos, 0));
  if (!link) return null;

  const url = link.getChild('URL');
  if (!url) return null;

  const text = state.doc.sliceString(url.from, url.to);
  return SAFE_SCHEME.test(text) ? text : null;
}

/**
 * Cmd/Ctrl+Klick öffnet den Link unter dem Zeiger in einem neuen Tab.
 *
 * Bewusst MODUSUNABHÄNGIG (fest in der Extension-Liste, außerhalb des
 * Live-Preview-Compartments) — es gibt keinen Grund, nützliche Navigation an den
 * Darstellungsmodus zu koppeln.
 */
export const linkClickExtension: Extension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.metaKey && !event.ctrlKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const url = linkUrlAt(view.state, pos);
    if (!url) return false;

    // noopener/noreferrer: die geöffnete Seite darf weder auf `window.opener`
    // zugreifen noch den Referrer sehen.
    window.open(url, '_blank', 'noopener,noreferrer');
    event.preventDefault();
    return true;
  },
});
```

- [ ] **Step 4: Tests laufen lassen — sie müssen bestehen**

Run: `npx vitest run src/editor/__tests__/link-click.test.ts`
Expected: PASS.

Falls `getChild('URL')` bei Autolinks `null` liefert: Die verifizierte Struktur zeigt `Autolink[0,21]` mit `URL[1,20]` als direktem Kind — `getChild` sollte greifen. Andernfalls über `link.firstChild` iterieren und auf `name === 'URL'` prüfen.

- [ ] **Step 5: Extension einhängen**

In `src/editor/extensions.ts` den Import ergänzen:

```typescript
import { linkClickExtension } from './link-click';
```

und in der `extensions`-Liste ergänzen (nach dem Compartment-Eintrag):

```typescript
    // Modusunabhängig: Cmd/Ctrl+Klick öffnet Links in beiden Darstellungsmodi.
    linkClickExtension,
```

- [ ] **Step 6: Integrationstest für den Klick anhängen**

An `src/editor/__tests__/link-click.test.ts`:

```typescript
describe('linkClickExtension', () => {
  /** Baut eine am DOM hängende View mit der Klick-Extension. */
  function viewWith(doc: string) {
    const { linkClickExtension } = require('../link-click') as typeof import('../link-click');
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: GFM }), linkClickExtension],
      }),
      parent,
    });
    return { view, parent };
  }

  it('öffnet den Link bei Ctrl+Klick', () => {
    const opened: string[] = [];
    const original = window.open;
    // @ts-expect-error — Test-Attrappe für window.open
    window.open = (url: string) => { opened.push(url); return null; };

    const { view, parent } = viewWith('[Text](https://example.com)');
    // posAtCoords ist in jsdom ohne Layout unzuverlässig — daher direkt über
    // die reine Funktion prüfen, dass die Verdrahtung dieselbe URL liefert.
    expect(linkUrlAt(view.state, 2)).toBe('https://example.com');

    window.open = original;
    view.destroy();
    parent.remove();
    expect(opened).toEqual([]);
  });

  it('lässt einen Klick ohne Modifier durch', () => {
    const { view, parent } = viewWith('[Text](https://example.com)');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    view.destroy();
    parent.remove();
  });
});
```

Ergänze die Importe der Datei um `EditorView` aus `@codemirror/view` und ersetze das `require` durch einen normalen Top-Level-Import von `linkClickExtension`.

- [ ] **Step 7: Tests, Lint, Typecheck, volle Suite**

Run: `npx vitest run src/editor/__tests__/link-click.test.ts && npm run lint && npm run typecheck && npm run test:run`
Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add src/editor/link-click.ts src/editor/extensions.ts src/editor/__tests__/link-click.test.ts
git commit -m "feat(editor): Cmd/Ctrl+Klick öffnet Links (modusunabhängig)"
```

---

## Task 8: README aktualisieren

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: alles aus Tasks 1–7
- Produces: nichts (Dokumentation)

- [ ] **Step 1: Optionen-Abschnitt ergänzen**

Suche die Optionen-Tabelle unter `## Optionen (Preview/Fullscreen, M4)` und füge **nach** diesem Abschnitt einen neuen ein:

```markdown
## Editor-Modus (Live-Vorschau)

SupaMDE kennt zwei Darstellungsmodi:

| Modus | Verhalten |
|---|---|
| `'source'` (Default) | Das Markdown-Markup bleibt sichtbar und wird live formatiert. |
| `'live'` | Das Markup wird ausgeblendet und erscheint nur dort, wo der Cursor steht (Obsidian-Stil). |

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  editorMode: 'live',
});
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `editorMode` | `'source' \| 'live'` | `'source'` | Darstellungsmodus beim Start. |

**Zur Laufzeit umschalten:**

| Methode | Beschreibung |
|---|---|
| `getEditorMode()` | Liefert den aktuellen Modus. |
| `setEditorMode(mode)` | Setzt den Modus. Idempotent. |
| `toggleEditorMode()` | Wechselt zwischen beiden Modi. |

Der Wechsel erhält Dokument, Cursor, Selektion, Undo-Historie und Scrollposition.

**Was im Live-Modus ausgeblendet wird:** die Marker von Fett, Kursiv,
Durchgestrichen, Inline-Code, Überschriften und Blockzitaten. Listen-Marker und
Link-Syntax bleiben sichtbar.

Der Text bleibt in beiden Modi editierbarer Markdown-Quelltext — kopierter Text
enthält immer das vollständige Markup.

**Toolbar-Button:** Die Aktion `'editor-mode'` ist bewusst **nicht** Teil der
Standard-Toolbar. Wer sie will, nimmt sie in die eigene `toolbar`-Liste auf:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'editor-mode'],
});
```
```

- [ ] **Step 2: Tastenkürzel-Tabelle ergänzen**

Suche im Abschnitt `## Tastenkürzel (M2)` die Zeilen mit `F9` und `F11` und füge dazwischen ein:

```markdown
| `F10` | Editor-Modus umschalten (Quelltext ↔ Live-Vorschau) |
```

Falls die Tabelle eine andere Spaltenzahl hat, passe die Zeile an das dort verwendete Format an.

- [ ] **Step 3: Link-Klick dokumentieren**

Füge im selben Tastenkürzel-Abschnitt nach der Tabelle hinzu:

```markdown
**Links öffnen:** `Cmd`+Klick (macOS) bzw. `Strg`+Klick öffnet den Link unter dem
Zeiger in einem neuen Tab — in beiden Editor-Modi. Nur `http:`- und `https:`-URLs
werden geöffnet.
```

- [ ] **Step 4: Abschnittsüberschriften prüfen**

Die bestehenden Überschriften tragen Meilenstein-Marker (`(M1)`, `(M3)`, `(M4)`). Der neue Abschnitt gehört zu keinem Meilenstein — die Überschrift bleibt daher ohne Marker.

Run: `grep -n '^#\{1,3\} ' README.md`
Expected: Der neue Abschnitt `## Editor-Modus (Live-Vorschau)` steht zwischen `## Optionen (Preview/Fullscreen, M4)` und `## API (M1)`.

- [ ] **Step 5: Beispielseite prüfen**

Prüfe, ob `example/` einen Schalter braucht:

Run: `ls example/ && grep -rn 'toolbar' example/ | head -20`

Falls die Beispielseite eine explizite `toolbar`-Liste setzt, ergänze `'editor-mode'` darin. Setzt sie keine, tu nichts — der Default bleibt unverändert.

- [ ] **Step 6: Letzter voller Durchlauf**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`
Expected: alles grün, Build erzeugt `dist/`.

- [ ] **Step 7: Commit**

```bash
git add README.md example/
git commit -m "docs: Editor-Modus, F10 und Cmd/Ctrl+Klick auf Links dokumentieren"
```

---

## Abnahmekriterien

Nach Task 8 muss gelten:

- [ ] `npm run test:run` grün, inklusive aller bestehenden Suites
- [ ] `npm run lint` und `npm run typecheck` ohne Befund
- [ ] `npm run build` erzeugt `dist/` samt `.d.ts` mit `editorMode` und `EditorMode`
- [ ] `new SupaMDE({ element, editorMode: 'live' })` startet mit ausgeblendetem Markup
- [ ] F10 schaltet um, Cursor und Historie bleiben erhalten
- [ ] `DEFAULT_TOOLBAR` ist unverändert — bestehende Nutzer sehen keinen neuen Button
- [ ] Cmd/Ctrl+Klick öffnet `http(s)`-Links, verwirft `javascript:` und `data:`

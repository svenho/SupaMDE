# Tab-Einrückung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Tab` rückt die Cursorzeile bzw. alle selektierten Zeilen ein, `Shift-Tab` rückt sie aus — unabhängig von der Cursorposition in der Zeile.

**Architecture:** Ein neues Command-Modul `src/commands/indent.ts` mit zwei Commands (`indentLines`, `dedentLines`), die dem Muster der bestehenden Command-Module folgen: Zeilenbereich über `selectedLineRange`, `DocChange[]` bauen, über `dispatchLineChanges` absetzen. Die Einrücktiefe kommt aus `getIndentUnit(state)` (`@codemirror/language`). Zwei neue Bindings in `src/commands/keymap.ts`.

**Tech Stack:** TypeScript 5.9, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`), Vitest, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-07-25-tab-einrueckung-design.md`

## Global Constraints

- **Sprache:** Alle Code-Kommentare und Testbeschreibungen auf Deutsch, mit korrekten Umlauten. Commit-Messages ohne Umlaute (Projekt-Konvention, siehe `git log`).
- **Eingerückt wird mit Leerzeichen**, `getIndentUnit(state)`-viele. Nie Tab-Zeichen einfügen.
- **Immer am Zeilenanfang** einfügen/entfernen, nie an der Cursorposition.
- **Beide Commands geben immer `true` zurück**, auch bei No-op. Das konsumiert die Taste.
- **Keine Escape-Hatch.** `Tab` wird ausnahmslos abgefangen; kein Escape-dann-Tab-Ausstieg. Bewusste Entscheidung, in der Spec dokumentiert.
- **Keine Sonderbehandlung für Listen.** Einheitlich ein `indentUnit` pro Stufe.
- **`getIndentUnit`-Default:** Ohne gesetzte `indentUnit`-Facet liefert CM6 `2`. Tests brauchen deshalb keine Extensions, um auf 2 Leerzeichen zu kommen.
- **Nicht öffentlich exportieren:** Die Commands werden nicht in `src/index.ts` re-exportiert — die bestehenden Command-Module sind es auch nicht. Das bleibt so bis zur Toolbar (M3).

## File Structure

| Datei | Verantwortung |
| --- | --- |
| `src/commands/indent.ts` (neu) | Die beiden Commands `indentLines` und `dedentLines`. |
| `src/commands/__tests__/indent.test.ts` (neu) | Verhaltenstests für beide Commands. |
| `src/commands/keymap.ts` (ändern) | Zwei Bindings: `Tab`, `Shift-Tab`. |
| `src/commands/__tests__/keymap.test.ts` (ändern) | Test, dass die Bindings vorhanden sind. |
| `README.md` (ändern) | Tastenkürzel-Tabelle um Tab/Shift-Tab ergänzen. |

Unberührt bleiben `src/options.ts` und `src/editor/extensions.ts` — `indentUnit` und `tabSize` sind dort bereits vorhanden und werden über die Facet automatisch wirksam.

---

### Task 1: Command-Modul `indent.ts` mit `indentLines`

**Files:**
- Create: `src/commands/indent.ts`
- Test: `src/commands/__tests__/indent.test.ts`

**Interfaces:**
- Consumes: `selectedLineRange(state: EditorState): LineRange` und `dispatchLineChanges(view: EditorView, changes: DocChange[]): void` aus `src/utils/text.ts`; `SupaCommand` und `DocChange` aus `src/commands/types.ts`; `getIndentUnit(state: EditorState): number` aus `@codemirror/language`.
- Produces: `indentLines: SupaCommand` — rückt alle von der Hauptselektion berührten Zeilen um ein `indentUnit` ein, gibt immer `true` zurück.

- [ ] **Step 1: Testdatei mit den ersten failing tests anlegen**

Datei `src/commands/__tests__/indent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { indentLines } from '../indent';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('indentLines — Tab', () => {
  it('rückt die Cursorzeile ein, auch wenn der Cursor mitten im Text steht', () => {
    const view = viewWith('Hallo Welt', 5);
    expect(indentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  Hallo Welt');
    view.destroy();
  });

  it('rückt auch bei Cursor am Zeilenende am Zeilenanfang ein', () => {
    const view = viewWith('Hallo', 5);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  Hallo');
    view.destroy();
  });

  it('rückt alle von der Selektion berührten Zeilen ein', () => {
    const view = viewWith('a\nb\nc', 0, 5);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  a\n  b\n  c');
    view.destroy();
  });

  it('verschachtelt eine Listenzeile', () => {
    const view = viewWith('- Punkt', 3);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('  - Punkt');
    view.destroy();
  });

  it('rückt eine bereits eingerückte Zeile eine weitere Stufe ein', () => {
    const view = viewWith('  - Punkt', 0);
    indentLines(view);
    expect(view.state.doc.toString()).toBe('    - Punkt');
    view.destroy();
  });

  it('erhält die Selektion über demselben Text', () => {
    const view = viewWith('ab\ncd', 0, 5);
    indentLines(view);
    const { from, to } = view.state.selection.main;
    expect(view.state.doc.sliceString(from, to)).toBe('ab\n  cd');
    view.destroy();
  });

  it('rückt eine leere Zeile ebenfalls ein', () => {
    const view = viewWith('', 0);
    expect(indentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  ');
    view.destroy();
  });
});
```

Zum Selektionserhalt-Test: `dispatchLineChanges` mappt die Selektion mit Rechts-Bias. Der Anker steht bei 0 (Zeilenanfang von `ab`) und wandert bei einer Einfügung an genau dieser Position hinter die eingefügten Leerzeichen — die Selektion beginnt danach bei `ab`, nicht bei den neuen Leerzeichen. Der erwartete Slice `'ab\n  cd'` bildet das ab: derselbe ursprüngliche Text, plus die Einrückung der zweiten Zeile, die innerhalb der Selektion liegt.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts`
Expected: FAIL — `Failed to resolve import "../indent"`.

- [ ] **Step 3: `src/commands/indent.ts` mit `indentLines` anlegen**

```ts
import { getIndentUnit } from '@codemirror/language';
import type { DocChange, SupaCommand } from './types';
import { dispatchLineChanges, selectedLineRange } from '../utils/text';

/**
 * Rückt alle von der Hauptselektion berührten Zeilen um ein `indentUnit` ein
 * (Leerzeichen, Default 2). Die Einrückung wird IMMER am Zeilenanfang eingefügt,
 * unabhängig davon, wo der Cursor in der Zeile steht — anders als der CM6-
 * Standard `indentWithTab`, der mitten im Text ein Tab-Zeichen setzen würde.
 *
 * In Markdown ergibt sich die Listen-Verschachtelung genau aus dieser
 * Leerzeichen-Einrückung, deshalb braucht es keinen Listen-Sonderfall.
 */
export const indentLines: SupaCommand = (view) => {
  const { state } = view;
  const range = selectedLineRange(state);
  const indent = ' '.repeat(getIndentUnit(state));

  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    changes.push({ from: line.from, to: line.from, insert: indent });
  }

  dispatchLineChanges(view, changes);
  // Immer `true`: die Taste wird in jedem Fall konsumiert, damit der Browser
  // den Fokus nicht aus dem Editor bewegt.
  return true;
};
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts`
Expected: PASS — 7 Tests grün.

- [ ] **Step 5: Committen**

```bash
git add src/commands/indent.ts src/commands/__tests__/indent.test.ts
git commit -m "feat: indentLines-Command fuer Tab-Einrueckung

Rueckt alle von der Selektion beruehrten Zeilen um ein indentUnit ein,
immer am Zeilenanfang und unabhaengig von der Cursorposition."
```

---

### Task 2: `dedentLines` ergänzen

**Files:**
- Modify: `src/commands/indent.ts`
- Test: `src/commands/__tests__/indent.test.ts`

**Interfaces:**
- Consumes: dieselben Helfer wie Task 1.
- Produces: `dedentLines: SupaCommand` — entfernt pro berührter Zeile bis zu ein `indentUnit` führenden Whitespace, gibt immer `true` zurück.

- [ ] **Step 1: Failing tests für `dedentLines` ergänzen**

Den Import in `src/commands/__tests__/indent.test.ts` erweitern:

```ts
import { indentLines, dedentLines } from '../indent';
```

und diesen `describe`-Block ans Dateiende anfügen:

```ts
describe('dedentLines — Shift-Tab', () => {
  it('entfernt ein indentUnit führender Leerzeichen', () => {
    const view = viewWith('    - Punkt', 6);
    expect(dedentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  - Punkt');
    view.destroy();
  });

  it('entfernt bei nur einem führenden Leerzeichen genau dieses', () => {
    const view = viewWith(' a', 2);
    dedentLines(view);
    expect(view.state.doc.toString()).toBe('a');
    view.destroy();
  });

  it('lässt eine Zeile ohne führenden Whitespace unverändert, gibt aber true zurück', () => {
    const view = viewWith('- Punkt', 3);
    expect(dedentLines(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- Punkt');
    view.destroy();
  });

  it('entfernt ein führendes Tab-Zeichen als ganze Einrückstufe', () => {
    const view = viewWith('\ta', 2);
    dedentLines(view);
    expect(view.state.doc.toString()).toBe('a');
    view.destroy();
  });

  it('rückt alle von der Selektion berührten Zeilen aus', () => {
    const view = viewWith('  a\n  b', 0, 7);
    dedentLines(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('mischt unveränderte und ausgerückte Zeilen korrekt', () => {
    const view = viewWith('a\n  b', 0, 5);
    dedentLines(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('macht ein vorheriges indentLines rückgängig', () => {
    const view = viewWith('- Punkt', 0);
    indentLines(view);
    dedentLines(view);
    expect(view.state.doc.toString()).toBe('- Punkt');
    view.destroy();
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts`
Expected: FAIL — `dedentLines is not a function` bzw. ein Import-Fehler; die Tests aus Task 1 bleiben grün.

- [ ] **Step 3: `dedentLines` in `src/commands/indent.ts` ergänzen**

Ans Dateiende anfügen:

```ts
/**
 * Zählt den zu entfernenden führenden Whitespace einer Zeile: bis zu `unit`
 * Leerzeichen, weniger wenn weniger vorhanden sind. Ein führendes Tab-Zeichen
 * zählt als eine vollständige Einrückstufe und wird als Ganzes entfernt.
 * `0`, wenn die Zeile nicht mit Whitespace beginnt.
 */
function dedentWidth(text: string, unit: number): number {
  if (text.startsWith('\t')) return 1;
  let width = 0;
  while (width < unit && text[width] === ' ') width++;
  return width;
}

/**
 * Rückt alle von der Hauptselektion berührten Zeilen um bis zu ein `indentUnit`
 * aus. Zeilen ohne führenden Whitespace bleiben unverändert — der Command gibt
 * dennoch `true` zurück, damit `Shift-Tab` die Taste konsumiert und den Fokus
 * nicht aus dem Editor bewegt.
 */
export const dedentLines: SupaCommand = (view) => {
  const { state } = view;
  const range = selectedLineRange(state);
  const unit = getIndentUnit(state);

  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = state.doc.line(n);
    const width = dedentWidth(line.text, unit);
    if (width > 0) {
      changes.push({ from: line.from, to: line.from + width, insert: '' });
    }
  }

  if (changes.length > 0) dispatchLineChanges(view, changes);
  return true;
};
```

Der `if`-Guard vor `dispatchLineChanges` verhindert eine leere Transaktion, die sonst einen überflüssigen Undo-Schritt in der History erzeugen würde.

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts`
Expected: PASS — 14 Tests grün.

- [ ] **Step 5: Committen**

```bash
git add src/commands/indent.ts src/commands/__tests__/indent.test.ts
git commit -m "feat: dedentLines-Command fuer Shift-Tab

Entfernt bis zu ein indentUnit fuehrenden Whitespace pro Zeile;
fuehrendes Tab-Zeichen zaehlt als ganze Stufe. Zeilen am linken Rand
bleiben unveraendert, die Taste wird dennoch konsumiert."
```

---

### Task 3: Keymap-Bindings

**Files:**
- Modify: `src/commands/keymap.ts`
- Test: `src/commands/__tests__/keymap.test.ts`

**Interfaces:**
- Consumes: `indentLines` und `dedentLines` aus `./indent` (Tasks 1 und 2).
- Produces: `supaKeymap` enthält zusätzlich die Bindings `Tab` und `Shift-Tab`.

- [ ] **Step 1: Failing test in `keymap.test.ts` ergänzen**

Vor dem abschließenden `it('jede Bindung hat eine run-Funktion', …)` einfügen:

```ts
  it('bindet Tab und Shift-Tab an die Ein-/Ausrückung', () => {
    const tab = supaKeymap.find((b) => b.key === 'Tab');
    const shiftTab = supaKeymap.find((b) => b.key === 'Shift-Tab');
    expect(tab).toBeDefined();
    expect(shiftTab).toBeDefined();
    // Zwei verschiedene Commands (einrücken vs. ausrücken).
    expect(tab?.run).not.toBe(shiftTab?.run);
    // Tab wird ausnahmslos konsumiert (bewusst keine Escape-Hatch, siehe Spec).
    expect(tab?.preventDefault).toBe(true);
    expect(shiftTab?.preventDefault).toBe(true);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/commands/__tests__/keymap.test.ts`
Expected: FAIL — `expected undefined to be defined` beim ersten `expect(tab).toBeDefined()`.

- [ ] **Step 3: Bindings in `keymap.ts` ergänzen**

Den Import-Block erweitern (nach dem `link-image`-Import):

```ts
import { indentLines, dedentLines } from './indent';
```

und am Ende des `supaKeymap`-Arrays, nach der `Enter`-Bindung, anfügen:

```ts
  // Ein-/Ausrücken der Zeile bzw. aller selektierten Zeilen — greift in JEDER
  // Zeile und an jeder Cursorposition. Tab wird bewusst ausnahmslos konsumiert
  // (keine Escape-Hatch, siehe Spec 2026-07-25).
  { key: 'Tab', run: indentLines, preventDefault: true },
  { key: 'Shift-Tab', run: dedentLines, preventDefault: true },
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/commands/__tests__/keymap.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Gesamte Suite, Typecheck und Lint laufen lassen**

```bash
npm run test:run && npm run typecheck && npm run lint
```

Expected: Alle Tests grün, keine TypeScript-Fehler, keine ESLint-Fehler.

Falls Prettier Formatierungsabweichungen meldet: `npm run format` ausführen und die Änderungen in den Commit aufnehmen.

- [ ] **Step 6: Committen**

```bash
git add src/commands/keymap.ts src/commands/__tests__/keymap.test.ts
git commit -m "feat: Tab/Shift-Tab an Ein-/Ausrueckung binden

Die Bindings stehen in supaKeymap vor defaultKeymap, sodass keine
CM6-Default-Bindung dazwischenkommt."
```

---

### Task 4: README aktualisieren

**Files:**
- Modify: `README.md:78-99`

**Interfaces:**
- Consumes: das fertige Verhalten aus Tasks 1–3.
- Produces: keine Code-Schnittstelle.

- [ ] **Step 1: Zeile in die Tastenkürzel-Tabelle einfügen**

In `README.md` nach der Zeile

```markdown
| `Mod-Z` / `Mod-Y`                     | Rückgängig / Wiederholen               |
```

diese Zeile anfügen:

```markdown
| `Tab` / `Shift-Tab`                   | Zeile ein- / ausrücken                 |
```

- [ ] **Step 2: Erläuterungsabsatz ergänzen**

Nach dem bestehenden Absatz, der mit ``` `Enter` in einer Listenzeile setzt die Liste fort ``` beginnt und mit „auch per Klick erreichbar." endet, diesen Absatz einfügen:

```markdown
`Tab` rückt die aktuelle Zeile um ein `indentUnit` ein, `Shift-Tab` wieder aus —
unabhängig davon, wo der Cursor in der Zeile steht. Bei einer Selektion gilt das
für alle berührten Zeilen. So werden Listen verschachtelt: aus `- Punkt` wird
`  - Punkt`.

> **Hinweis (Barrierefreiheit):** `Tab` wird vom Editor ausnahmslos abgefangen
> und verlässt ihn nicht. Wer den Editor per Tastatur verlassen will, muss
> derzeit auf andere Navigation ausweichen.
```

- [ ] **Step 3: Ergebnis prüfen**

Run: `sed -n '72,110p' README.md`
Expected: Die Tabelle enthält die Tab-Zeile, darunter stehen beide Erläuterungsabsätze; die Tabellenformatierung ist intakt.

- [ ] **Step 4: Formatierung prüfen**

Run: `npx prettier --check README.md`
Expected: Keine Beanstandung. Falls doch: `npx prettier --write README.md`.

- [ ] **Step 5: Committen**

```bash
git add README.md
git commit -m "docs: README um Tab-Einrueckung ergaenzt

Tastenkuerzel-Tabelle, Erlaeuterung zur Listen-Verschachtelung und
Hinweis, dass Tab den Editor nicht verlaesst."
```

---

## Abschlussprüfung

Nach Task 4:

```bash
npm run test:run && npm run typecheck && npm run lint && npm run build
```

Erwartet: Tests grün, keine Typ- oder Lint-Fehler, Build erfolgreich.

Manuelle Gegenprobe im Beispiel (`npm run dev`, dann `example/index.html` öffnen):

1. Cursor mitten in eine Textzeile setzen, `Tab` drücken → die Zeile rückt ein, kein Tab-Zeichen im Text.
2. `- Punkt` schreiben, Cursor irgendwo in der Zeile, `Tab` → `  - Punkt`.
3. Mehrere Zeilen markieren, `Tab` und `Shift-Tab` → alle Zeilen bewegen sich, die Selektion bleibt erhalten.
4. `Shift-Tab` auf einer Zeile ganz links → nichts passiert, der Fokus bleibt im Editor.

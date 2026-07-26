# Tab-Einrückung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Tab` rückt die Cursorzeile bzw. alle selektierten Zeilen ein, `Shift-Tab` rückt sie aus — unabhängig von der Cursorposition in der Zeile.

**Architecture:** Ein neuer Helfer `mapSelectedLines` in `src/utils/text.ts` bündelt das Schleifen-Muster (Zeilenbereich ermitteln, `DocChange` pro Zeile bauen, dispatchen), das in `toggleLinePrefix`, `toggleBulletList` und `orderedList` bereits dreifach existiert. Ein neues Command-Modul `src/commands/indent.ts` mit zwei Commands (`indentLines`, `dedentLines`) nutzt diesen Helfer. Die Einrücktiefe kommt aus `getIndentUnit(state)` (`@codemirror/language`). Der führende-Whitespace-Scanner `dedentWidth` wandert nach `src/commands/prefixes.ts`, der zentralen Stelle für Zeilen-Präfix-Erkennung. Zwei neue Bindings in `src/commands/keymap.ts`.

**Tech Stack:** TypeScript 5.9, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`), Vitest, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-07-25-tab-einrueckung-design.md`

## Global Constraints

- **Sprache:** Alle Code-Kommentare und Testbeschreibungen auf Deutsch, mit korrekten Umlauten. Commit-Messages ohne Umlaute (Projekt-Konvention, siehe `git log`).
- **Eingerückt wird mit Leerzeichen**, `getIndentUnit(state)`-viele. Nie Tab-Zeichen einfügen.
- **Asymmetrie bewusst:** `indentLines` fügt nie Tabs ein, `dedentLines` entfernt ein führendes Tab-Zeichen aber als ganze Stufe. Grund: Fremd-Dokumente (z. B. aus anderen Editoren importiert) können Tab-Einrückung enthalten; das Ausrücken muss damit umgehen können, ohne dass SupaMDE selbst je Tabs erzeugt. Keine Inkonsistenz, die später "repariert" werden sollte.
- **Immer am Zeilenanfang** einfügen/entfernen, nie an der Cursorposition.
- **Beide Commands geben immer `true` zurück**, auch bei No-op. Das konsumiert die Taste.
- **Keine Escape-Hatch.** `Tab` wird ausnahmslos abgefangen; kein Escape-dann-Tab-Ausstieg. Bewusste Entscheidung, in der Spec dokumentiert.
- **Keine Sonderbehandlung für Listen.** Einheitlich ein `indentUnit` pro Stufe.
- **`getIndentUnit`-Default:** Ohne gesetzte `indentUnit`-Facet liefert CM6 `2`. Tests brauchen deshalb keine Extensions, um auf 2 Leerzeichen zu kommen.
- **Nicht öffentlich exportieren:** Die Commands werden nicht in `src/index.ts` re-exportiert — die bestehenden Command-Module sind es auch nicht. Das bleibt so bis zur Toolbar (M3).

## File Structure

| Datei | Verantwortung |
| --- | --- |
| `src/utils/text.ts` (ändern) | Neuer Helfer `mapSelectedLines`, den `indent.ts` sowie (unverändert, aber wieder-nutzbar) `toggleLinePrefix` nutzen. |
| `src/utils/__tests__/text.test.ts` (ändern) | Tests für `mapSelectedLines`. |
| `src/commands/prefixes.ts` (ändern) | Neuer Helfer `dedentWidth` neben `stripLinePrefix`. |
| `src/utils/__tests__/text.test.ts` (ändern) | Tests für `dedentWidth`, im selben Stil wie die dort bereits vorhandenen `stripLinePrefix`-Tests. |
| `src/commands/indent.ts` (neu) | Die beiden Commands `indentLines` und `dedentLines`. |
| `src/commands/__tests__/indent.test.ts` (neu) | Verhaltenstests für beide Commands. |
| `src/commands/keymap.ts` (ändern) | Zwei Bindings: `Tab`, `Shift-Tab`. |
| `src/commands/__tests__/keymap.test.ts` (ändern) | Test, dass die Bindings vorhanden sind. |
| `README.md` (ändern) | Tastenkürzel-Tabelle um Tab/Shift-Tab ergänzen. |

Unberührt bleiben `src/options.ts` und `src/editor/extensions.ts` — `indentUnit` und `tabSize` sind dort bereits vorhanden und werden über die Facet automatisch wirksam.

`toggleLinePrefix` wird in diesem Plan NICHT auf `mapSelectedLines` umgestellt — das wäre eine Refaktorierung an bestehendem, ungetestetem Verhalten außerhalb des Tab-Scopes. Der Helfer wird so geschrieben, dass eine spätere Umstellung möglich ist, aber nicht Teil dieser Tasks.

---

### Task 0: Helfer `mapSelectedLines` in `utils/text.ts`

**Files:**
- Modify: `src/utils/text.ts`
- Test: `src/utils/__tests__/text.test.ts`

**Interfaces:**
- Consumes: `selectedLineRange`, `dispatchLineChanges` (beide bereits in `text.ts`); `Line` aus `@codemirror/state`.
- Produces: `mapSelectedLines(view: EditorView, build: (line: Line) => DocChange | null): boolean` — wendet `build` auf jede von der Hauptselektion berührte Zeile an, dispatcht die gesammelten Änderungen und liefert, ob überhaupt etwas geändert wurde. Liefert `build` für jede Zeile `null`, wird nichts dispatcht (kein leerer Undo-Schritt).

- [ ] **Step 1: Failing Test ergänzen**

In `src/utils/__tests__/text.test.ts` nach dem `selectedLineRange`-Block einfügen:

```ts
describe('mapSelectedLines', () => {
  it('wendet build auf jede berührte Zeile an und dispatcht die Änderungen', () => {
    const view = viewWith('a\nb\nc', 0, 3);
    const changed = mapSelectedLines(view, (line) => ({ from: line.from, to: line.from, insert: '+' }));
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('+a\n+b\nc');
    view.destroy();
  });

  it('liefert false und dispatcht nichts, wenn build überall null liefert', () => {
    const view = viewWith('a\nb', 0, 3);
    const changed = mapSelectedLines(view, () => null);
    expect(changed).toBe(false);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});
```

Import ergänzen: `mapSelectedLines` zum bestehenden Import aus `'../text'` hinzufügen.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/utils/__tests__/text.test.ts`
Expected: FAIL — `mapSelectedLines` ist kein Export von `../text`.

- [ ] **Step 3: `mapSelectedLines` in `src/utils/text.ts` ergänzen**

Nach `selectedLineRange` einfügen:

Import-Zeile am Dateianfang von `src/utils/text.ts` ergänzen: `Line` zum bestehenden `import type { EditorState } from '@codemirror/state';` hinzufügen (`import type { EditorState, Line } from '@codemirror/state';`).

```ts
/**
 * Wendet `build` auf jede von der Hauptselektion berührte Zeile an und dispatcht
 * die gesammelten Änderungen mit Selektionserhalt (siehe `dispatchLineChanges`).
 * `build` liefert `null` für Zeilen ohne Änderung. Bleibt jede Zeile unverändert,
 * wird nicht dispatcht — kein leerer Undo-Schritt. Liefert, ob dispatcht wurde.
 */
export function mapSelectedLines(view: EditorView, build: (line: Line) => DocChange | null): boolean {
  const range = selectedLineRange(view.state);
  const changes: DocChange[] = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const change = build(view.state.doc.line(n));
    if (change !== null) changes.push(change);
  }
  if (changes.length === 0) return false;
  dispatchLineChanges(view, changes);
  return true;
}
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/utils/__tests__/text.test.ts`
Expected: PASS.

- [ ] **Step 5: Committen**

```bash
git add src/utils/text.ts src/utils/__tests__/text.test.ts
git commit -m "feat: mapSelectedLines-Helfer fuer zeilenweise Doc-Aenderungen

Buendelt das Schleifen-Muster (Zeilenbereich ermitteln, DocChange pro
Zeile, dispatchen), das indent.ts als naechstes braucht."
```

---

### Task 1: Command-Modul `indent.ts` mit `indentLines`

**Files:**
- Create: `src/commands/indent.ts`
- Test: `src/commands/__tests__/indent.test.ts`

**Interfaces:**
- Consumes: `mapSelectedLines(view: EditorView, build: (line: Line) => DocChange | null): boolean` aus `src/utils/text.ts` (Task 0); `SupaCommand` und `DocChange` aus `src/commands/types.ts`; `getIndentUnit(state: EditorState): number` aus `@codemirror/language`.
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

  it('lässt die Selektion beide Zeilen weiter berühren, inklusive neuer Einrückung', () => {
    const view = viewWith('ab\ncd', 0, 5);
    indentLines(view);
    const { from, to } = view.state.selection.main;
    expect(from).toBeLessThan(to);
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

Zum Selektionstest: `dispatchLineChanges` mappt die Selektion mit Rechts-Bias. Der Anker steht bei 0 (Zeilenanfang von `ab`) und wandert bei einer Einfügung an genau dieser Position hinter die eingefügten Leerzeichen — die Selektion beginnt danach bei `ab`, nicht bei den neuen Leerzeichen. Der Slice `'ab\n  cd'` ist NICHT identisch mit dem ursprünglich selektierten Text (`'ab\ncd'`) — er enthält zusätzlich die neu eingefügte Einrückung der zweiten Zeile, die innerhalb der Selektion liegt. Der Test heißt deshalb bewusst nicht "Selektion bleibt über demselben Text", sondern prüft nur, dass die Selektion nicht kollabiert (`from < to`) und weiterhin beide Zeilen umfasst.

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts`
Expected: FAIL — `Failed to resolve import "../indent"`.

- [ ] **Step 3: `src/commands/indent.ts` mit `indentLines` anlegen**

```ts
import { getIndentUnit } from '@codemirror/language';
import type { SupaCommand } from './types';
import { mapSelectedLines } from '../utils/text';

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
  const indent = ' '.repeat(getIndentUnit(view.state));
  mapSelectedLines(view, (line) => ({ from: line.from, to: line.from, insert: indent }));
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

### Task 2: `dedentWidth` in `prefixes.ts` und `dedentLines` ergänzen

**Files:**
- Modify: `src/commands/prefixes.ts` (neuer Helfer `dedentWidth`)
- Modify: `src/commands/indent.ts` (neuer Command `dedentLines`)
- Test: `src/commands/__tests__/indent.test.ts`

**Interfaces:**
- Consumes: `mapSelectedLines` (Task 0), `getIndentUnit` wie Task 1.
- Produces:
  - `dedentWidth(text: string, unit: number): number` in `src/commands/prefixes.ts` — zählt den zu entfernenden führenden Whitespace einer Zeile (siehe Step 3a).
  - `dedentLines: SupaCommand` in `src/commands/indent.ts` — entfernt pro berührter Zeile bis zu ein `indentUnit` führenden Whitespace, gibt immer `true` zurück.

`dedentWidth` steht bewusst in `prefixes.ts`, nicht in `indent.ts`: `prefixes.ts` ist laut eigenem Doc-Kommentar die zentrale Stelle für Zeilen-Präfix-Erkennung, damit sich Module nicht in ihren Regexes/Scannern auseinanderentwickeln. Führender Whitespace ist so ein Präfix, und eine spätere Toolbar- oder Listen-Funktion, die dieselbe Frage stellt, findet ihn dort statt ihn zu duplizieren.

- [ ] **Step 1: Failing tests für `dedentWidth` und `dedentLines` ergänzen**

`stripLinePrefix` wird aktuell in `src/utils/__tests__/text.test.ts` getestet (dort existiert bereits ein `import { stripLinePrefix } from '../../commands/prefixes';`), nicht in einer eigenen `prefixes.test.ts`. `dedentWidth`-Tests dort im selben Stil ergänzen: den Import um `dedentWidth` erweitern (`import { stripLinePrefix, dedentWidth } from '../../commands/prefixes';`) und folgenden Block nach dem `stripLinePrefix`-Describe-Block einfügen:

```ts
describe('dedentWidth', () => {
  it('zählt bis zu unit-viele führende Leerzeichen', () => {
    expect(dedentWidth('    - Punkt', 2)).toBe(2);
    expect(dedentWidth(' a', 2)).toBe(1);
  });

  it('liefert 0 ohne führenden Whitespace', () => {
    expect(dedentWidth('- Punkt', 2)).toBe(0);
  });

  it('zählt ein führendes Tab-Zeichen als eine volle Stufe', () => {
    expect(dedentWidth('\ta', 2)).toBe(1);
  });
});
```

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

Run: `npx vitest run src/commands/__tests__/indent.test.ts src/utils/__tests__/text.test.ts`
Expected: FAIL — `dedentLines is not a function` bzw. Import-Fehler für `dedentWidth`; die Tests aus Task 1 und Task 0 bleiben grün.

- [ ] **Step 3a: `dedentWidth` in `src/commands/prefixes.ts` ergänzen**

Ans Dateiende von `src/commands/prefixes.ts` anfügen:

```ts
/**
 * Zählt den zu entfernenden führenden Whitespace einer Zeile: bis zu `unit`
 * Leerzeichen, weniger wenn weniger vorhanden sind. Ein führendes Tab-Zeichen
 * zählt als eine vollständige Einrückstufe und wird als Ganzes entfernt.
 * `0`, wenn die Zeile nicht mit Whitespace beginnt.
 */
export function dedentWidth(text: string, unit: number): number {
  if (text.startsWith('\t')) return 1;
  let width = 0;
  while (width < unit && text[width] === ' ') width++;
  return width;
}
```

- [ ] **Step 3b: `dedentLines` in `src/commands/indent.ts` ergänzen**

Import-Zeile in `indent.ts` erweitern:

```ts
import { dedentWidth } from './prefixes';
```

Ans Dateiende anfügen:

```ts
/**
 * Rückt alle von der Hauptselektion berührten Zeilen um bis zu ein `indentUnit`
 * aus. Zeilen ohne führenden Whitespace bleiben unverändert — der Command gibt
 * dennoch `true` zurück, damit `Shift-Tab` die Taste konsumiert und den Fokus
 * nicht aus dem Editor bewegt.
 */
export const dedentLines: SupaCommand = (view) => {
  const unit = getIndentUnit(view.state);
  mapSelectedLines(view, (line) => {
    const width = dedentWidth(line.text, unit);
    return width > 0 ? { from: line.from, to: line.from + width, insert: '' } : null;
  });
  return true;
};
```

`mapSelectedLines` (Task 0) übernimmt den `if (changes.length > 0)`-Guard bereits zentral — kein Duplikat hier nötig.

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/commands/__tests__/indent.test.ts src/utils/__tests__/text.test.ts`
Expected: PASS — 14 Tests in `indent.test.ts` grün, plus die neuen `dedentWidth`-Tests.

- [ ] **Step 5: Committen**

```bash
git add src/commands/prefixes.ts src/commands/indent.ts src/commands/__tests__/indent.test.ts src/utils/__tests__/text.test.ts
git commit -m "feat: dedentLines-Command fuer Shift-Tab

Entfernt bis zu ein indentUnit fuehrenden Whitespace pro Zeile;
fuehrendes Tab-Zeichen zaehlt als ganze Stufe. Zeilen am linken Rand
bleiben unveraendert, die Taste wird dennoch konsumiert.
dedentWidth liegt in prefixes.ts, der zentralen Stelle fuer
Zeilen-Praefix-Erkennung."
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

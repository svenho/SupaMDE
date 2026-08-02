# Eigene Tastenkürzel (extraKeys) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konsumenten von SupaMDE können über eine neue Option `extraKeys` eigene CodeMirror-6-`KeyBinding`s definieren — sowohl neue Tastenkürzel als auch Überschreibungen bestehender SupaMDE-Defaults.

**Architecture:** `SupaMDEOptions.extraKeys` (roh, optional) wird von `resolveOptions` auf `ResolvedOptions.extraKeys` (immer ein Array, Default `[]`) normalisiert. `buildExtensions` reiht `resolved.extraKeys` **vor** `supaKeymap` in die `keymap.of([...])`-Extension ein — CM6 wertet Bindings in Registrierungsreihenfolge aus, der erste Treffer gewinnt, wodurch Overrides und Neuzugänge ohne Sonderfall-Logik funktionieren. `KeyBinding` wird zusätzlich aus `src/index.ts` re-exportiert, damit Konsumenten den Typ nutzen können, ohne `@codemirror/view` separat zu importieren.

**Tech Stack:** TypeScript 5.9, CodeMirror 6 (`@codemirror/view`, `@codemirror/commands`), Vitest 4.

## Global Constraints

- `extraKeys` ist exakt `KeyBinding[]` aus `@codemirror/view` — keine vereinfachte Zwischenform, keine Auto-Defaults wie automatisches `preventDefault`.
- Precedence ausschließlich über Registrierungsreihenfolge (`extraKeys` vor `supaKeymap`) — kein explizites Override-Flag, keine Konflikt-Warnung.
- Kein generisches `extensions?: Extension[]`-Feld — Scope ist strikt auf Tastenkürzel begrenzt (siehe Spec, Abschnitt „Bewusste Nicht-Ziele“).
- Default von `extraKeys` ist `[]` (leeres Array), nicht `undefined`, damit `buildExtensions` immer ein Array spreaden kann.

---

## Datei-Übersicht

- Modify: `src/options.ts` — `extraKeys?: KeyBinding[]` in `SupaMDEOptions`, `extraKeys: KeyBinding[]` in `ResolvedOptions`, Default in `resolveOptions`.
- Modify: `src/editor/extensions.ts` — `resolved.extraKeys` vor `supaKeymap` in die `keymap.of([...])`-Liste einreihen.
- Modify: `src/index.ts` — `export type { KeyBinding } from '@codemirror/view';`
- Modify: `src/__tests__/options.test.ts` — Tests für Default und Passthrough von `extraKeys`.
- Modify: `src/editor/__tests__/extensions.test.ts` — Tests für Override- und Neu-Binding-Verhalten.
- Modify: `README.md` — neue Zeile in der Options-Tabelle (M1) + neuer Unterabschnitt „Eigene Tastenkürzel“ im Tastenkürzel-Kapitel (M2).

Reihenfolge: erst `options.ts` (Task 1, TDD-Basis), dann `extensions.ts` (Task 2, baut auf Task 1 auf), dann der Re-Export in `index.ts` (Task 3, unabhängig, aber klein), zuletzt README (Task 4, dokumentiert das fertige Verhalten).

---

### Task 1: `extraKeys` in `SupaMDEOptions` / `ResolvedOptions`

**Files:**
- Modify: `src/options.ts`
- Test: `src/__tests__/options.test.ts`

**Interfaces:**
- Consumes: nichts (reine Options-Normalisierung, wie die bestehenden Felder).
- Produces: `ResolvedOptions.extraKeys: KeyBinding[]` — von Task 2 (`buildExtensions`) konsumiert.

- [ ] **Step 1: Fehlschlagenden Test für den Default schreiben**

In `src/__tests__/options.test.ts`, im `describe('resolveOptions', ...)`-Block, den bestehenden ersten Test ersetzen:

```typescript
  it('setzt Defaults bei leeren Optionen', () => {
    const r = resolveOptions({});
    expect(r).toEqual({
      lineWrapping: true,
      placeholder: null,
      autofocus: false,
      tabSize: 2,
      indentUnit: 2,
      extraKeys: [],
    });
  });
```

Direkt danach (innerhalb desselben `describe`-Blocks) einen neuen Test ergänzen:

```typescript
  it('übernimmt gesetzte extraKeys unverändert', () => {
    const run = () => true;
    const extraKeys = [{ key: 'Mod-b', run }];
    const r = resolveOptions({ extraKeys });
    expect(r.extraKeys).toEqual(extraKeys);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run test:run -- options.test.ts`
Expected: FAIL — `r.extraKeys` ist `undefined` bzw. die erste Assertion (`toEqual` mit `extraKeys: []`) schlägt fehl, weil `resolveOptions` das Feld noch nicht kennt.

- [ ] **Step 3: `extraKeys` in `SupaMDEOptions`, `ResolvedOptions` und `resolveOptions` ergänzen**

In `src/options.ts`, Zeile 1, den Import um `KeyBinding` erweitern:

```typescript
import type { ToolbarOption } from './ui/toolbar-config';
import type { StatusOption } from './ui/statusbar';
import type { KeyBinding } from '@codemirror/view';
```

In `SupaMDEOptions` (nach `initialValue?: string;`, Zeile 19) ergänzen:

```typescript
  /** Eigene Tastenkürzel; haben Vorrang vor den SupaMDE-Defaults bei Konflikten. */
  extraKeys?: KeyBinding[];
```

In `ResolvedOptions` (nach `indentUnit: number;`, Zeile 42) ergänzen:

```typescript
  extraKeys: KeyBinding[];
```

In `resolveOptions` (nach `indentUnit: options.indentUnit ?? 2,`, Zeile 52) ergänzen:

```typescript
    extraKeys: options.extraKeys ?? [],
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npm run test:run -- options.test.ts`
Expected: PASS — alle Tests in `options.test.ts` grün, inkl. der beiden neuen/geänderten.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/options.ts src/__tests__/options.test.ts
git commit -m "feat: extraKeys-Option in SupaMDEOptions/ResolvedOptions"
```

---

### Task 2: `extraKeys` in `buildExtensions` verdrahten

**Files:**
- Modify: `src/editor/extensions.ts`
- Test: `src/editor/__tests__/extensions.test.ts`

**Interfaces:**
- Consumes: `ResolvedOptions.extraKeys: KeyBinding[]` (aus Task 1).
- Produces: `buildExtensions(resolved, sink?)` berücksichtigt `resolved.extraKeys` in der `keymap`-Extension, mit Vorrang vor `supaKeymap`.

- [ ] **Step 1: Fehlschlagende Tests schreiben**

In `src/editor/__tests__/extensions.test.ts`, am Ende des `describe('buildExtensions', ...)`-Blocks (nach dem letzten Test, vor der schließenden `});` in Zeile 124) zwei neue Tests ergänzen:

```typescript
  it('extraKeys überschreiben ein bestehendes SupaMDE-Default-Binding (Mod-b)', () => {
    const calls: string[] = [];
    const view = new EditorView({
      state: stateFrom({
        ...base,
        extraKeys: [{ key: 'Mod-b', run: () => { calls.push('custom'); return true; } }],
      }),
    });
    view.dom.ownerDocument.body.appendChild(view.dom);
    view.focus();
    const event = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true });
    view.contentDOM.dispatchEvent(event);
    expect(calls).toEqual(['custom']);
    view.destroy();
  });

  it('extraKeys ergänzen ein neues, bisher unbelegtes Binding', () => {
    const calls: string[] = [];
    const view = new EditorView({
      state: stateFrom({
        ...base,
        extraKeys: [{ key: 'Mod-Alt-z', run: () => { calls.push('neu'); return true; } }],
      }),
    });
    view.dom.ownerDocument.body.appendChild(view.dom);
    view.focus();
    const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true, bubbles: true });
    view.contentDOM.dispatchEvent(event);
    expect(calls).toEqual(['neu']);
    view.destroy();
  });
```

`stateFrom` erwartet ab jetzt ein `ResolvedOptions`-Objekt mit `extraKeys` — da `base` (Zeile 9-15) noch kein `extraKeys` hat, direkt im selben Schritt `base` erweitern:

```typescript
const base: ResolvedOptions = {
  lineWrapping: true,
  placeholder: null,
  autofocus: false,
  tabSize: 2,
  indentUnit: 2,
  extraKeys: [],
};
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `npm run test:run -- extensions.test.ts`
Expected: FAIL — entweder ein TypeScript-Fehler (`extraKeys` fehlt auf `ResolvedOptions` falls Task 1 nicht gemerged ist — sollte aber bereits vorhanden sein) oder die beiden neuen Tests schlagen fehl, weil `buildExtensions` `resolved.extraKeys` noch ignoriert (der Custom-Handler wird nie aufgerufen, `calls` bleibt leer, `Mod-b` triggert stattdessen weiterhin `bold`).

- [ ] **Step 3: `extraKeys` in die Keymap-Extension einreihen**

In `src/editor/extensions.ts`, Zeile 24:

```typescript
    keymap.of([...supaKeymap, ...historyKeymap, ...defaultKeymap]),
```

ersetzen durch:

```typescript
    keymap.of([...resolved.extraKeys, ...supaKeymap, ...historyKeymap, ...defaultKeymap]),
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npm run test:run -- extensions.test.ts`
Expected: PASS — alle Tests in `extensions.test.ts` grün, inkl. der beiden neuen.

- [ ] **Step 5: Vollständige Testsuite + Typecheck**

Run: `npm run test:run && npm run typecheck`
Expected: alle Tests grün (119+4 aus diesem Plan), keine Typfehler. Falls die Testsuite an anderer Stelle `ResolvedOptions`-Literale ohne `extraKeys` enthält (z. B. weitere Testdateien), schlägt der Typecheck dort fehl — in dem Fall die betroffene Stelle um `extraKeys: []` ergänzen, bevor fortgefahren wird.

- [ ] **Step 6: Commit**

```bash
git add src/editor/extensions.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat: extraKeys mit Vorrang vor SupaMDE-Defaults in buildExtensions verdrahten"
```

---

### Task 3: `KeyBinding`-Typ aus `src/index.ts` re-exportieren

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `KeyBinding` aus `@codemirror/view` (bereits Peer Dependency, siehe `2026-07-23-cm6-peer-dependency-design.md`).
- Produces: `import type { KeyBinding } from 'supamde'` funktioniert für Konsumenten.

- [ ] **Step 1: Re-Export ergänzen**

In `src/index.ts`, direkt nach der bestehenden Zeile

```typescript
export type { SupaMDEOptions } from './options';
```

ergänzen:

```typescript
export type { KeyBinding } from '@codemirror/view';
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build läuft durch; in `dist/index.d.ts` taucht `export type { KeyBinding } from '@codemirror/view';` (oder eine inhaltsgleiche re-export-Deklaration) auf.

Prüfen:

```bash
grep -n "KeyBinding" dist/index.d.ts
```

Expected: mindestens ein Treffer.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: KeyBinding-Typ aus @codemirror/view re-exportieren"
```

---

### Task 4: README-Dokumentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: das fertige `extraKeys`-Verhalten aus Task 1-3.
- Produces: nichts (reine Dokumentation, letzter Task).

- [ ] **Step 1: Zeile in der Options-Tabelle (Kern-Set, M1) ergänzen**

In `README.md`, nach Zeile 78:

```
| `initialValue` | `string`              | Textarea-Inhalt | Startwert (überschreibt Textarea).         |
```

eine neue Zeile einfügen:

```
| `extraKeys`    | `KeyBinding[]`        | `[]`            | Eigene CodeMirror-6-Tastenkürzel; haben Vorrang vor den SupaMDE-Defaults. |
```

- [ ] **Step 2: Unterabschnitt „Eigene Tastenkürzel“ im Kapitel „Tastenkürzel (M2)“ ergänzen**

In `README.md`, nach dem Absatz, der mit

```
> **Hinweis (deutsche Mac-Tastatur):** `Mod-'` (Blockzitat) liegt hier auf
> `Cmd+Shift+#` und wird je nach Browser nicht zuverlässig erkannt. Nutze
> stattdessen das layout-unabhängige `Ctrl-Alt-Q`.
```

endet (unmittelbar vor der Überschrift `## Formatierung anpassen`), folgenden neuen Abschnitt einfügen:

```markdown
### Eigene Tastenkürzel

Über `extraKeys` lassen sich beliebige CodeMirror-6-`KeyBinding`s ergänzen.
CM6 wertet Tastenkürzel in Registrierungsreihenfolge aus — der erste
passende Eintrag gewinnt. `extraKeys` steht **vor** den SupaMDE-Defaults,
wodurch sich sowohl neue Kürzel als auch Überschreibungen bestehender
Defaults gleich verhalten:

```ts
import SupaMDE, { type KeyBinding } from 'supamde';
import { insertNewlineAndIndent } from '@codemirror/commands';

const extraKeys: KeyBinding[] = [
  // Override: ersetzt das eingebaute Mod-B (fett)
  { key: 'Mod-b', run: (view) => { /* eigene Aktion */ return true; } },
  // Neu: bisher unbelegter Key
  { key: 'Mod-Enter', run: insertNewlineAndIndent },
];

const editor = new SupaMDE({
  element: document.getElementById('editor'),
  extraKeys,
});
```
```

- [ ] **Step 3: Manuell gegen die tatsächliche API prüfen**

Sicherstellen, dass im README-Beispiel:
- `SupaMDE` als Default-Export importiert wird (passt zu `export default SupaMDE;` in `src/index.ts`).
- `KeyBinding` als benannter Type-Import aus `'supamde'` kommt (passt zum Re-Export aus Task 3).
- `extraKeys` als Konstruktor-Option übergeben wird (passt zu `SupaMDEOptions.extraKeys` aus Task 1).

Kein automatisierter Test nötig — README-Codeblöcke werden nicht kompiliert; die Prüfung erfolgt durch Abgleich mit den in Task 1-3 fertiggestellten Signaturen.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: extraKeys in README dokumentieren"
```

---

## Abschlussverifikation

Nach Task 4, einmal die komplette Kette laufen lassen:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: alle vier Befehle laufen ohne Fehler durch.

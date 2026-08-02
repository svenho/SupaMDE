# SupaMDE M3 — Toolbar & Statusbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine konfigurierbare Toolbar und Statusbar bauen, verdrahtet über einen zentralen `EditorView.updateListener`, mit gebündelten Lucide-Icons.

**Architecture:** Built-in-Buttons werden über eine Registry (`ui/actions.ts`) auf die vorhandenen M2-`SupaCommand`s abgebildet; Custom-Buttons behalten die easyMDE-`action(editor)`-Signatur. Der Aktiv-Zustand der Buttons kommt aus reinen `EditorState`-Abfragen in `commands/queries.ts`. Diese Queries sind die **einzige Quelle** für Heading-Erkennung und die Syntaxbaum-Traversierung: `block.ts` und `inline.ts` werden so refaktoriert, dass sie auf `queries.ts` aufsetzen (echtes Extrahieren, keine Duplizierung der Regex/Traversierung). Ein einziger `updateListener` speist Toolbar-Aktiv-Zustand und Statusbar.

**Tech Stack:** TypeScript (strict), CodeMirror 6, Lucide (`lucide` npm-Paket, gebündelt), Vitest + jsdom.

## Global Constraints

- **TypeScript** bewusst auf `5.9.x` (nicht 7.x) — wegen `typescript-eslint`. Nicht anheben.
- **Paket ist ESM-only** — keinen `require`-Einstieg hinzufügen. (Die `vite.config` baut derzeit noch ein UMD-Format mit; das ist ein bestehender Zustand außerhalb von M3 und wird hier NICHT geändert. Neue Dependencies müssen aber so gebündelt werden, dass der `npm run build` grün bleibt — siehe Task 3.)
- Neue Module folgen dem Namensschema aus dem CM6-Design §2 (`ui/`, `features/`, `commands/`).
- Jede reine Logik (`wordCount`, Queries, Config-Normalisierung) ist unit-getestet; DOM-nahe Module (Toolbar/Statusbar) komponenten-getestet in jsdom.
- Command-Verhalten bleibt bei der `queries.ts`-Extraktion **beobachtbar identisch** — reine Refaktorierung: `block.ts`/`inline.ts` rufen künftig die Query-Helfer, statt die Logik zu duplizieren. Abgesichert durch die vorhandenen `commands/__tests__/*` (die über die öffentlichen Commands `setHeading`, `bold` … testen, nicht über die internen Helfer — deshalb ohne Änderung als Sicherheitsnetz nutzbar).
- `Mod` = `Cmd` auf macOS, `Ctrl` sonst.
- Tests laufen mit `npx vitest run <pfad>`; die jsdom-Umgebung ist projektweit in der Vitest-Config gesetzt.

---

### Task 1: `wordCount`-Utility

**Files:**
- Create: `src/features/word-count.ts`
- Test: `src/features/__tests__/word-count.test.ts`

**Interfaces:**
- Produces: `wordCount(text: string): number` — zählt Wörter (durch Whitespace getrennte, nicht-leere Tokens).

- [ ] **Step 1: Write the failing test**

`src/features/__tests__/word-count.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { wordCount } from '../word-count';

describe('wordCount', () => {
  it('zählt einfache Wörter', () => {
    expect(wordCount('hallo welt')).toBe(2);
  });

  it('liefert 0 für leeren Text', () => {
    expect(wordCount('')).toBe(0);
  });

  it('liefert 0 für reinen Whitespace', () => {
    expect(wordCount('   \n\t  ')).toBe(0);
  });

  it('kollabiert mehrfachen Whitespace', () => {
    expect(wordCount('ein   zwei\n\ndrei\tvier')).toBe(4);
  });

  it('zählt Unicode-Wörter', () => {
    expect(wordCount('Grüße über Ätna')).toBe(3);
  });

  it('ignoriert führenden/abschließenden Whitespace', () => {
    expect(wordCount('  hallo  ')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/__tests__/word-count.test.ts`
Expected: FAIL — Modul `../word-count` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/features/word-count.ts`:

```typescript
/**
 * Zählt Wörter in `text`: durch Whitespace getrennte, nicht-leere Tokens.
 * Reine Funktion — das neue Sicherheitsnetz, das easyMDE fehlt.
 */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/__tests__/word-count.test.ts`
Expected: PASS (6 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/word-count.ts src/features/__tests__/word-count.test.ts
git commit -m "feat(features): wordCount-Utility mit Unit-Tests"
```

---

### Task 2: Zustands-Abfragen (`queries.ts`) — einzige Quelle für Heading-Erkennung & Node-Traversierung

**Files:**
- Create: `src/commands/queries.ts`
- Test: `src/commands/__tests__/queries.test.ts`
- Modify: `src/commands/block.ts` (interne `currentLevel` durch `activeHeadingLevel` ersetzen)
- Modify: `src/commands/inline.ts` (interne `enclosingNode` auf `resolveEnclosingNode` aus `queries.ts` aufsetzen)

**Interfaces:**
- Consumes: `syntaxTree` (`@codemirror/language`), `SyntaxNode` (`@lezer/common`), `selectedLineRange` (`../utils/text`).
- Produces (alle auf `EditorState`):
  - `resolveEnclosingNode(state, nodeName): SyntaxNode | null` — die **gemeinsame Traversierung**: liefert den umschließenden Knoten `nodeName` um die Hauptselektion (oder `null`). Basis für die Bool-Queries **und** für `inline.ts`' Toggle-Off (das den Knoten zum Entfernen der Marker braucht).
  - `isBold(state): boolean`, `isItalic(state): boolean`, `isStrikethrough(state): boolean`, `isInlineCode(state): boolean`
  - `activeHeadingLevel(state): number` (0 = keins, sonst 1–6) — die **einzige** Heading-Regex im Projekt.
  - `isQuote(state): boolean`, `isInUnorderedList(state): boolean`, `isInOrderedList(state): boolean`, `isInCheckList(state): boolean`

**Hintergrund:** Die M2-Toggle-Commands prüfen ihren Zustand intern und dispatchen. Bisher steckt dieselbe Logik doppelt in `block.ts` (`currentLevel`) und `inline.ts` (`enclosingNode`). Diese Task macht `queries.ts` zur **einzigen Quelle**:
- **Heading:** `activeHeadingLevel(state)` ersetzt `currentLevel(view)` vollständig — `block.ts` ruft künftig `activeHeadingLevel(view.state)`.
- **Inline:** `resolveEnclosingNode(state, name)` ist die gemeinsame Traversierung. Die Bool-Query (`isBold` …) ist `resolveEnclosingNode(state, name) !== null`; `inline.ts`' internes `enclosingNode(view, spec)` wird zu einem dünnen Wrapper `resolveEnclosingNode(view.state, spec.node)` (es braucht die Node weiterhin zum Entfernen der Marker in `unwrap`).
- **Block/Listen** (`isQuote`, `isInUnorderedList` …) prüfen den Zeilentext der ersten Selektionszeile per Regex/`startsWith`, deckungsgleich mit `list.ts`/`toggleLinePrefix` — hier gibt es keinen gemeinsam nutzbaren Helfer in den Commands (die arbeiten zeilenweise über den ganzen Bereich), deshalb bleibt diese Read-Only-Variante eigenständig, aber unter denselben Regexen.

- [ ] **Step 1: Write the failing test**

`src/commands/__tests__/queries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import {
  resolveEnclosingNode,
  isBold,
  isItalic,
  isStrikethrough,
  isInlineCode,
  activeHeadingLevel,
  isQuote,
  isInUnorderedList,
  isInOrderedList,
  isInCheckList,
} from '../queries';

/** Baut einen State, dessen Cursor bei `pos` (Default: Mitte von `doc`) steht. */
function stateAt(doc: string, pos = Math.floor(doc.length / 2)): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [markdown({ extensions: GFM })],
  });
}

describe('resolveEnclosingNode', () => {
  it('liefert den umschließenden Knoten', () => {
    const doc = 'ein **fetter** text';
    const node = resolveEnclosingNode(stateAt(doc, doc.indexOf('fetter') + 2), 'StrongEmphasis');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('StrongEmphasis');
  });

  it('liefert null, wenn kein solcher Knoten umschließt', () => {
    expect(resolveEnclosingNode(stateAt('nur klartext', 3), 'StrongEmphasis')).toBeNull();
  });
});

describe('inline queries', () => {
  it('isBold erkennt Cursor in **fett**', () => {
    const doc = 'ein **fetter** text';
    expect(isBold(stateAt(doc, doc.indexOf('fetter') + 2))).toBe(true);
  });

  it('isBold ist false außerhalb', () => {
    expect(isBold(stateAt('nur klartext', 3))).toBe(false);
  });

  it('isItalic erkennt Cursor in *kursiv*', () => {
    const doc = 'ein *kursiver* text';
    expect(isItalic(stateAt(doc, doc.indexOf('kursiver') + 2))).toBe(true);
  });

  it('isStrikethrough erkennt ~~durch~~', () => {
    const doc = 'ein ~~weg~~ text';
    expect(isStrikethrough(stateAt(doc, doc.indexOf('weg') + 1))).toBe(true);
  });

  it('isInlineCode erkennt `code`', () => {
    const doc = 'ein `x` text';
    expect(isInlineCode(stateAt(doc, doc.indexOf('x')))).toBe(true);
  });
});

describe('block/list queries', () => {
  it('activeHeadingLevel liefert die #-Ebene', () => {
    expect(activeHeadingLevel(stateAt('### Titel', 5))).toBe(3);
  });

  it('activeHeadingLevel liefert 0 ohne Überschrift', () => {
    expect(activeHeadingLevel(stateAt('Absatz', 2))).toBe(0);
  });

  it('isQuote erkennt Blockzitat', () => {
    expect(isQuote(stateAt('> zitat', 3))).toBe(true);
    expect(isQuote(stateAt('kein zitat', 3))).toBe(false);
  });

  it('isInUnorderedList erkennt - und *', () => {
    expect(isInUnorderedList(stateAt('- punkt', 3))).toBe(true);
    expect(isInUnorderedList(stateAt('* punkt', 3))).toBe(true);
    expect(isInUnorderedList(stateAt('kein punkt', 3))).toBe(false);
  });

  it('isInOrderedList erkennt 1.', () => {
    expect(isInOrderedList(stateAt('1. punkt', 3))).toBe(true);
    expect(isInOrderedList(stateAt('- punkt', 3))).toBe(false);
  });

  it('isInCheckList erkennt - [ ]', () => {
    expect(isInCheckList(stateAt('- [ ] task', 5))).toBe(true);
    expect(isInCheckList(stateAt('- punkt', 3))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/commands/__tests__/queries.test.ts`
Expected: FAIL — Modul `../queries` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/commands/queries.ts`:

```typescript
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { selectedLineRange } from '../utils/text';

/**
 * Die gemeinsame Syntaxbaum-Traversierung: liefert den Knoten namens `nodeName`,
 * der die Hauptselektion umschließt (oder `null`). EINZIGE Quelle dieser
 * Traversierung im Projekt — `inline.ts` setzt hierauf auf (es braucht die Node
 * zum Entfernen der Marker), die Bool-Queries sind `!== null` darüber.
 */
export function resolveEnclosingNode(
  state: EditorState,
  nodeName: string,
): SyntaxNode | null {
  const sel = state.selection.main;
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sel.from, 1);
  while (node) {
    if (node.name === nodeName && node.from <= sel.from && node.to >= sel.to) {
      return node;
    }
    node = node.parent;
  }
  return null;
}

/** Text der ersten von der Selektion berührten Zeile. */
function firstSelectedLineText(state: EditorState): string {
  const { firstLine } = selectedLineRange(state);
  return state.doc.line(firstLine).text;
}

export function isBold(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'StrongEmphasis') !== null;
}

export function isItalic(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'Emphasis') !== null;
}

export function isStrikethrough(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'Strikethrough') !== null;
}

export function isInlineCode(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'InlineCode') !== null;
}

/**
 * Aktuelle Heading-Ebene der ersten Selektionszeile (0 = keine). EINZIGE
 * Heading-Regex im Projekt — `block.ts` (`setHeading`, `headingSmaller`,
 * `headingBigger`) ruft diese Funktion statt einer eigenen `currentLevel`.
 * `match[0].length - 1` = #-Zeichen ohne das trennende Leerzeichen (identisch
 * zur bisherigen `currentLevel`-Semantik).
 */
export function activeHeadingLevel(state: EditorState): number {
  const match = /^(#{1,6}) /.exec(firstSelectedLineText(state));
  return match ? match[0].length - 1 : 0;
}

export function isQuote(state: EditorState): boolean {
  return firstSelectedLineText(state).startsWith('> ');
}

export function isInUnorderedList(state: EditorState): boolean {
  const text = firstSelectedLineText(state);
  // Bullet, aber NICHT die Checklisten-Form (die zählt als eigene Query).
  return /^[-*] /.test(text) && !/^- \[[ xX]\] /.test(text);
}

export function isInOrderedList(state: EditorState): boolean {
  return /^\d+\. /.test(firstSelectedLineText(state));
}

export function isInCheckList(state: EditorState): boolean {
  return /^- \[[ xX]\] /.test(firstSelectedLineText(state));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/commands/__tests__/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Refaktoriere `block.ts` — `currentLevel` durch `activeHeadingLevel` ersetzen**

In `src/commands/block.ts` die lokale `currentLevel`-Funktion **entfernen** und stattdessen die Query nutzen. Import ergänzen:

```typescript
import { activeHeadingLevel } from './queries';
```

Die drei Aufrufstellen umstellen (aus `currentLevel(view)` wird `activeHeadingLevel(view.state)`):

```typescript
export function setHeading(level: HeadingLevel): SupaCommand {
  return (view) => applyHeading(view, activeHeadingLevel(view.state) === level ? 0 : level);
}

export const headingSmaller: SupaCommand = (view) => {
  const next = Math.min(activeHeadingLevel(view.state) + 1, 6);
  return applyHeading(view, next);
};

export const headingBigger: SupaCommand = (view) => {
  const next = Math.max(activeHeadingLevel(view.state) - 1, 0);
  return applyHeading(view, next);
};
```

Die lokale `currentLevel`-Funktion und ihre Regex sind danach gelöscht. Verifiziere, dass die vorhandenen Heading-Tests weiter grün sind (sie testen über `setHeading` etc., nicht über `currentLevel`):

Run: `npx vitest run src/commands/__tests__/block.test.ts`
Expected: PASS (unverändert — reine Refaktorierung, gleiche Semantik).

- [ ] **Step 6: Refaktoriere `inline.ts` — `enclosingNode` auf `resolveEnclosingNode` aufsetzen**

In `src/commands/inline.ts` die interne `enclosingNode`-Funktion so umbauen, dass sie die gemeinsame Traversierung nutzt (die `unwrap`-Logik bleibt, sie braucht die Node weiterhin). Import ergänzen:

```typescript
import { resolveEnclosingNode } from './queries';
```

Die lokale `enclosingNode` durch einen dünnen Wrapper ersetzen — der `syntaxTree`/`SyntaxNode`-Traversierungscode entfällt, `spec` wird nur noch für `spec.node` gebraucht:

```typescript
/** Sucht den umschließenden Knoten `spec.node` um die Selektion (teilt die Traversierung mit queries.ts). */
function enclosingNode(view: EditorView, spec: InlineSpec): SyntaxNode | null {
  return resolveEnclosingNode(view.state, spec.node);
}
```

Danach ist der direkte `syntaxTree`-Import in `inline.ts` nur noch nötig, falls er anderweitig verwendet wird — prüfen und den ungenutzten Import entfernen (ESLint/`npm run lint` meldet ihn sonst). `SyntaxNode` bleibt importiert (Rückgabetyp von `enclosingNode` und Parameter von `unwrap`).

Run: `npx vitest run src/commands/__tests__/inline.test.ts`
Expected: PASS (unverändert — reine Refaktorierung, gleiche Marker-Semantik).

- [ ] **Step 7: Lint + restliche Command-Tests grün**

Run: `npm run lint && npx vitest run src/commands/__tests__/list.test.ts`
Expected: kein Lint-Fehler (keine ungenutzten Imports in `block.ts`/`inline.ts`); `list.test.ts` unverändert grün.

- [ ] **Step 8: Commit**

```bash
git add src/commands/queries.ts src/commands/__tests__/queries.test.ts src/commands/block.ts src/commands/inline.ts
git commit -m "feat(commands): EditorState-Queries als einzige Quelle für Heading/Node-Traversierung"
```

---

### Task 3: Icon-Modul (`ui/icons.ts`) mit gebündeltem Lucide

**Files:**
- Create: `src/ui/icons.ts`
- Test: `src/ui/__tests__/icons.test.ts`
- Modify: `package.json` (Dependency `lucide` ergänzen)

**Interfaces:**
- Consumes: `createElement` und benannte Icon-Daten aus `lucide`.
- Produces:
  - `renderIcon(name: string): SVGElement` — liefert ein fertiges Lucide-SVGElement für einen bekannten Built-in-Icon-Namen.
  - `hasIcon(name: string): boolean` — ob ein Icon-Name bekannt ist.

- [ ] **Step 1: Dependency installieren**

Run: `npm install lucide@^1.25.0`
Expected: `lucide` erscheint in `package.json` unter `dependencies`; `package-lock.json` aktualisiert. (Lucide ist ISC-lizenziert und ohne Transitiv-Deps.)

- [ ] **Step 2: Write the failing test**

`src/ui/__tests__/icons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderIcon, hasIcon } from '../icons';

describe('icons', () => {
  it('hasIcon erkennt bekannten Namen', () => {
    expect(hasIcon('bold')).toBe(true);
  });

  it('hasIcon lehnt unbekannten Namen ab', () => {
    expect(hasIcon('gibt-es-nicht')).toBe(false);
  });

  it('renderIcon liefert ein SVGElement', () => {
    const el = renderIcon('bold');
    expect(el).toBeInstanceOf(SVGElement);
    expect(el.tagName.toLowerCase()).toBe('svg');
  });

  it('renderIcon wirft bei unbekanntem Namen', () => {
    expect(() => renderIcon('gibt-es-nicht')).toThrow();
  });

  it('kennt alle Default-Toolbar-Icons', () => {
    for (const name of [
      'bold', 'italic', 'strikethrough', 'code',
      'heading', 'quote', 'code-block', 'horizontal-rule', 'clean-block',
      'unordered-list', 'ordered-list', 'check-list',
      'link', 'image', 'table', 'undo', 'redo',
    ]) {
      expect(hasIcon(name), name).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/icons.test.ts`
Expected: FAIL — Modul `../icons` nicht gefunden.

- [ ] **Step 4: Write minimal implementation**

`src/ui/icons.ts`:

```typescript
import {
  createElement,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading,
  Quote,
  SquareCode,
  Minus,
  Eraser,
  List,
  ListOrdered,
  ListChecks,
  Link,
  Image,
  Table,
  Undo,
  Redo,
  type IconNode,
} from 'lucide';

/**
 * Mapping Built-in-Icon-Name → Lucide-Icon-Daten. Die Namen sind die von der
 * Toolbar-Registry (`ui/actions.ts`) verwendeten Built-in-Schlüssel.
 */
const ICONS: Record<string, IconNode> = {
  bold: Bold,
  italic: Italic,
  strikethrough: Strikethrough,
  code: Code,
  heading: Heading,
  quote: Quote,
  'code-block': SquareCode,
  'horizontal-rule': Minus,
  'clean-block': Eraser,
  'unordered-list': List,
  'ordered-list': ListOrdered,
  'check-list': ListChecks,
  link: Link,
  image: Image,
  table: Table,
  undo: Undo,
  redo: Redo,
};

/** Ob ein Icon-Name bekannt ist. */
export function hasIcon(name: string): boolean {
  return name in ICONS;
}

/** Liefert ein fertiges Lucide-SVGElement für `name`; wirft bei unbekanntem Namen. */
export function renderIcon(name: string): SVGElement {
  const data = ICONS[name];
  if (!data) {
    throw new Error(`SupaMDE: unbekanntes Icon "${name}".`);
  }
  return createElement(data);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/icons.test.ts`
Expected: PASS.

> Falls ein Icon-Import-Name (z.B. `SquareCode`, `ListChecks`) in Lucide 1.25 anders heißt, meldet TypeScript/Vitest einen fehlenden Export. In dem Fall den korrekten PascalCase-Namen aus `node_modules/lucide/dist/lucide.d.ts` per `grep` bestimmen (`grep -i "squarecode\|listcheck" node_modules/lucide/dist/lucide.d.ts`) und ersetzen; das Icon-Konzept bleibt identisch.

- [ ] **Step 6: Build verifizieren (Lucide muss in beide Formate gebündelt werden)**

Die `vite.config` baut `['es', 'umd']`. `lucide` ist eine echte Laufzeit-Dependency und
darf NICHT externalisiert werden (sonst hätte der UMD-Build ein unaufgelöstes `require`).
Da die aktuelle `rollupOptions` KEIN `external` setzt, bündelt Vite `lucide` automatisch in
beide Ausgaben mit ein — das ist das gewünschte Verhalten.

Run: `npm run build`
Expected: Build erfolgreich für **beide** Formate (`dist/supamde.mjs` und `dist/supamde.js`);
keine Warnung über „unresolved import lucide" und kein externalisiertes `lucide`.

> Falls der UMD-Build wider Erwarten über `lucide` stolpert (z.B. eine Rollup-Warnung
> „lucide is imported but could not be resolved"), NICHT `external` setzen — das würde die
> Autarkie brechen. Stattdessen prüfen, ob der Import-Pfad `from 'lucide'` korrekt ist
> (nicht `lucide/dist/...`). Das reine ESM-Ziel (`supamde.mjs`) ist der primäre Einstieg
> laut `package.json` (`exports`), UMD ist bestehender Altbestand.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/ui/icons.ts src/ui/__tests__/icons.test.ts
git commit -m "feat(ui): gebündeltes Lucide-Icon-Modul (renderIcon/hasIcon)"
```

---

### Task 4: Toolbar-Optionen-Typen & Registry (`ui/actions.ts`)

**Files:**
- Create: `src/ui/actions.ts`
- Test: `src/ui/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: alle M2-Commands (`bold`, `italic`, … aus `../commands/*`), Queries aus `../commands/queries`, `hasIcon` aus `./icons`, `SupaCommand` aus `../commands/types`.
- Produces:
  - `interface ToolbarAction { command: SupaCommand; query?: (state: EditorState) => boolean; icon: string; title: string; shortcut?: string; }`
  - `BUILTIN_ACTIONS: Record<string, ToolbarAction>` — Registry Built-in-Name → Action.
  - `getAction(name: string): ToolbarAction | undefined`

**Bewusste Grenzen dieser Task (dokumentiert, damit sie beim Ausführen nicht wie Versehen wirken):**
- **`unorderedListStar` (`* `-Bullet)** aus `list.ts` bekommt **keinen** eigenen Toolbar-Button. Der Button `unordered-list` bildet nur die Default-Variante (`- `) ab; die Star-Variante bleibt per Tastenkürzel erreichbar. Grund: ein zweiter Bullet-Button wäre für Nutzer verwirrend (gleiches Icon, gleiche Semantik).
- **`undo`/`redo` haben keine `query`** und damit **keinen Disabled-Zustand** — die Buttons sind immer klickbar, auch bei leerer History (ein Klick ist dann ein harmloser No-op). Ein ausgegrauter Zustand (wie in easyMDE) käme frühestens in einem späteren Meilenstein, da er zusätzlich den CM6-History-Zustand abfragen müsste. Für M3 bewusst ausgeklammert.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BUILTIN_ACTIONS, getAction } from '../actions';
import { hasIcon } from '../icons';

describe('BUILTIN_ACTIONS registry', () => {
  it('getAction liefert eine Action für bekannte Built-ins', () => {
    const bold = getAction('bold');
    expect(bold).toBeDefined();
    expect(typeof bold?.command).toBe('function');
    expect(bold?.title.length).toBeGreaterThan(0);
  });

  it('getAction liefert undefined für Unbekanntes', () => {
    expect(getAction('gibt-es-nicht')).toBeUndefined();
  });

  it('jede registrierte Action hat ein bekanntes Icon', () => {
    for (const [name, action] of Object.entries(BUILTIN_ACTIONS)) {
      expect(hasIcon(action.icon), `${name} → ${action.icon}`).toBe(true);
    }
  });

  it('Toggle-Aktionen haben eine query, Einfüge-Aktionen nicht', () => {
    expect(getAction('bold')?.query).toBeTypeOf('function');
    expect(getAction('link')?.query).toBeUndefined();
    expect(getAction('table')?.query).toBeUndefined();
    expect(getAction('undo')?.query).toBeUndefined();
  });

  it('registriert die absoluten Überschriften heading-1..6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(getAction(`heading-${i}`), `heading-${i}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/actions.test.ts`
Expected: FAIL — Modul `../actions` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/ui/actions.ts`:

```typescript
import type { EditorState } from '@codemirror/state';
import type { SupaCommand } from '../commands/types';
import { bold, italic, strikethrough, inlineCode } from '../commands/inline';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  horizontalRule,
  cleanBlock,
} from '../commands/block';
import { unorderedList, orderedList, checkList } from '../commands/list';
import { drawLink, drawImage } from '../commands/link-image';
import { table } from '../commands/table';
import { undo, redo } from '../commands/history';
import {
  isBold,
  isItalic,
  isStrikethrough,
  isInlineCode,
  isQuote,
  isInUnorderedList,
  isInOrderedList,
  isInCheckList,
  activeHeadingLevel,
} from '../commands/queries';

/** Ein Built-in-Toolbar-Eintrag: Command + optionaler Aktiv-Zustand + Anzeige. */
export interface ToolbarAction {
  command: SupaCommand;
  query?: (state: EditorState) => boolean;
  icon: string;
  title: string;
  shortcut?: string;
}

/** Erzeugt die query für eine absolute Überschrift `level`. */
function headingQuery(level: number): (state: EditorState) => boolean {
  return (state) => activeHeadingLevel(state) === level;
}

/** Registry: Built-in-Name → ToolbarAction. */
export const BUILTIN_ACTIONS: Record<string, ToolbarAction> = {
  bold: { command: bold, query: isBold, icon: 'bold', title: 'Fett', shortcut: 'Mod-B' },
  italic: { command: italic, query: isItalic, icon: 'italic', title: 'Kursiv', shortcut: 'Mod-I' },
  strikethrough: {
    command: strikethrough,
    query: isStrikethrough,
    icon: 'strikethrough',
    title: 'Durchgestrichen',
  },
  code: { command: inlineCode, query: isInlineCode, icon: 'code', title: 'Inline-Code' },

  'heading-smaller': {
    command: headingSmaller,
    icon: 'heading',
    title: 'Überschrift kleiner',
    shortcut: 'Mod-H',
  },
  'heading-bigger': {
    command: headingBigger,
    icon: 'heading',
    title: 'Überschrift größer',
    shortcut: 'Shift-Mod-H',
  },
  'heading-1': { command: setHeading(1), query: headingQuery(1), icon: 'heading', title: 'Überschrift 1' },
  'heading-2': { command: setHeading(2), query: headingQuery(2), icon: 'heading', title: 'Überschrift 2' },
  'heading-3': { command: setHeading(3), query: headingQuery(3), icon: 'heading', title: 'Überschrift 3' },
  'heading-4': { command: setHeading(4), query: headingQuery(4), icon: 'heading', title: 'Überschrift 4' },
  'heading-5': { command: setHeading(5), query: headingQuery(5), icon: 'heading', title: 'Überschrift 5' },
  'heading-6': { command: setHeading(6), query: headingQuery(6), icon: 'heading', title: 'Überschrift 6' },

  quote: { command: quote, query: isQuote, icon: 'quote', title: 'Blockzitat', shortcut: "Mod-'" },
  'code-block': { command: codeBlock, icon: 'code-block', title: 'Codeblock', shortcut: 'Mod-Alt-C' },
  'horizontal-rule': { command: horizontalRule, icon: 'horizontal-rule', title: 'Trennlinie' },
  'clean-block': { command: cleanBlock, icon: 'clean-block', title: 'Formatierung entfernen', shortcut: 'Mod-E' },

  'unordered-list': {
    command: unorderedList,
    query: isInUnorderedList,
    icon: 'unordered-list',
    title: 'Liste',
    shortcut: 'Mod-L',
  },
  'ordered-list': {
    command: orderedList,
    query: isInOrderedList,
    icon: 'ordered-list',
    title: 'Nummerierte Liste',
    shortcut: 'Mod-Alt-L',
  },
  'check-list': {
    command: checkList,
    query: isInCheckList,
    icon: 'check-list',
    title: 'Checkliste',
    shortcut: 'Shift-Mod-L',
  },

  link: { command: drawLink, icon: 'link', title: 'Link', shortcut: 'Mod-K' },
  image: { command: drawImage, icon: 'image', title: 'Bild', shortcut: 'Mod-Alt-I' },
  table: { command: table, icon: 'table', title: 'Tabelle' },

  undo: { command: undo, icon: 'undo', title: 'Rückgängig', shortcut: 'Mod-Z' },
  redo: { command: redo, icon: 'redo', title: 'Wiederholen', shortcut: 'Mod-Y' },
};

/** Liefert die Action zu einem Built-in-Namen, oder undefined. */
export function getAction(name: string): ToolbarAction | undefined {
  return BUILTIN_ACTIONS[name];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/actions.ts src/ui/__tests__/actions.test.ts
git commit -m "feat(ui): Toolbar-Action-Registry (Built-in-Name → SupaCommand)"
```

---

### Task 5: Toolbar-Config-Normalisierung (`ui/toolbar-config.ts`)

**Files:**
- Create: `src/ui/toolbar-config.ts`
- Test: `src/ui/__tests__/toolbar-config.test.ts`

**Interfaces:**
- Consumes: `getAction`, `ToolbarAction` aus `./actions`.
- Produces:
  - `interface CustomToolbarButton { name: string; action: (editor: unknown) => void; className?: string; title?: string; }`
  - `type ToolbarOption = false | Array<string | CustomToolbarButton>`
  - `DEFAULT_TOOLBAR: string[]` — die Default-Toolbar-Definition (nur M1/M2-Aktionen, mit `'|'`-Separatoren).
  - `type ResolvedToolbarItem = { kind: 'separator' } | { kind: 'builtin'; name: string; action: ToolbarAction } | { kind: 'custom'; button: CustomToolbarButton };`
  - `resolveToolbar(option: ToolbarOption | undefined): ResolvedToolbarItem[] | null` — `null` bei `false`; sonst die aufgelöste Item-Liste. Unbekannte Built-in-Strings werden übersprungen (mit `console.warn`).

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/toolbar-config.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { resolveToolbar, DEFAULT_TOOLBAR } from '../toolbar-config';

describe('resolveToolbar', () => {
  it('liefert null bei false', () => {
    expect(resolveToolbar(false)).toBeNull();
  });

  it('nutzt die Default-Toolbar bei undefined', () => {
    const items = resolveToolbar(undefined);
    expect(items).not.toBeNull();
    // Default enthält bold als Built-in
    expect(items!.some((i) => i.kind === 'builtin' && i.name === 'bold')).toBe(true);
  });

  it('löst Separatoren auf', () => {
    const items = resolveToolbar(['bold', '|', 'italic']);
    expect(items!.map((i) => i.kind)).toEqual(['builtin', 'separator', 'builtin']);
  });

  it('löst Custom-Buttons auf', () => {
    const action = vi.fn();
    const items = resolveToolbar([{ name: 'foo', action, className: 'fa fa-star', title: 'Foo' }]);
    expect(items).toHaveLength(1);
    expect(items![0]).toMatchObject({ kind: 'custom' });
  });

  it('überspringt unbekannte Built-in-Strings mit Warnung', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = resolveToolbar(['bold', 'gibt-es-nicht', 'italic']);
    expect(items!.filter((i) => i.kind === 'builtin')).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('DEFAULT_TOOLBAR enthält keine M4-Aktionen (preview/side-by-side/fullscreen)', () => {
    for (const forbidden of ['preview', 'side-by-side', 'fullscreen']) {
      expect(DEFAULT_TOOLBAR).not.toContain(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/toolbar-config.test.ts`
Expected: FAIL — Modul `../toolbar-config` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/ui/toolbar-config.ts`:

```typescript
import { getAction, type ToolbarAction } from './actions';

/** Ein Custom-Toolbar-Button (easyMDE-kompatibel): eigenes action(editor). */
export interface CustomToolbarButton {
  name: string;
  action: (editor: unknown) => void;
  className?: string;
  title?: string;
}

/** Die `toolbar`-Option: false, oder Liste aus Built-in-Namen/Custom-Buttons. */
export type ToolbarOption = false | Array<string | CustomToolbarButton>;

/**
 * Default-Toolbar — NUR M1/M2-Aktionen. Preview/SideBySide/Fullscreen kommen mit
 * M4. `'|'` ist ein Separator.
 */
export const DEFAULT_TOOLBAR: string[] = [
  'bold',
  'italic',
  'strikethrough',
  'code',
  '|',
  'heading-smaller',
  'heading-bigger',
  '|',
  'quote',
  'unordered-list',
  'ordered-list',
  'check-list',
  '|',
  'code-block',
  'horizontal-rule',
  '|',
  'link',
  'image',
  'table',
  '|',
  'clean-block',
  '|',
  'undo',
  'redo',
];

/** Aufgelöster Toolbar-Eintrag. */
export type ResolvedToolbarItem =
  | { kind: 'separator' }
  | { kind: 'builtin'; name: string; action: ToolbarAction }
  | { kind: 'custom'; button: CustomToolbarButton };

/**
 * Normalisiert die `toolbar`-Option zu einer aufgelösten Item-Liste.
 * `false` → null (keine Toolbar). `undefined` → DEFAULT_TOOLBAR.
 * Unbekannte Built-in-Strings werden mit Warnung übersprungen.
 */
export function resolveToolbar(
  option: ToolbarOption | undefined,
): ResolvedToolbarItem[] | null {
  if (option === false) return null;
  const items = option ?? DEFAULT_TOOLBAR;

  const resolved: ResolvedToolbarItem[] = [];
  for (const entry of items) {
    if (typeof entry === 'string') {
      if (entry === '|') {
        resolved.push({ kind: 'separator' });
        continue;
      }
      const action = getAction(entry);
      if (!action) {
        console.warn(`SupaMDE: unbekannte Toolbar-Aktion "${entry}" wird übersprungen.`);
        continue;
      }
      resolved.push({ kind: 'builtin', name: entry, action });
    } else {
      resolved.push({ kind: 'custom', button: entry });
    }
  }
  return resolved;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/toolbar-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/toolbar-config.ts src/ui/__tests__/toolbar-config.test.ts
git commit -m "feat(ui): Toolbar-Config-Normalisierung + Default-Toolbar"
```

---

### Task 6: Toolbar-Rendering (`ui/toolbar.ts`)

**Files:**
- Create: `src/ui/toolbar.ts`
- Test: `src/ui/__tests__/toolbar.test.ts`

**Interfaces:**
- Consumes: `resolveToolbar`, `ResolvedToolbarItem`, `ToolbarOption` aus `./toolbar-config`; `renderIcon` aus `./icons`; `EditorView` (`@codemirror/view`), `EditorState` (`@codemirror/state`).
- Produces:
  - `interface Toolbar { dom: HTMLElement; update(state: EditorState): void; destroy(): void; }`
  - `createToolbar(view: EditorView, option: ToolbarOption | undefined, editor: unknown): Toolbar | null` — `null` bei `false`. `editor` ist die SupaMDE-Instanz, die Custom-Buttons als `action(editor)`-Argument bekommen.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/toolbar.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { createToolbar } from '../toolbar';

function makeView(doc = ''): EditorView {
  return new EditorView({
    state: EditorState.create({ doc, extensions: [markdown({ extensions: GFM })] }),
  });
}

describe('createToolbar', () => {
  it('liefert null bei toolbar=false', () => {
    const view = makeView();
    expect(createToolbar(view, false, {})).toBeNull();
    view.destroy();
  });

  it('rendert Buttons und Separatoren', () => {
    const view = makeView();
    const toolbar = createToolbar(view, ['bold', '|', 'italic'], {})!;
    expect(toolbar.dom.querySelectorAll('button').length).toBe(2);
    expect(toolbar.dom.querySelectorAll('.supamde-separator').length).toBe(1);
    view.destroy();
  });

  it('Klick auf einen Built-in-Button verändert das Doc', () => {
    const view = makeView('text');
    view.dispatch({ selection: { anchor: 0, head: 4 } });
    const toolbar = createToolbar(view, ['bold'], {})!;
    const btn = toolbar.dom.querySelector('button')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.state.doc.toString()).toBe('**text**');
    view.destroy();
  });

  it('setzt .active für Aktiv-Zustand', () => {
    const view = makeView('**fett**');
    view.dispatch({ selection: { anchor: 3 } }); // Cursor im fetten Bereich
    const toolbar = createToolbar(view, ['bold'], {})!;
    toolbar.update(view.state);
    expect(toolbar.dom.querySelector('button')!.classList.contains('active')).toBe(true);
    view.destroy();
  });

  it('Custom-Button ruft action(editor)', () => {
    const view = makeView();
    const action = vi.fn();
    const editor = { marker: true };
    const toolbar = createToolbar(view, [{ name: 'foo', action, title: 'Foo' }], editor)!;
    toolbar.dom.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(action).toHaveBeenCalledWith(editor);
    view.destroy();
  });

  it('Custom-Button mit className rendert <i>', () => {
    const view = makeView();
    const toolbar = createToolbar(
      view,
      [{ name: 'foo', action: () => {}, className: 'fa fa-star', title: 'Foo' }],
      {},
    )!;
    expect(toolbar.dom.querySelector('button i.fa.fa-star')).not.toBeNull();
    view.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/toolbar.test.ts`
Expected: FAIL — Modul `../toolbar` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/ui/toolbar.ts`:

```typescript
import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { resolveToolbar, type ResolvedToolbarItem, type ToolbarOption } from './toolbar-config';
import { renderIcon } from './icons';

/** Ein gerendertes Toolbar-Widget mit reaktivem Aktiv-Zustand. */
export interface Toolbar {
  dom: HTMLElement;
  update(state: EditorState): void;
  destroy(): void;
}

/** Ein Built-in-Button samt seiner query, um bei update() .active zu setzen. */
interface ActiveButton {
  el: HTMLButtonElement;
  query: (state: EditorState) => boolean;
}

/** Baut den DOM-Knoten für einen aufgelösten Toolbar-Eintrag. */
function buildItem(
  view: EditorView,
  item: ResolvedToolbarItem,
  editor: unknown,
  activeButtons: ActiveButton[],
): HTMLElement {
  if (item.kind === 'separator') {
    const sep = document.createElement('i');
    sep.className = 'supamde-separator';
    return sep;
  }

  const btn = document.createElement('button');
  btn.type = 'button';

  if (item.kind === 'builtin') {
    const { action, name } = item;
    btn.title = action.title;
    btn.setAttribute('aria-label', action.title);
    btn.dataset.action = name;
    btn.appendChild(renderIcon(action.icon));
    btn.addEventListener('click', () => {
      view.focus();
      action.command(view);
    });
    if (action.query) {
      activeButtons.push({ el: btn, query: action.query });
    }
  } else {
    const { button } = item;
    btn.title = button.title ?? button.name;
    btn.dataset.action = button.name;
    if (button.className) {
      const icon = document.createElement('i');
      icon.className = button.className;
      btn.appendChild(icon);
    } else {
      btn.textContent = button.name;
    }
    btn.addEventListener('click', () => button.action(editor));
  }

  return btn;
}

/**
 * Erzeugt die Toolbar aus der `toolbar`-Option. `null` bei `false`.
 * `editor` ist die SupaMDE-Instanz, die Custom-Buttons als action-Argument bekommen.
 */
export function createToolbar(
  view: EditorView,
  option: ToolbarOption | undefined,
  editor: unknown,
): Toolbar | null {
  const items = resolveToolbar(option);
  if (items === null) return null;

  const dom = document.createElement('div');
  dom.className = 'supamde-toolbar';

  const activeButtons: ActiveButton[] = [];
  for (const item of items) {
    dom.appendChild(buildItem(view, item, editor, activeButtons));
  }

  const update = (state: EditorState): void => {
    for (const { el, query } of activeButtons) {
      el.classList.toggle('active', query(state));
    }
  };

  const destroy = (): void => {
    dom.remove();
  };

  return { dom, update, destroy };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/toolbar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/toolbar.ts src/ui/__tests__/toolbar.test.ts
git commit -m "feat(ui): Toolbar-Rendering mit Aktiv-Zustand und Custom-Buttons"
```

---

### Task 7: Statusbar-Config & Rendering (`ui/statusbar.ts`)

**Files:**
- Create: `src/ui/statusbar.ts`
- Test: `src/ui/__tests__/statusbar.test.ts`

**Interfaces:**
- Consumes: `wordCount` aus `../features/word-count`; `EditorState` (`@codemirror/state`).
- Produces:
  - `interface CustomStatusItem { className: string; defaultValue?: string; onUpdate?(el: HTMLElement): void; onActivity?(el: HTMLElement): void; }`
  - `type StatusOption = false | Array<string | CustomStatusItem>`
  - `DEFAULT_STATUS: string[]` — `['lines', 'words', 'cursor']`
  - `interface Statusbar { dom: HTMLElement; update(state: EditorState, opts: { docChanged: boolean; selectionSet: boolean }): void; setItem(name: string, content: string): void; destroy(): void; }`
  - `createStatusbar(option: StatusOption | undefined): Statusbar | null` — `null` bei `false`.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/statusbar.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createStatusbar, DEFAULT_STATUS } from '../statusbar';

function stateOf(doc: string, pos = 0): EditorState {
  return EditorState.create({ doc, selection: { anchor: pos } });
}

const full = { docChanged: true, selectionSet: true };

describe('createStatusbar', () => {
  it('liefert null bei status=false', () => {
    expect(createStatusbar(false)).toBeNull();
  });

  it('Default enthält lines, words, cursor', () => {
    expect(DEFAULT_STATUS).toEqual(['lines', 'words', 'cursor']);
  });

  it('rendert ein span pro Item', () => {
    const sb = createStatusbar(['lines', 'words', 'cursor'])!;
    expect(sb.dom.querySelectorAll('span').length).toBe(3);
  });

  it('lines zeigt die Zeilenzahl', () => {
    const sb = createStatusbar(['lines'])!;
    sb.update(stateOf('a\nb\nc'), full);
    expect(sb.dom.querySelector('.supamde-status-lines')!.textContent).toContain('3');
  });

  it('words zeigt die Wortzahl', () => {
    const sb = createStatusbar(['words'])!;
    sb.update(stateOf('ein zwei drei'), full);
    expect(sb.dom.querySelector('.supamde-status-words')!.textContent).toContain('3');
  });

  it('cursor zeigt Zeile und Spalte (1-basiert)', () => {
    const sb = createStatusbar(['cursor'])!;
    sb.update(stateOf('abc\ndef', 5), full); // Zeile 2, Spalte 2
    const text = sb.dom.querySelector('.supamde-status-cursor')!.textContent!;
    expect(text).toContain('2');
  });

  it('autosave-Slot rendert leer (M3-No-op)', () => {
    const sb = createStatusbar(['autosave'])!;
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe('');
  });

  it('Custom-Item ruft onUpdate bei docChanged', () => {
    const onUpdate = vi.fn();
    const sb = createStatusbar([{ className: 'custom', defaultValue: '0', onUpdate }])!;
    sb.update(stateOf('x'), { docChanged: true, selectionSet: false });
    expect(onUpdate).toHaveBeenCalled();
  });

  it('setItem überschreibt den Inhalt eines Built-ins', () => {
    const sb = createStatusbar(['autosave'])!;
    sb.setItem('autosave', 'gespeichert 12:00');
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe('gespeichert 12:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/statusbar.test.ts`
Expected: FAIL — Modul `../statusbar` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/ui/statusbar.ts`:

```typescript
import type { EditorState } from '@codemirror/state';
import { wordCount } from '../features/word-count';

/** Ein Custom-Statusbar-Item (easyMDE-kompatibel). */
export interface CustomStatusItem {
  className: string;
  defaultValue?: string;
  onUpdate?(el: HTMLElement): void;
  onActivity?(el: HTMLElement): void;
}

/** Die `status`-Option: false, oder Liste aus Built-in-Namen/Custom-Items. */
export type StatusOption = false | Array<string | CustomStatusItem>;

/** Default-Statusbar-Items. */
export const DEFAULT_STATUS: string[] = ['lines', 'words', 'cursor'];

/** Built-in-Namen, die SupaMDE selbst befüllt. */
const BUILTIN_NAMES = new Set(['lines', 'words', 'cursor', 'autosave']);

/** Ein gerendertes Statusbar-Widget. */
export interface Statusbar {
  dom: HTMLElement;
  update(state: EditorState, opts: { docChanged: boolean; selectionSet: boolean }): void;
  setItem(name: string, content: string): void;
  destroy(): void;
}

interface BuiltinEntry {
  name: string;
  el: HTMLElement;
}

interface CustomEntry {
  item: CustomStatusItem;
  el: HTMLElement;
}

/** Berechnet den Textinhalt eines Built-in-Items aus dem State. */
function builtinContent(name: string, state: EditorState): string {
  switch (name) {
    case 'lines':
      return `${state.doc.lines} Zeilen`;
    case 'words':
      return `${wordCount(state.doc.toString())} Wörter`;
    case 'cursor': {
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      return `${line.number}:${head - line.from + 1}`;
    }
    case 'autosave':
      // M3-No-op; wird in M5 über setItem('autosave', …) befüllt.
      return '';
    default:
      return '';
  }
}

/** Erzeugt die Statusbar aus der `status`-Option. `null` bei `false`. */
export function createStatusbar(option: StatusOption | undefined): Statusbar | null {
  if (option === false) return null;
  const items = option ?? DEFAULT_STATUS;

  const dom = document.createElement('div');
  dom.className = 'supamde-statusbar';

  const builtins: BuiltinEntry[] = [];
  const customs: CustomEntry[] = [];

  for (const entry of items) {
    const span = document.createElement('span');
    if (typeof entry === 'string') {
      span.className = `supamde-status-${entry}`;
      dom.appendChild(span);
      if (BUILTIN_NAMES.has(entry)) {
        builtins.push({ name: entry, el: span });
      }
    } else {
      span.className = `supamde-status-custom ${entry.className}`;
      span.textContent = entry.defaultValue ?? '';
      dom.appendChild(span);
      customs.push({ item: entry, el: span });
    }
  }

  const update = (
    state: EditorState,
    opts: { docChanged: boolean; selectionSet: boolean },
  ): void => {
    for (const { name, el } of builtins) {
      el.textContent = builtinContent(name, state);
    }
    for (const { item, el } of customs) {
      if (opts.docChanged) item.onUpdate?.(el);
      if (opts.selectionSet) item.onActivity?.(el);
    }
  };

  const setItem = (name: string, content: string): void => {
    const found = builtins.find((b) => b.name === name);
    if (found) found.el.textContent = content;
  };

  const destroy = (): void => {
    dom.remove();
  };

  return { dom, update, setItem, destroy };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/statusbar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/statusbar.ts src/ui/__tests__/statusbar.test.ts
git commit -m "feat(ui): Statusbar mit lines/words/cursor + Custom-Items"
```

---

### Task 8: Zentraler `updateListener` (`ui/update-listener.ts`)

**Files:**
- Create: `src/ui/update-listener.ts`
- Test: `src/ui/__tests__/update-listener.test.ts`

**Interfaces:**
- Consumes: `EditorView` (`@codemirror/view`), `Extension` (`@codemirror/state`).
- Produces:
  - `interface UpdateSink { onUpdate(update: { state: import('@codemirror/state').EditorState; docChanged: boolean; selectionSet: boolean }): void; }`
  - `updateListenerExtension(sink: UpdateSink): Extension` — eine `EditorView.updateListener`-Extension, die bei jedem relevanten ViewUpdate `sink.onUpdate` mit dem neuen State und den Flags aufruft.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/update-listener.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { updateListenerExtension } from '../update-listener';

function makeView(ext: ReturnType<typeof updateListenerExtension>, doc = ''): EditorView {
  return new EditorView({ state: EditorState.create({ doc, extensions: [ext] }) });
}

describe('updateListenerExtension', () => {
  it('meldet docChanged bei einer Doc-Änderung', () => {
    const onUpdate = vi.fn();
    const view = makeView(updateListenerExtension({ onUpdate }));
    view.dispatch({ changes: { from: 0, insert: 'x' } });
    const call = onUpdate.mock.calls.at(-1)![0];
    expect(call.docChanged).toBe(true);
    expect(call.state.doc.toString()).toBe('x');
    view.destroy();
  });

  it('meldet selectionSet bei reiner Cursorbewegung', () => {
    const onUpdate = vi.fn();
    const view = makeView(updateListenerExtension({ onUpdate }), 'abc');
    onUpdate.mockClear();
    view.dispatch({ selection: { anchor: 2 } });
    const call = onUpdate.mock.calls.at(-1)![0];
    expect(call.selectionSet).toBe(true);
    expect(call.docChanged).toBe(false);
    view.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/update-listener.test.ts`
Expected: FAIL — Modul `../update-listener` nicht gefunden.

- [ ] **Step 3: Write minimal implementation**

`src/ui/update-listener.ts`:

```typescript
import type { Extension, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Empfänger für Editor-Updates (Toolbar-Aktiv-Zustand, Statusbar …). */
export interface UpdateSink {
  onUpdate(update: {
    state: EditorState;
    docChanged: boolean;
    selectionSet: boolean;
  }): void;
}

/**
 * Der EINE zentrale updateListener: bei jedem relevanten ViewUpdate wird
 * `sink.onUpdate` mit dem neuen State und den Flags gerufen. Entkoppelt UI ↔
 * Editor an einer Stelle (CM6-Design §5, „roter Faden").
 */
export function updateListenerExtension(sink: UpdateSink): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return;
    sink.onUpdate({
      state: update.state,
      docChanged: update.docChanged,
      selectionSet: update.selectionSet,
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/__tests__/update-listener.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/update-listener.ts src/ui/__tests__/update-listener.test.ts
git commit -m "feat(ui): zentraler updateListener (roter Faden UI↔Editor)"
```

---

### Task 9: Options erweitern & Extension einhängen

**Files:**
- Modify: `src/options.ts`
- Modify: `src/editor/extensions.ts`
- Modify: `src/editor/setup.ts`
- Test: `src/editor/__tests__/extensions.test.ts` (ergänzen)

**Interfaces:**
- Consumes: `ToolbarOption` (`../ui/toolbar-config`), `StatusOption` (`../ui/statusbar`), `updateListenerExtension`, `UpdateSink` (`../ui/update-listener`).
- Produces:
  - `SupaMDEOptions` um `toolbar?: ToolbarOption` und `status?: StatusOption` erweitert.
  - `buildExtensions(resolved, sink?: UpdateSink): Extension[]` — hängt bei gesetztem `sink` die `updateListenerExtension` ein.
  - `editorFromTextArea(options, sink?: UpdateSink)` reicht den `sink` an `buildExtensions` durch.

> **Wichtig:** `toolbar`/`status` sind **rohe** Optionen und wandern NICHT in `ResolvedOptions` (die die Extension-Erzeugung steuert) — sie werden erst in der Fassade (Task 10) an `createToolbar`/`createStatusbar` gereicht. `buildExtensions` bekommt nur den optionalen `sink`.

- [ ] **Step 1: Write the failing test (Extensions mit sink)**

Ergänze in `src/editor/__tests__/extensions.test.ts` einen Test:

```typescript
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { buildExtensions } from '../extensions';
import { resolveOptions } from '../../options';

it('ruft den sink bei einer Doc-Änderung', () => {
  const calls: boolean[] = [];
  const ext = buildExtensions(resolveOptions({}), {
    onUpdate: (u) => calls.push(u.docChanged),
  });
  const view = new EditorView({ state: EditorState.create({ doc: '', extensions: ext }) });
  view.dispatch({ changes: { from: 0, insert: 'x' } });
  expect(calls.some(Boolean)).toBe(true);
  view.destroy();
});
```

(Behalte den bestehenden Import-Stil der Datei bei; ergänze fehlende Imports oben.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/editor/__tests__/extensions.test.ts`
Expected: FAIL — `buildExtensions` akzeptiert (noch) kein zweites Argument / `sink` wird nicht aufgerufen.

- [ ] **Step 3: Options-Typ erweitern**

In `src/options.ts` — die Imports oben ergänzen und `SupaMDEOptions` erweitern:

```typescript
import type { ToolbarOption } from './ui/toolbar-config';
import type { StatusOption } from './ui/statusbar';
```

Innerhalb `interface SupaMDEOptions` (nach `initialValue`) ergänzen:

```typescript
  /** Toolbar-Konfiguration: false (aus), oder Liste aus Built-in-Namen/Custom-Buttons. */
  toolbar?: ToolbarOption;
  /** Statusbar-Konfiguration: false (aus), oder Liste aus Built-in-Namen/Custom-Items. */
  status?: StatusOption;
```

`ResolvedOptions` und `resolveOptions` bleiben **unverändert** (toolbar/status sind roh, siehe Hinweis oben).

- [ ] **Step 4: `buildExtensions` um optionalen sink erweitern**

In `src/editor/extensions.ts` — Import ergänzen und Signatur erweitern:

```typescript
import { updateListenerExtension, type UpdateSink } from '../ui/update-listener';
```

Signatur ändern zu:

```typescript
export function buildExtensions(resolved: ResolvedOptions, sink?: UpdateSink): Extension[] {
```

Am Ende von `buildExtensions`, direkt vor `return extensions;`:

```typescript
  if (sink) {
    extensions.push(updateListenerExtension(sink));
  }
```

- [ ] **Step 5: `editorFromTextArea` reicht den sink durch**

In `src/editor/setup.ts` — Import ergänzen:

```typescript
import type { UpdateSink } from '../ui/update-listener';
```

Signatur ändern zu:

```typescript
export function editorFromTextArea(options: SupaMDEOptions, sink?: UpdateSink): EditorHandle {
```

Den `buildExtensions`-Aufruf ändern zu:

```typescript
    extensions: buildExtensions(resolved, sink),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/editor/__tests__/extensions.test.ts src/editor/__tests__/setup.test.ts src/__tests__/options.test.ts`
Expected: PASS (bestehende Tests unverändert grün, neuer sink-Test grün).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler.

- [ ] **Step 8: Commit**

```bash
git add src/options.ts src/editor/extensions.ts src/editor/setup.ts src/editor/__tests__/extensions.test.ts
git commit -m "feat(editor): toolbar/status-Optionen + updateListener durchreichen"
```

---

### Task 10: Fassade — Toolbar/Statusbar einhängen (`index.ts`)

**Files:**
- Modify: `src/index.ts`
- Test: `src/__tests__/index.test.ts` (ergänzen)

**Interfaces:**
- Consumes: `createToolbar`, `Toolbar` (`./ui/toolbar`); `createStatusbar`, `Statusbar` (`./ui/statusbar`); `UpdateSink` (`./ui/update-listener`).
- Produces (öffentliche API-Erweiterung von `SupaMDE`):
  - Konstruktor baut ein `<div class="supamde-container">` mit Toolbar (oben), Editor (Mitte), Statusbar (unten).
  - `updateStatusBar(itemName: string, content: string): void`
  - `toTextArea()` / `cleanup()` räumen zusätzlich Toolbar/Statusbar/Container ab.

> **Verdrahtungs-Ablauf im Konstruktor:**
> 1. `this.handle = editorFromTextArea(options, sink)` — `sink` ist ein Objekt, das `this.toolbar?.update(state)` und `this.statusbar?.update(state, opts)` ruft.
> 2. Nach dem Erzeugen der View: `createToolbar(view, options.toolbar, this)` und `createStatusbar(options.status)`.
> 3. Container um `view.dom` bauen (Toolbar davor, Statusbar dahinter einfügen).
> 4. Initiales `update` mit `view.state` auslösen, damit Statusbar/Aktiv-Zustand sofort stimmen.

- [ ] **Step 1: Write the failing test**

Ergänze in `src/__tests__/index.test.ts`:

```typescript
function makeTextarea(value = ''): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.value = value;
  document.body.appendChild(ta);
  return ta;
}

it('baut Container mit Toolbar und Statusbar', () => {
  const ta = makeTextarea('# Titel');
  const editor = new SupaMDE({ element: ta });
  const container = ta.previousSibling as HTMLElement;
  // Container liegt vor der (versteckten) Textarea
  expect(container.classList.contains('supamde-container')).toBe(true);
  expect(container.querySelector('.supamde-toolbar')).not.toBeNull();
  expect(container.querySelector('.supamde-statusbar')).not.toBeNull();
  expect(container.querySelector('.cm-editor')).not.toBeNull();
  editor.toTextArea();
});

it('respektiert toolbar:false und status:false', () => {
  const ta = makeTextarea('x');
  const editor = new SupaMDE({ element: ta, toolbar: false, status: false });
  const container = ta.previousSibling as HTMLElement;
  expect(container.querySelector('.supamde-toolbar')).toBeNull();
  expect(container.querySelector('.supamde-statusbar')).toBeNull();
  editor.toTextArea();
});

it('Statusbar zeigt initial die Wortzahl', () => {
  const ta = makeTextarea('ein zwei drei');
  const editor = new SupaMDE({ element: ta });
  const words = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-words')!;
  expect(words.textContent).toContain('3');
  editor.toTextArea();
});

it('updateStatusBar überschreibt ein Item', () => {
  const ta = makeTextarea('x');
  const editor = new SupaMDE({ element: ta, status: ['autosave'] });
  editor.updateStatusBar('autosave', 'gespeichert');
  const el = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-autosave')!;
  expect(el.textContent).toBe('gespeichert');
  editor.toTextArea();
});

it('toTextArea räumt den Container ab', () => {
  const ta = makeTextarea('x');
  const editor = new SupaMDE({ element: ta });
  editor.toTextArea();
  expect(document.querySelector('.supamde-container')).toBeNull();
  expect(ta.style.display).not.toBe('none');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: FAIL — kein Container/keine Toolbar; `updateStatusBar` existiert nicht.

- [ ] **Step 3: Fassade umbauen**

`src/index.ts` — vollständige neue Fassung:

```typescript
import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { VERSION } from './version';
import type { SupaMDEOptions } from './options';
import { editorFromTextArea, type EditorHandle } from './editor/setup';
import { readValue, writeValue } from './editor/value';
import { createToolbar, type Toolbar } from './ui/toolbar';
import { createStatusbar, type Statusbar } from './ui/statusbar';

export type { SupaMDEOptions } from './options';

/**
 * SupaMDE — moderner Markdown-Editor auf Basis von CodeMirror 6.
 *
 * Dünne Fassade: der Konstruktor baut über `editor/setup.ts` eine EditorView aus
 * der übergebenen Textarea, umgibt sie mit Toolbar und Statusbar und verdrahtet
 * beide über EINEN updateListener. Alle Methoden delegieren an die Module.
 */
export class SupaMDE {
  /** Aktuelle SupaMDE-Version. */
  static readonly version = VERSION;

  /** Die (rohen) Optionen dieser Instanz. */
  readonly options: SupaMDEOptions;

  /** Die zugrunde liegende CM6-EditorView (NICHT das CM5-Objekt). */
  readonly codemirror: EditorView;

  private readonly handle: EditorHandle;
  private readonly container: HTMLElement;
  private readonly toolbar: Toolbar | null;
  private readonly statusbar: Statusbar | null;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;

    // Der EINE Sink: speist Toolbar-Aktiv-Zustand und Statusbar.
    const sink = {
      onUpdate: (u: { state: EditorState; docChanged: boolean; selectionSet: boolean }): void => {
        this.toolbar?.update(u.state);
        this.statusbar?.update(u.state, { docChanged: u.docChanged, selectionSet: u.selectionSet });
      },
    };

    this.handle = editorFromTextArea(options, sink);
    this.codemirror = this.handle.view;

    this.toolbar = createToolbar(this.codemirror, options.toolbar, this);
    this.statusbar = createStatusbar(options.status);

    // Container um view.dom bauen: Toolbar oben, Editor Mitte, Statusbar unten.
    this.container = document.createElement('div');
    this.container.className = 'supamde-container';
    const viewDom = this.codemirror.dom;
    viewDom.parentNode?.insertBefore(this.container, viewDom);
    if (this.toolbar) this.container.appendChild(this.toolbar.dom);
    this.container.appendChild(viewDom);
    if (this.statusbar) this.container.appendChild(this.statusbar.dom);

    // Initialer Zustand, damit Statusbar/Aktiv-Zustand sofort stimmen.
    const state = this.codemirror.state;
    this.toolbar?.update(state);
    this.statusbar?.update(state, { docChanged: true, selectionSet: true });
  }

  value(): string;
  value(val: string): void;
  value(val?: string): string | void {
    if (val === undefined) return this.getValue();
    this.setValue(val);
  }

  getValue(): string {
    return readValue(this.codemirror);
  }

  setValue(val: string): void {
    writeValue(this.codemirror, val);
  }

  /** Überschreibt den Inhalt eines Statusbar-Items (API-kompatibel zu easyMDE). */
  updateStatusBar(itemName: string, content: string): void {
    this.statusbar?.setItem(itemName, content);
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    this.toolbar?.destroy();
    this.statusbar?.destroy();
    const textarea = this.handle.toTextArea();
    this.container.remove();
    return textarea;
  }
}

export { VERSION } from './version';
export default SupaMDE;
```

> **Hinweis zur DOM-Reihenfolge:** `editorFromTextArea` fügt `view.dom` vor die Textarea ein. Der Konstruktor fügt danach den `container` vor `view.dom` ein und hängt `view.dom` in den Container um — Endergebnis: `container` steht vor der (versteckten) Textarea, `view.dom` liegt darin. `toTextArea()` von `setup.ts` entfernt `view.dom` selbst; anschließend entfernt die Fassade den nun leeren `container`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + volle Testsuite**

Run: `npm run typecheck && npx vitest run`
Expected: keine Typfehler; alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat: Toolbar & Statusbar in die SupaMDE-Fassade einhängen"
```

---

### Task 11: Styling (`ui/toolbar.css` + `ui/statusbar.css`)

**Files:**
- Create: `src/ui/toolbar.css`
- Create: `src/ui/statusbar.css`
- Modify: `src/index.ts` (CSS importieren, damit Vite es mitbündelt)

**Interfaces:**
- Produces: schlichtes Default-Styling für `.supamde-container`, `.supamde-toolbar`, Buttons, `.active`, `.supamde-separator`, `.supamde-statusbar`.

> Kein separater Test — Styling wird visuell im Beispiel (Task 12) verifiziert. Diese Task ist an Task 10 gekoppelt, weil sie denselben Deliverable (sichtbare UI) vervollständigt, aber getrennt committet.

- [ ] **Step 1: Toolbar-CSS anlegen**

`src/ui/toolbar.css`:

```css
.supamde-container {
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  overflow: hidden;
}

.supamde-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-bottom: 1px solid #d0d0d0;
  background: #f7f7f7;
  flex-wrap: wrap;
}

.supamde-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #333;
  cursor: pointer;
}

.supamde-toolbar button:hover {
  background: #e6e6e6;
}

.supamde-toolbar button.active {
  background: #d8e6ff;
  border-color: #a8c6ff;
}

.supamde-toolbar button svg {
  width: 16px;
  height: 16px;
}

.supamde-separator {
  display: inline-block;
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: #d0d0d0;
}
```

- [ ] **Step 2: Statusbar-CSS anlegen**

`src/ui/statusbar.css`:

```css
.supamde-statusbar {
  display: flex;
  gap: 12px;
  padding: 4px 8px;
  border-top: 1px solid #d0d0d0;
  background: #f7f7f7;
  font-size: 12px;
  color: #666;
}

.supamde-statusbar span {
  white-space: nowrap;
}
```

- [ ] **Step 3: CSS in `index.ts` importieren**

Ganz oben in `src/index.ts`, vor den anderen Imports:

```typescript
import './ui/toolbar.css';
import './ui/statusbar.css';
```

- [ ] **Step 4: Build verifizieren**

Run: `npm run build`
Expected: Build erfolgreich; das CSS wird von Vite mitgebündelt (eine `.css`-Datei im `dist/`). Kein Typfehler.

> Falls Vitest den CSS-Import beim Testlauf nicht auflösen kann, ist das ein Test-Environment-Thema — Vite/Vitest behandeln CSS-Importe standardmäßig als leere Module. Verifiziere mit `npx vitest run src/__tests__/index.test.ts`, dass die Tests weiter grün sind; falls nicht, in der Vitest-Config `css: false` setzen (CSS beim Testen ignorieren).

- [ ] **Step 5: Volle Testsuite**

Run: `npx vitest run`
Expected: alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add src/ui/toolbar.css src/ui/statusbar.css src/index.ts
git commit -m "feat(ui): Default-Styling für Toolbar & Statusbar"
```

---

### Task 12: Beispiel aktualisieren (`example/index.html`)

**Files:**
- Modify: `example/index.html`

**Interfaces:**
- Consumes: die öffentliche `SupaMDE`-API (Default-Toolbar, Custom-Button, `updateStatusBar`).

> Kein Unit-Test — das Beispiel ist die manuelle Sicht-Verifikation des Meilensteins.

- [ ] **Step 1: Beispiel erweitern**

`example/index.html` — Titel/Beschreibung und Skript anpassen. Ersetze den `<script type="module">`-Block sowie Titel/Einleitung, sodass eine Default-Toolbar, ein Custom-Button und die Statusbar demonstriert werden:

```html
    <title>SupaMDE — M3 Toolbar & Statusbar</title>
```

```html
    <p>M3: grafische Toolbar (Klick-Aktionen mit Aktiv-Zustand) und Statusbar
      (Zeilen, Wörter, Cursor). Die Icons sind gebündelt — kein CDN nötig.</p>
```

```html
    <script type="module">
      import SupaMDE from '../dist/supamde.mjs';
      const editor = new SupaMDE({
        element: document.getElementById('editor'),
        placeholder: 'Schreibe etwas Markdown …',
        // Default-Toolbar + ein eigener Button, der die Wortzahl in die Statusbar schreibt
        toolbar: [
          'bold', 'italic', 'strikethrough', 'code', '|',
          'quote', 'unordered-list', 'ordered-list', 'check-list', '|',
          'link', 'image', 'table', '|', 'undo', 'redo', '|',
          {
            name: 'shout',
            title: 'In Großbuchstaben',
            className: 'supamde-custom-shout',
            action: (ed) => ed.setValue(ed.getValue().toUpperCase()),
          },
        ],
        status: ['lines', 'words', 'cursor'],
      });
      // eslint-disable-next-line no-console
      console.log('SupaMDE-Version:', SupaMDE.version, editor.getValue());
    </script>
```

- [ ] **Step 2: Build + manuelle Sichtprüfung**

Run: `npm run build`
Dann `example/index.html` im Browser öffnen (oder `npm run dev` und die Beispielseite ansteuern) und prüfen:
- Toolbar ist sichtbar, Icons werden gerendert (Lucide, ohne CDN).
- Klick auf **B** bei markiertem Text macht ihn fett; Cursor in fettem Text → **B** ist `.active`.
- Statusbar zeigt Zeilen/Wörter/Cursor und aktualisiert sich beim Tippen/Bewegen.
- Der Custom-Button „In Großbuchstaben" funktioniert.

Expected: alle vier Punkte erfüllt.

- [ ] **Step 3: Commit**

```bash
git add example/index.html
git commit -m "docs(example): Toolbar & Statusbar im Beispiel demonstrieren"
```

---

### Task 13: README aktualisieren

**Files:**
- Modify: `README.md`

**Interfaces:**
- Dokumentiert die neuen Optionen (`toolbar`, `status`), die neue Methode (`updateStatusBar`) und den Meilenstein-Fortschritt.

- [ ] **Step 1: Status-Zeile auf M3 heben**

In `README.md` den Status-Block ersetzen:

```markdown
> **Status:** In Entwicklung. Aktueller Meilenstein: **M3 — Toolbar & Statusbar**
> (grafische Toolbar mit Aktiv-Zuständen, Statusbar mit Zeilen/Wörter/Cursor).
> Preview, Autosave und weitere Features folgen in späteren Meilensteinen.
```

- [ ] **Step 2: Optionen-Tabelle um toolbar/status ergänzen**

Unter „## Optionen (Kern-Set, M1)" eine neue Sektion **nach** der bestehenden Tabelle einfügen:

```markdown
## Toolbar & Statusbar (M3)

| Option    | Typ                                          | Default                       | Bedeutung                                        |
| --------- | -------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `toolbar` | `false \| Array<string \| CustomButton>`     | Default-Toolbar               | Toolbar-Aufbau. `false` blendet sie aus.         |
| `status`  | `false \| Array<string \| CustomStatusItem>` | `['lines', 'words', 'cursor']`| Statusbar-Items. `false` blendet sie aus.        |

**Built-in-Toolbar-Buttons:** `bold`, `italic`, `strikethrough`, `code`,
`heading-smaller`, `heading-bigger`, `heading-1`…`heading-6`, `quote`, `code-block`,
`horizontal-rule`, `clean-block`, `unordered-list`, `ordered-list`, `check-list`,
`link`, `image`, `table`, `undo`, `redo`. `'|'` fügt einen Separator ein.

**Custom-Buttons** behalten die easyMDE-Signatur:

```js
{
  name: 'shout',
  title: 'In Großbuchstaben',
  className: 'fa fa-bullhorn',       // optionale eigene Icon-Klasse
  action: (editor) => editor.setValue(editor.getValue().toUpperCase()),
}
```

**Statusbar-Items:** `lines`, `words`, `cursor` (und `autosave`, ab M5 mit Inhalt).
Custom-Items via `{ className, defaultValue, onUpdate, onActivity }`.

**Icons:** Die Built-in-Buttons nutzen gebündelte
[Lucide](https://lucide.dev)-SVG-Icons — es muss **kein** Icon-Font eingebunden
werden. Custom-Buttons können über `className` weiterhin eigene Icon-Fonts
(z. B. FontAwesome) verwenden.
```

- [ ] **Step 3: API-Tabelle um updateStatusBar ergänzen**

Unter „## API (M1)" die Tabelle um eine Zeile erweitern:

```markdown
| `updateStatusBar(name, content)` | Inhalt eines Statusbar-Items setzen (M3).               |
```

- [ ] **Step 4: Toolbar-Hinweis in der M2-Sektion aktualisieren**

In der „## Tastenkürzel (M2)"-Sektion den Satz „Eine grafische Toolbar folgt in M3."
ersetzen durch:

```markdown
Seit M3 sind alle Aktionen auch über die grafische Toolbar per Klick erreichbar.
```

Und den Schlussabsatz („`Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle`
sind als Commands vorhanden und werden mit der Toolbar (M3) auch per Klick
erreichbar.") ersetzen durch:

```markdown
`Enter` in einer Listenzeile setzt die Liste fort; in einer leeren Listenzeile
beendet es sie. `Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle` sind
über die Toolbar per Klick erreichbar.
```

- [ ] **Step 5: Prüfen, dass die README konsistent ist**

Run: `grep -n "M3\|toolbar\|status\|updateStatusBar" README.md`
Expected: die neuen Abschnitte erscheinen; kein widersprüchlicher „folgt in M3"-Text mehr.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: README um Toolbar/Statusbar (M3) ergänzen"
```

---

## Abschluss-Verifikation (nach Task 13)

- [ ] **Volle Testsuite grün:** `npx vitest run` → alle Tests bestehen.
- [ ] **Typecheck sauber:** `npm run typecheck` → keine Fehler.
- [ ] **Lint sauber:** `npm run lint` → keine Fehler.
- [ ] **Build grün:** `npm run build` → `dist/` enthält gebündeltes JS + CSS.
- [ ] **Beispiel manuell geprüft:** Toolbar sichtbar, Aktiv-Zustand funktioniert, Statusbar aktualisiert sich, Custom-Button wirkt (Task 12).

**Meilenstein-Ergebnis M3 erreicht:** sichtbare, klickbare Toolbar mit Aktiv-Zuständen und funktionierende Statusbar im `example/`; `npm run build` + `npm test` grün; alle neuen Module unit-/komponentengetestet.

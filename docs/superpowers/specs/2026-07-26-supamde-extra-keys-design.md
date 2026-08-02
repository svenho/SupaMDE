# Design: Eigene Tastenkürzel (`extraKeys`)

**Datum:** 2026-07-26
**Status:** Genehmigt

## Ziel

Konsumenten von SupaMDE können eigene CodeMirror-6-`KeyBinding`s definieren —
sowohl komplett neue Tastenkürzel als auch Überschreibungen bestehender
SupaMDE-Defaults (z. B. `Mod-b` auf eine eigene Aktion umlegen).

## Motivation

`SupaMDEOptions` hat aktuell keine Erweiterungsmöglichkeit für Tastenkürzel.
`buildExtensions` baut eine feste `keymap.of([...supaKeymap, ...historyKeymap,
...defaultKeymap])` — Konsumenten können weder eigene Bindings ergänzen noch
einen Default überschreiben, ohne den SupaMDE-Quellcode selbst zu patchen.

## API

### 1. `src/options.ts`

```ts
import type { KeyBinding } from '@codemirror/view';

export interface SupaMDEOptions {
  // ...
  /** Eigene Tastenkürzel; haben Vorrang vor den SupaMDE-Defaults bei Konflikten. */
  extraKeys?: KeyBinding[];
}

export interface ResolvedOptions {
  // ...
  extraKeys: KeyBinding[];
}

export function resolveOptions(options: SupaMDEOptions): ResolvedOptions {
  return {
    // ...
    extraKeys: options.extraKeys ?? [],
  };
}
```

`extraKeys` ist exakt `KeyBinding[]` aus `@codemirror/view` — keine
vereinfachte Zwischenform. Nutzer haben damit vollen Zugriff auf `shift`,
`any`, plattformspezifische Varianten (`mac`, `win`, `linux`) etc., genau wie
bei den internen `supaKeymap`-Einträgen.

### 2. `src/editor/extensions.ts`

```ts
keymap.of([...resolved.extraKeys, ...supaKeymap, ...historyKeymap, ...defaultKeymap]),
```

CM6 wertet ein `KeyBinding[]`-Array in Registrierungsreihenfolge aus — der
erste passende Eintrag gewinnt. `extraKeys` steht vor `supaKeymap`, wodurch
sich Overrides und Neuzugänge ohne Sonderfall-Logik gleich verhalten:

- **Override:** `extraKeys` enthält `{ key: 'Mod-b', run: meineAktion }` →
  gewinnt vor dem internen `bold`-Binding auf demselben Key.
- **Neu:** `extraKeys` enthält ein Binding auf einem bisher unbelegten Key →
  greift zusätzlich, ohne mit etwas zu kollidieren.

Kein explizites Override-Flag, keine Konflikt-Warnung — Vorrang durch
Reihenfolge ist die einzige Regel, die Nutzer kennen müssen.

### 3. `src/index.ts`

```ts
export type { KeyBinding } from '@codemirror/view';
```

Re-Export, damit Konsumenten `import type { KeyBinding } from 'supamde'`
nutzen können, ohne `@codemirror/view` als eigene Dependency für den reinen
Typ führen zu müssen (`@codemirror/view` ist ohnehin Peer Dependency, siehe
[`2026-07-23-cm6-peer-dependency-design.md`](2026-07-23-cm6-peer-dependency-design.md);
der Re-Export spart nur den zusätzlichen Typ-Import-Pfad).

## Bewusste Nicht-Ziele (YAGNI)

- Kein generisches `extensions?: Extension[]`-Feld — der Wunsch war konkret
  auf Tastenkürzel bezogen, ein offener Extension-Escape-Hatch ist ein
  größeres Fass (Precedence-Interaktion mit internen Extensions,
  Typsicherheit, Doku-Aufwand) und aktuell nicht gefragt.
- Kein vereinfachtes Binding-Format (`{ key, run }` mit Auto-`preventDefault`)
  — würde von der CM6-Standardform abweichen und Nutzer zwingen, zwei
  mentale Modelle zu pflegen, sobald sie doch `any`/`shift`/Plattform-Keys
  brauchen.
- Kein explizites Override-Flag zur Konfliktmarkierung — Registrierungs-
  reihenfolge ist Standardverhalten in CM6 und braucht keine zusätzliche API.

## Dokumentation (README.md)

### Options-Tabelle (Abschnitt „Optionen (Kern-Set, M1)“)

Neue Zeile:

```
| `extraKeys` | `KeyBinding[]` | `[]` | Eigene CodeMirror-6-Tastenkürzel; haben Vorrang vor den SupaMDE-Defaults. |
```

### Abschnitt „Tastenkürzel (M2)“

Nach der bestehenden Tastenkürzel-Tabelle ein neuer Unterabschnitt „Eigene
Tastenkürzel“ mit:

- Kurzer Erklärung der Precedence-Regel („erster Treffer gewinnt, `extraKeys`
  steht vor den SupaMDE-Defaults“).
- Codebeispiel, das sowohl einen Override (`Mod-b`) als auch ein neues
  Binding zeigt, inkl. `import type { KeyBinding } from 'supamde'`:

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

## Verifikation

- `npm run typecheck` bleibt grün.
- Neuer Unit-Test in `src/__tests__` (oder `src/editor/__tests__/extensions.test.ts`):
  - `resolveOptions`: Default `extraKeys: []`; Passthrough bei gesetztem Array.
  - `buildExtensions`/Integrationstest: Ein `extraKeys`-Binding auf einem
    bereits belegten Key (z. B. `Mod-b`) überschreibt den Default; ein
    Binding auf einem freien Key funktioniert zusätzlich.
- `npm run test:run` bleibt grün.
- README-Beispiel manuell gegen die tatsächliche API geprüft (kompiliert im
  Kopf: `SupaMDE`-Konstruktor, `KeyBinding`-Re-Export, `extraKeys`-Feld).

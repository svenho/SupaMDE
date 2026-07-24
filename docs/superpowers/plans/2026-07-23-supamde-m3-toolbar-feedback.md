# SupaMDE M3 — Toolbar-Feedback (Nachbesserung)

> Nachtrag zu M3 nach visueller Sichtprüfung. Behebt vier Punkte aus dem User-Feedback.
> Branch: `feat/m3-toolbar-statusbar` (Fortsetzung, kein neuer Branch).

**Ausgangslage:** M3 ist funktional fertig und reviewt (148 Tests grün). Die visuelle
Sichtprüfung ergab vier Punkte, die nachgebessert werden. Der „In Großbuchstaben"-Button
ist ein reiner Demo-Custom-Button aus dem M3-Plan (NICHT aus easyMDE, kein echtes
SupaMDE-Feature) → **wird entfernt** (User-Entscheidung).

## Zu behebende Punkte

| # | Feedback | Betrifft | Art |
|---|----------|----------|-----|
| 1 | Toolbar soll eine durchgehende Leiste über die volle Breite sein; Buttons sollen sich harmonisch integrieren statt einzeln wie Buttons auszusehen | `src/ui/toolbar.css` | Styling |
| 2 | „In Großbuchstaben"-Button hat kein Icon | Demo-Button | entfällt (Button raus) |
| 3 | „In Großbuchstaben" wandelt den GESAMTEN Text statt nur die Auswahl | Demo-Button | entfällt (Button raus) |
| 4 | Button-Title soll den Hotkey mitnennen | `src/ui/toolbar.ts` (+ neues Label-Modul) | Feature |
| 5 | (Mitgenommen) keymap↔actions-Doppelpflege der Kürzel auflösen | `src/commands/keymap.ts`, `src/ui/actions.ts` | Refactoring |

## Getroffene Entscheidungen

- **A — Vorgehen:** Direkt umsetzen (kein Subagenten-Setup). Der Scope ist klein und
  klar abgegrenzt; der Overhead lohnt sich hier nicht.
- **B — Button-Optik:** Nahtlose, flache Buttons — transparenter Rahmen im Ruhezustand,
  dezenter Hover-Hintergrund, dezent farbige `.active`-Fläche ohne aufgesetzten Rand.
  Trifft den Feedback-Wortlaut „harmonisch integrieren statt einzeln wie Buttons" am
  direktesten.

## Bekannte Divergenz: Anzeige-Shortcut ≠ aktive Bindung (Scope-Hinweis)

Die im Title angezeigten Kürzel stammen aus `action.shortcut` in
[actions.ts](../../../src/ui/actions.ts), NICHT aus den tatsächlich aktiven Bindungen in
[keymap.ts](../../../src/commands/keymap.ts). Beide sind separat gepflegt und driften in
Teilen auseinander. Verifizierter Stand (2026-07-23):

| Aktion | keymap.ts (aktiv) | actions.ts (Anzeige) | Bewertung |
|---|---|---|---|
| Überschrift 1–6 | `Ctrl-Alt-1…6` | *kein `shortcut`* | Title zeigt **keinen** Hotkey, obwohl einer gebunden ist |
| Blockzitat | `Mod-'` **+** `Ctrl-Alt-Q` | `Mod-'` | Zweitkürzel wird nicht angezeigt (akzeptabel) |
| undo | via `historyKeymap` (`Mod-Z`) | `Mod-z` | **stimmt** — CM6 bindet `⌘Z`/`Ctrl+Z` |
| redo | via `historyKeymap` (`Mod-Y`, **Mac: `Mod-Shift-Z`**) | `{ default: 'Mod-y', mac: 'Mod-Shift-z' }` | **korrigiert in F6** — CM6 bindet redo auf Mac an `⌘⇧Z`, nicht `⌘Y`; das plattformabhängige `shortcut`-Feld zeigt jetzt die real gebundene Taste (Mac `⌘⇧Z`, sonst `Ctrl+Y`) |

**Entscheidung für diese Nachbesserung:** Die Doppelpflege wird aufgelöst — **`actions.ts`
wird die Single Source of Truth** (Task F2b). `keymap.ts` leitet die aus Toolbar-Aktionen
stammenden Bindungen aus `BUILTIN_ACTIONS` ab; nur echte Sonderfälle ohne Toolbar-Button
bleiben explizit in `keymap.ts`. Damit steuert das `shortcut`-Feld künftig **Anzeige UND
Bindung** aus einer Quelle.

**Warum diese Richtung (nicht „keymap als SoT"):** verifiziert, dass keymap.ts NICHT die
alleinige Quelle sein kann —
- `undo`/`redo`-Kürzel stammen aus CM6s `historyKeymap`, nicht aus `supaKeymap`;
- mehrere Toolbar-Buttons haben gar kein easyMDE-Kürzel (`strikethrough`, `code`,
  `horizontal-rule`, `table`);
- `quote` hat zwei Bindungen (`Mod-'` **+** `Ctrl-Alt-q`), `continueList` (`Enter`) und
  `unorderedListStar` (`Shift-Alt-Mod-l`) haben überhaupt keinen Toolbar-Button.

Diese Sonderfälle bleiben handgepflegt in `keymap.ts`; alles mit Toolbar-Button +
`shortcut` wird abgeleitet.

---

## Task F1: Hotkey-Label-Modul (`ui/shortcut-label.ts`)

**Warum neu:** Es gibt bisher KEINE Plattform-/Hotkey-Format-Logik im Projekt (verifiziert).
Die `shortcut`-Strings in `actions.ts` liegen im CM6-Format vor (`'Mod-B'`, `'Shift-Mod-H'`,
`'Mod-Alt-C'`, `"Mod-'"`). Reine Logik → eigenes, unit-getestetes Modul.

**Files:**
- Create: `src/ui/shortcut-label.ts`
- Test: `src/ui/__tests__/shortcut-label.test.ts`

**Interface:**
- `formatShortcut(shortcut: string): string` — wandelt einen CM6-Shortcut-String in ein
  lesbares Label. `Mod` → `⌘` auf macOS, `Ctrl` sonst. Reihenfolge normalisieren
  (z.B. Mod/Ctrl/Cmd, Alt/Option, Shift, dann die Taste). Segment-Trenner: auf Mac
  zusammengezogen (`⌘⇧H`), sonst mit `+` (`Ctrl+Shift+H`).

**Beispiele (Mac / non-Mac):**
- `'Mod-B'` → `⌘B` / `Ctrl+B`
- `'Shift-Mod-H'` → `⌘⇧H` / `Ctrl+Shift+H`
- `'Mod-Alt-C'` → `⌘⌥C` / `Ctrl+Alt+C`
- `"Mod-'"` → `⌘'` / `Ctrl+'`

**Plattformerkennung:** einmalig. `navigator.platform` ist deprecated — bevorzugt
`navigator.userAgentData?.platform` mit `navigator.userAgent`-Fallback (Mac-Erkennung via
`/mac/i`). In jsdom testbar durch Injektion. Die Funktion akzeptiert die Plattform (bzw.
ein `isMac`-Flag) als optionalen Parameter (Default: erkannt), damit BEIDE Zweige
unit-getestet werden können, ohne globale Objekte zu mocken. Tests decken Mac UND non-Mac ab.

**Verifikation:** `npx vitest run src/ui/__tests__/shortcut-label.test.ts` grün; Typecheck.

---

## Task F2: Toolbar-Title mit Hotkey (`ui/toolbar.ts`)

**Files:**
- Modify: `src/ui/toolbar.ts`
- Test: `src/ui/__tests__/toolbar.test.ts` (ergänzen)

**Änderung:** In `buildItem`, builtin-Zweig ([toolbar.ts:36-40](../../../src/ui/toolbar.ts#L36-L40)),
den Title um das formatierte Shortcut ergänzen, falls `action.shortcut` gesetzt ist:

```typescript
const label = action.shortcut
  ? `${action.title} (${formatShortcut(action.shortcut)})`
  : action.title;
btn.title = label;
btn.setAttribute('aria-label', label);
```

Import `formatShortcut` aus `./shortcut-label`. Custom-Button-Zweig bleibt unverändert
(Custom-Buttons haben kein `shortcut`-Feld). Query-/Aktiv-Logik unberührt.

**Test:** Ein Built-in-Button mit Shortcut (z.B. `bold`) → sein `title`/`aria-label`
enthält sowohl den Klartext-Titel als auch das formatierte Kürzel. Ein Built-in ohne
Shortcut (z.B. `table`) → Title ohne Klammerzusatz.

**Verifikation:** `npx vitest run src/ui/__tests__/toolbar.test.ts` grün; volle Suite grün.

---

## Task F2a: Fehlende Überschriften-Kürzel in `actions.ts` ergänzen

**Files:**
- Modify: `src/ui/actions.ts`

**Warum:** `heading-1`…`heading-6` sind in [keymap.ts:26-31](../../../src/commands/keymap.ts#L26-L31)
aktiv auf `Ctrl-Alt-1…6` gebunden, tragen in [actions.ts:67-72](../../../src/ui/actions.ts#L67-L72)
aber **kein** `shortcut`-Feld. Mit F2 würde ihr Title dann fälschlich *keinen* Hotkey
nennen, obwohl einer existiert. Die sechs Einträge bekommen `shortcut: 'Ctrl-Alt-1'` …
`'Ctrl-Alt-6'`. (Nach F2b sind diese Einträge zugleich die Quelle der aktiven Bindung.)

**Casing-Konvention:** `actions.ts` schreibt heute den Tasten-Teil groß (`Mod-B`),
`keymap.ts` klein (`Mod-b`). CM6 bindet case-insensitiv, aber da F2b die keymap aus
`actions.ts` ableitet, wird eine Konvention festgelegt: **Tastenbuchstabe in `shortcut`
klein** (`'Mod-b'`, `'Ctrl-Alt-1'`, `"Mod-'"`). So bleibt der bestehende
`keymap.test.ts`-Kontrakt (`expect(keys).toContain('Mod-b')`) ohne Teständerung grün, und
`formatShortcut` (F1) upper-cased den Anzeige-Buchstaben ohnehin selbst (→ `⌘B`). Alle
`shortcut`-Werte in `actions.ts` entsprechend auf Kleinschreibung des Tastenteils
umstellen.

**Hinweis Plattform:** `Ctrl-Alt-N` ist bewusst `Ctrl` (nicht `Mod`) — auf Mac bleibt es
`Ctrl`, nicht `⌘`. `formatShortcut` muss `Ctrl` daher auch auf Mac als `⌃` (Control)
darstellen, NICHT als `⌘`. Nur `Mod` wird plattformabhängig zu `⌘`/`Ctrl`. → In F1 als
zusätzlichen Testfall abdecken: `'Ctrl-Alt-1'` → `⌃⌥1` (Mac) / `Ctrl+Alt+1` (non-Mac).

**Test:** `heading-1` → Title enthält formatiertes `Ctrl-Alt-1`.

**Verifikation:** volle Suite grün; Typecheck.

---

## Task F2b: keymap aus `actions.ts` ableiten (Single Source of Truth)

**Files:**
- Modify: `src/commands/keymap.ts`
- Test: `src/commands/__tests__/keymap.test.ts` (bestehende Kontrakte MÜSSEN grün bleiben)

**Ziel:** `BUILTIN_ACTIONS` (in `actions.ts`) wird die alleinige Quelle für alle Kürzel,
die zu einem Toolbar-Button gehören. `supaKeymap` leitet diese Bindungen ab, statt sie
ein zweites Mal von Hand zu führen. Nur Bindungen OHNE Toolbar-Button bleiben explizit.

**Wichtig — Import-Richtung:** Bisher fließt die Abhängigkeit `ui → commands`
([toolbar-config.ts:1](../../../src/ui/toolbar-config.ts#L1) importiert aus `./actions`;
`actions.ts` importiert die command-Funktionen aus `../commands/*`). `keymap.ts` würde nun
aus `../ui/actions` importieren — das ist eine **neue `commands → ui`-Kante**. Da
`actions.ts` selbst nur aus `../commands/*` liest (keine DOM-/View-Abhängigkeit), entsteht
**kein** Zyklus auf Modulebene: `keymap → ui/actions → commands/*`. Vor dem Merge mit
`npm run build` (Bundler meldet Zyklen) und Typecheck absichern.

**Ableitung (Skizze):**

```typescript
import { BUILTIN_ACTIONS } from '../ui/actions';

// Aus jedem Built-in mit shortcut eine Bindung ableiten.
const derived: KeyBinding[] = Object.values(BUILTIN_ACTIONS)
  .filter((a) => a.shortcut)
  .map((a) => ({ key: a.shortcut!, run: a.command, preventDefault: true }));

// Sonderfälle OHNE Toolbar-Button (bleiben handgepflegt):
const extras: KeyBinding[] = [
  { key: "Mod-'", run: quote, preventDefault: true },        // Primärkürzel quote…
  // Zweitkürzel Blockzitat (layout-unabhängig auf DE-Mac):
  { key: 'Ctrl-Alt-q', run: quote, preventDefault: true },
  // Sternchen-Liste (kein eigener Button, Alternative zum Spiegelstrich-Default):
  { key: 'Shift-Alt-Mod-l', run: unorderedListStar, preventDefault: true },
  // Listen-Fortsetzung: greift nur in Listenzeilen, sonst false → Standard-Enter:
  { key: 'Enter', run: continueList },
];

export const supaKeymap: KeyBinding[] = [...derived, ...extras];
```

**Zu beachten:**
- **`quote`-Primärkürzel `Mod-'`:** liegt in `actions.ts` am `quote`-Button → wird
  abgeleitet. Es darf NICHT zusätzlich in `extras` stehen, sonst doppelt gebunden. Nur das
  **Zweitkürzel** `Ctrl-Alt-q` gehört in `extras`. Der bestehende Test
  ([keymap.test.ts:23-30](../../../src/commands/__tests__/keymap.test.ts#L23-L30))
  verlangt, dass beide **dieselbe** `run`-Instanz teilen → erfüllt, weil beide auf
  `BUILTIN_ACTIONS['quote'].command` bzw. denselben `quote`-Import zeigen. Sicherstellen,
  dass `extras`' `quote` derselbe Import ist wie das command in `actions.ts` (beide aus
  `../commands/block`).
- **`heading-1…6`:** nach F2a tragen sie `Ctrl-Alt-1…6` → werden nun abgeleitet und
  ersetzen die heutigen handgeschriebenen `setHeading(n)`-Bindungen in keymap. Da
  `setHeading(n)` pro Aufruf eine neue Closure liefert, ist die abgeleitete Variante sogar
  konsistenter: gebunden wird exakt dieselbe Instanz, die der Button aufruft.
- **`undo`/`redo`:** deren `shortcut` (`Mod-z`/`Mod-y`) ist reine Anzeige — die echte
  Bindung kommt aus CM6s `historyKeymap` in
  [extensions.ts:24](../../../src/editor/extensions.ts#L24). Würde die Ableitung sie
  zusätzlich in `supaKeymap` binden, wäre das eine **Doppelbindung** mit historyKeymap.
  → **Entscheidung:** `undo`/`redo` von der Ableitung ausschließen (z.B. per Set
  `DISPLAY_ONLY = new Set(['undo', 'redo'])` in der `.filter`-Bedingung), damit ihr
  Kürzel nur im Title erscheint, nicht doppelt gebunden wird. Im Code kommentieren, warum.

**Test-Ergänzungen** (bestehende bleiben unverändert grün):
- Ein abgeleitetes Kürzel ist vorhanden UND zeigt auf dieselbe Command-Instanz wie der
  zugehörige `BUILTIN_ACTIONS`-Eintrag (z.B. `bold`).
- `undo`/`redo` sind NICHT in `supaKeymap` (nur Anzeige, Bindung via historyKeymap).
- Kein Kürzel ist doppelt gebunden (Keys sind eindeutig, außer bewusst
  `quote` = zwei verschiedene Keys auf denselben Command).

**Verifikation:** `npx vitest run src/commands/__tests__/keymap.test.ts` grün; volle Suite
grün; `npm run build` ohne Zyklus-Warnung; Typecheck.

---

## Task F3: Toolbar-Styling — durchgehende Leiste (`ui/toolbar.css`)

**Files:**
- Modify: `src/ui/toolbar.css`

**Ziel:** Die Toolbar ist eine durchgehende Leiste über die volle Breite des Containers
(ist durch den Flex-Container + Container-Border bereits gegeben — sicherstellen, dass
kein horizontaler Rand/Gap die „Durchgängigkeit" bricht). Die Icon-Buttons integrieren
sich harmonisch statt einzeln wie Buttons auszusehen.

**Konkret (Entscheidung B = nahtlose, flache Buttons):**
- Buttons: `border` transparent halten und den `.active`-`border-color` entfernen, sodass
  sie im Ruhezustand flach in der Leiste liegen (kein „Kästchen"-Look).
- Hover: dezente Hintergrundfläche (kein harter Rahmen) — wie heute (`background`), aber
  ohne Rahmen.
- Aktiv (`.active`): nur dezent farbig hinterlegt, integriert (aktueller
  `border-color: #a8c6ff` entfällt).
- Leiste: als zusammenhängende Fläche; Padding/Abstände so, dass die Leiste optisch
  durchgehend wirkt (volle Breite ist durch Flex + Container-Border bereits gegeben).
- Separatoren bleiben als dezente vertikale Trenner.

**Wartbarkeit — CSS Custom Properties:** Die heute an drei Stellen wiederholten Hex-Werte
(`#d0d0d0` in Container-Border, Toolbar-Border-Bottom, Separator) und die Button-Farben
in `:root` bzw. `.supamde-container` als Custom Properties definieren
(`--supamde-border`, `--supamde-toolbar-bg`, `--supamde-btn-hover`,
`--supamde-btn-active`) und in den Regeln referenzieren. Erhöht Themebarkeit und
Wiederverwendbarkeit; kein Wert wird mehr doppelt gepflegt.

**Verifikation:** `npm run build` grün (CSS gebündelt); visuelle Nachprüfung durch User.
Kein Unit-Test (Styling).

---

## Task F4: Beispiel bereinigen (`example/index.html`)

**Files:**
- Modify: `example/index.html`

**Änderung:** Den Demo-Custom-Button `shout` („In Großbuchstaben") vollständig aus dem
`toolbar`-Array entfernen. Das Beispiel demonstriert dann Default-Toolbar (mit
Hotkey-Titeln, Punkt 4) + Statusbar. Die Custom-Button-Fähigkeit bleibt in der README
dokumentiert.

**Verifikation:** `npm run build` grün; Beispiel lädt ohne den Button; visuelle Prüfung.

---

## Task F5: README-Konsistenz prüfen

**Files:**
- Modify (nur falls nötig): `README.md`

**Änderung:** Sicherstellen, dass die Custom-Button-Doku ([README.md:64-67](../../../README.md#L64-L67))
nach dem Entfernen des Beispiel-Buttons weiterhin korrekt und widerspruchsfrei ist. Die
Doku beschreibt die API-Signatur — sie darf bleiben, auch wenn das konkrete Beispiel nicht
mehr im `example/` steht. Kein „siehe Beispiel"-Verweis auf den entfernten Button darf
übrig bleiben.

**Verifikation:** `grep -n "shout\|Großbuchstaben" README.md` — nur die generische
API-Doku, kein toter Verweis.

---

## Abschluss-Verifikation

- [ ] Volle Testsuite grün: `npx vitest run` (inkl. neuer shortcut-label + toolbar-Title-
      + keymap-Ableitungs-Tests; bestehende keymap-Kontrakte unverändert grün).
- [ ] Typecheck sauber: `npm run typecheck`.
- [ ] Lint sauber: `npm run lint`.
- [ ] Build grün: `npm run build` (keine Modulzyklus-Warnung durch neue
      `commands → ui/actions`-Kante).
- [ ] **Manuelle Hotkey-Stichprobe:** ein abgeleitetes Kürzel (z.B. `Ctrl-Alt-1` für H1)
      und `undo`/`redo` funktionieren im Editor wie zuvor (keine Doppelbindung/Regression).
- [ ] **Visuelle Nachprüfung durch User:** durchgehende Leiste, integrierte Buttons,
      Hotkey im Title (inkl. `Ctrl-Alt-1…6` an den Überschriften), kein Demo-Button mehr.

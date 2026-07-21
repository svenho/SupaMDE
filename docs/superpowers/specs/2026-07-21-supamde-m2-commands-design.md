# SupaMDE M2 — Toolbar-Aktionen als CM6-Commands

**Datum:** 2026-07-21
**Status:** Freigegeben (Design)
**Meilenstein:** M2 (Aktionen) — Priorität des Auftraggebers
**Voraussetzung:** M0 (Gerüst) und M1 (Editor-Kern) abgeschlossen.
**Übergeordnete Spec:** `docs/superpowers/specs/2026-07-17-supamde-cm6-migration-design.md` (Abschnitt 4)

---

## 1. Ziel & Abgrenzung

M2 setzt **alle Toolbar-Aktionen als reine CM6-Commands** um, verdrahtet die
**Default-Shortcuts** und **Undo/Redo (History)** und sichert das Ganze mit
**Unit-Tests** ab. Die Commands wirken in M2 über Tastenkürzel und sind headless
testbar; die **Toolbar-Anbindung erfolgt erst in M3**.

Diese Meilenstein-Spec verfeinert nur die für M2 offenen Entscheidungen. Der
Rahmen (Modul-Gruppierung, `SupaCommand`-Signatur, Toggle über Syntaxbaum,
Listen-Fortsetzung, Prompt-basierte Link/Bild-Eingabe) stammt aus der
übergeordneten Spec, Abschnitt 4.

### In Scope (M2)

- Alle text-manipulierenden Commands: inline, block, list, link, image
  (Einfüge-Command), table.
- History-State (`history()`) + Undo/Redo-Commands.
- `supaKeymap` mit den easyMDE-Default-Shortcuts, eingebunden in
  `editor/extensions.ts`.
- Unit-Tests (Vitest, headless) je Command-Modul.

### Out of Scope (bewusst, → spätere Meilensteine)

- **Echte Bild-Upload-Mechanik** (Drag&Drop, Paste, `imageUploadFunction`): M5.
  `image` fügt in M2 nur Platzhalter-Markup ein.
- **Toolbar-DOM, Button-Aktiv-Zustände, statische `SupaMDE.toggleBold`-Aliase:**
  M3. Beide Konsumenten der Commands (Toolbar + Statics) werden dort gemeinsam
  verdrahtet (YAGNI in M2).
- **Auswertung der `shortcuts`-Option** (Umbelegen/Deaktivieren durch den Nutzer):
  M3. Die Option bleibt in der API akzeptiert, ist in M2 aber wirkungslos.
- **`togglePreview`/`toggleSideBySide`/`toggleFullScreen`-Shortcuts:** gehören zu
  den zugehörigen Features (M4) und sind nicht Teil des M2-Keymaps.

---

## 2. Grundmuster: reine Commands

**Signatur** (aus übergeordneter Spec Abschnitt 4):

```typescript
type SupaCommand = (view: EditorView) => boolean;
```

Ein Command liest `view.state` (Selektion, Doc, **Lezer-Syntaxbaum** via
`syntaxTree(state)`), dispatcht bei Bedarf eine Transaktion und gibt `true`
zurück, wenn er griff — CM6-Command-Konvention. Greift er nicht (z. B. leere/
abgebrochene URL), erfolgt ein No-op und Rückgabe `false`.

**Zwei Formen:**

- **Argumentfreie Commands** (`bold`, `italic`, `quote`, `undo` …): direkt
  `SupaCommand`.
- **Parametrisierte Commands** über eine **Fabrik**, die den reinen Command
  liefert:
  - `insertLink(url: string, text?: string): SupaCommand`
  - `insertImage(url: string, altText?: string): SupaCommand`
  - `setHeading(level: 1|2|3|4|5|6): SupaCommand`

Der **reine Kern** ist damit ohne Mock unit-testbar. Die **Prompt-Beschaffung**
(`prompt()` / `promptURLs` / `promptTexts`) sitzt in einem **dünnen Wrapper** in
`link-image.ts`, isoliert vom Kern und in M3 an die Toolbar verdrahtbar. Dieses
Muster führt das M1-Headless-Prinzip (`editor/value.ts`) konsequent fort.

---

## 3. Modulstruktur

Neu unter `src/commands/`:

```
src/
  commands/
    types.ts        → SupaCommand-Typ + gemeinsame Helfer-Signaturen
    inline.ts       → bold, italic, strikethrough, inline-code
    block.ts        → heading (1–6, smaller/bigger), quote, code-block, hr, clean-block
    list.ts         → unordered/ordered/check-list + Listen-Fortsetzung (Extension)
    link-image.ts   → link, image (Platzhalter-Markup; echter Upload = M5)
    table.ts        → table
    history.ts      → undo, redo (dünn über @codemirror/commands)
    keymap.ts       → supaKeymap (Default-Shortcuts → Commands)
    __tests__/      → ein Test-File je Modul
  utils/
    text.ts         → reine Text-/Range-Helfer (Zeilen-Range, Selektion-Wrapping)
```

`utils/text.ts` sammelt kleine reine Helfer (Zeilen einer Selektion ermitteln,
Selektion mit Markern umschließen, Präfix toggeln), die von mehreren
Command-Modulen genutzt und separat unit-getestet werden.

**Neue Dependency:** `@codemirror/commands@^6.10.4` (aktuelle 6er-Linie, passend
zu den übrigen `@codemirror/*`-Paketen auf `^6`) — liefert `history()`, `undo`,
`redo`, `defaultKeymap`, `historyKeymap`.

---

## 4. Command-Logik im Detail

### 4.1 Inline (`inline.ts`) — syntaxbaum-basiertes Toggle

`bold`, `italic`, `strikethrough`, `inlineCode`.

- `syntaxTree(state)` an der Selektion abfragen. Liegt ein umschließender Knoten
  vor (`StrongEmphasis`, `Emphasis`, `Strikethrough`, `InlineCode`), dessen
  **Marker-Kinder** (die `**` / `_` / `~~` / `` ` ``-Knoten) per Transaktion
  entfernen → **unformatieren**.
- Andernfalls Marker um die Selektion legen → **formatieren**.
- **Leere Selektion:** Marker-Paar einfügen, Cursor dazwischen setzen
  (easyMDE-Verhalten).
- Robustheit: Der echte Parser liefert die Knotengrenzen; verschachtelte/
  mehrzeilige Fälle brechen nicht (die Fragilität von easyMDEs String-Matching
  entfällt bewusst). Fehlt wider Erwarten ein Knoten, Fallback auf „formatieren".

### 4.2 Block (`block.ts`) — zeilenorientiert

`heading` (1–6 absolut, `smaller`/`bigger` relativ), `quote`, `codeBlock`,
`horizontalRule`, `cleanBlock`.

- **heading:** betroffene Zeilen ermitteln, führende `#`-Sequenz über den
  Syntaxbaum (`ATXHeading1…6`) erkennen. `setHeading(level)` setzt absolut;
  `smaller`/`bigger` verschieben das Level (Grenzen 1…6); erneutes Setzen des
  gleichen Levels entfernt die Überschrift (Toggle).
- **quote:** Zeilen-Präfix `> ` über die Selektion toggeln.
- **codeBlock:** Selektion in einen ` ``` `-Fence hüllen (bzw. entfernen, wenn
  bereits umschlossen).
- **horizontalRule:** `\n---\n` an der Cursorzeile einfügen.
- **cleanBlock:** erkannte Block-Marker (`#`-Präfix, `> `, Listen-Präfixe) der
  selektierten Zeilen entfernen.

Bei mehrzeiliger Selektion sind **alle** betroffenen Zeilen im Scope
(easyMDE-Verhalten).

### 4.3 Listen (`list.ts`)

`unorderedList`, `orderedList`, `checkList` + **Listen-Fortsetzung**.

- **Toggle:** Zeilen-Präfixe `- ` / `1. ` / `- [ ] ` über die Selektion
  hinzufügen/entfernen; bei `orderedList` fortlaufend nummerieren.
- **Listen-Fortsetzung** (ersetzt CM5-`continuelist`): eigene kleine
  **Extension** als `Enter`-Keymap-Eintrag, der vor `insertNewlineAndIndent`
  greift:
  - Enter in einer nicht-leeren Listenzeile → Präfix in der neuen Zeile
    fortsetzen (bei `orderedList` inkrementieren).
  - Enter in einer leeren Listenzeile → Präfix entfernen, Liste beenden.

### 4.4 Link & Bild (`link-image.ts`)

- **Reiner Kern:**
  - `insertLink(url, text?)` → fügt `[text](url)` ein; nutzt die Selektion als
    `text`, wenn vorhanden.
  - `insertImage(url, altText?)` → fügt `![altText](url)` ein; nutzt die
    Selektion als `altText`, wenn vorhanden.
- **Wrapper:** holt URL/Text via `prompt()` bzw. den Optionen `promptURLs`,
  `promptTexts` und ruft den reinen Command. Leere/abgebrochene Eingabe →
  Command greift nicht (`false`).
- `image` fügt in M2 nur Markup ein; die echte Upload-Mechanik ist M5.

### 4.5 Tabelle (`table.ts`)

`table` fügt ein GFM-Tabellengerüst (Header-Zeile + Trennzeile + eine Datenzeile)
am Cursor ein.

### 4.6 History (`history.ts`)

`undo` / `redo` als dünne Wrapper/Re-Exports über `@codemirror/commands`. Der
History-**State** wird über die `history()`-Extension bereitgestellt (siehe
Abschnitt 5).

---

## 5. Extensions, Keymap & History-Integration

Erweiterung der bestehenden `editor/extensions.ts` (M1), konsistent zum
Prinzip „jede Option → echte Extension":

```
history(),
keymap.of([...supaKeymap, ...historyKeymap, ...defaultKeymap]),
```

**Reihenfolge:** `supaKeymap` zuerst, damit die SupaMDE-Bindings Vorrang vor den
Standard-Keymaps haben. `historyKeymap` liefert `Mod-z` / `Mod-y` (Undo/Redo),
`defaultKeymap` das übrige Standard-Editing.

### 5.1 supaKeymap — Default-Shortcuts

Aus easyMDE übernommen (`src/js/easymde.js`, `shortcuts`), `Cmd` → CM6 `Mod`
(plattformgerecht: Cmd auf macOS, Ctrl sonst). **Nur die M2-relevanten Aktionen**
— Preview/SideBySide/Fullscreen (F9/F11/`Mod-P`) gehören zu M4.

| Shortcut (CM6) | Command |
|---|---|
| `Mod-b` | bold |
| `Mod-i` | italic |
| `Mod-k` | link (Wrapper) |
| `Mod-h` | heading-smaller |
| `Shift-Mod-h` | heading-bigger |
| `Ctrl-Alt-1` … `Ctrl-Alt-6` | heading 1 … 6 |
| `Mod-e` | clean-block |
| `Mod-Alt-i` | image (Wrapper) |
| `Mod-'` | quote |
| `Mod-Alt-l` | ordered-list |
| `Mod-l` | unordered-list |
| `Shift-Mod-l` | check-list |
| `Mod-Alt-c` | code-block |
| `Enter` | Listen-Fortsetzung (list.ts) |

`strikethrough`, `inline-code`, `horizontal-rule` und `table` haben in easyMDE
keinen Default-Shortcut und bekommen in M2 auch keinen — sie sind über Command
und (ab M3) Toolbar erreichbar.

---

## 6. Teststrategie (Herzstück von M2)

Unit-Tests (Vitest, headless) sind das neue Sicherheitsnetz, das easyMDE fehlt.

- **Pro Command-Modul** ein Test-File in `commands/__tests__/`; zusätzlich
  Tests für `utils/text.ts`.
- **Muster:** headless `EditorView`/`EditorState` bauen (Doc + Selektion via
  `EditorState.create`), Command aufrufen, `state.doc.toString()` und die neue
  Selektion prüfen. Kein DOM, kein Mock — die Commands sind rein.
- **Abdeckung je Command:** formatieren (mit/ohne Selektion), Toggle-Off
  (bereits formatiert), mehrzeilige Selektion, Rand-/Leerfälle. Für inline
  zusätzlich verschachtelte Marker (der Fall, an dem String-Matching bräche).
- **Listen-Fortsetzung:** State + `Enter`-Command simulieren; Präfix-Fortsetzung
  und Listen-Ende prüfen.
- **Prompt-Wrapper:** die Logik-Last liegt im reinen Kern (ohne Mock getestet);
  wird der Wrapper selbst getestet, via `vi.stubGlobal('prompt', …)`.

---

## 7. Fehlerbehandlung & Robustheit

- Jeder Command gibt `false` zurück, wenn er nicht greift (z. B. `insertLink`
  ohne URL) — keine Transaktion, No-op. CM6-konform.
- Kein Werfen bei normaler Benutzung; ungültige Zustände → No-op + `false`.
- Syntaxbaum-Abfragen defensiv: fehlt ein erwarteter Knoten, Fallback auf
  „formatieren" statt Absturz.

---

## 8. Definition of Done (M2)

- Alle Commands (außer echter Bild-Upload) implementiert und unit-getestet.
- `supaKeymap` + `history()` in `buildExtensions` integriert; Shortcuts wirken
  im `example/`.
- `npm run test:run`, `npm run typecheck`, `npm run lint` grün.
- `example/`-Seite: Text lässt sich per Shortcut formatieren (sichtbares
  M2-Ergebnis).

---

## 9. Bewusste Grenzen (YAGNI / Scope)

- Kein Toolbar-DOM, keine Button-Aktiv-Zustände, keine statischen Aktions-Aliase
  in M2 (→ M3).
- Keine Auswertung der `shortcuts`-Option (Umbelegen/Deaktivieren) in M2 (→ M3).
- `image` ohne echte Upload-Mechanik (→ M5).
- Preview/SideBySide/Fullscreen-Shortcuts nicht Teil des M2-Keymaps (→ M4).

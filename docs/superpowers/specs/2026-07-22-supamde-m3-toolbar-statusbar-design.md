# SupaMDE M3 — Toolbar & Statusbar

**Datum:** 2026-07-22
**Status:** Freigegeben (Design)
**Meilenstein:** M3 (baut auf M0–M2 auf)
**Bezug:** [CM6-Migrations-Design §5](2026-07-17-supamde-cm6-migration-design.md)

---

## 1. Ziel & Scope

M3 liefert eine funktionierende, konfigurierbare **Toolbar** und **Statusbar**,
verdrahtet über *einen* zentralen `EditorView.updateListener` — den „roten Faden"
aus §5 des CM6-Migrations-Designs. Alle reaktiven UI-Teile werden aus einer Stelle
gespeist.

### Scope-Grenzen (bewusst)

- **Toolbar** enthält vorerst **nur M1/M2-Aktionen** (Inline-Formatierung, Blöcke,
  Listen, Link/Bild, Tabelle, undo/redo). Preview-/SideBySide-/Fullscreen-Buttons
  kommen mit M4, wenn ihre Commands existieren. Kein toter Button — jeder Button
  funktioniert sofort.
- **Statusbar** setzt `lines`, `words`, `cursor` + Custom-Items um. Der
  `autosave`-Slot ist als Name vorgesehen, wird aber erst in M5 mit Inhalt gefüllt.
- **Icons:** Lucide-SVG werden **gebündelt und inline gerendert** (autark, kein CDN).
  Dies bricht bewusst die im CM6-Design (§4/§5) zugesagte `className: 'fa fa-…'`-Konvention
  für Built-in-Buttons — siehe [§7 Bewusste Abweichung](#7-bewusste-abweichung-vom-cm6-design).

### Nicht in M3 (YAGNI)

- Preview/SideBySide/Fullscreen-Buttons (M4)
- Echte Autosave-Anzeige (M5)
- Dropdown-Menüs, sofern easyMDEs Default-Toolbar keine hat (1:1 an easyMDE orientiert)

---

## 2. Modulstruktur

Neue und geänderte Module (Namensschema aus §2 des CM6-Designs):

```
src/
  ui/
    toolbar.ts          → Toolbar-DOM: Button/Dropdown/Separator-Rendering, Aktiv-Zustand
    toolbar-config.ts   → Default-Toolbar-Definition + Normalisierung der toolbar-Option
    actions.ts          → Registry: Built-in-Name → ToolbarAction (Command + Icon + Titel + Shortcut)
    icons.ts            → Lucide-Icon-Mapping + SVGElement-Erzeugung
    statusbar.ts        → Statusbar-DOM: Item-Rendering, Update
    update-listener.ts  → zentraler EditorView.updateListener, speist Toolbar + Statusbar
    toolbar.css         → schlichtes Default-Styling (via Vite mitgebaut)
    statusbar.css
  features/
    word-count.ts       → reine wordCount(text)-Funktion
  commands/
    queries.ts          → reine Zustands-Abfragen (isBold, isQuote …) für Aktiv-Zustand
  options.ts            → erweitert um toolbar?, status?
  index.ts              → Fassade: Container-DOM aufbauen, Toolbar/Statusbar einhängen
```

**Neue Dependency:** `lucide` (Icons, gebündelt/tree-shakebar).

---

## 3. Datenfluss — der zentrale `updateListener`

Die zentrale Vereinfachung gegenüber easyMDEs verstreuten CM5-Handlern: **ein**
`EditorView.updateListener` speist alle reaktiven UI-Teile.

```
Nutzer tippt / klickt Button / Shortcut
        │
        ▼
CM6-Transaktion → neuer EditorState
        │
        ▼
updateListener (ui/update-listener.ts)
  unterscheidet: docChanged / selectionSet
        │
        ├──────────────┬───────────────────┐
        ▼              ▼                   ▼
  Toolbar-Aktiv-   Statusbar          (später M4/M5:
  Zustand          (lines/words/       Preview, Autosave)
  (queries.ts +    cursor)
   syntaxTree)
```

### Aktiv-Zustand ohne Dispatch — `commands/queries.ts`

Die M2-Toggle-Commands *dispatchen*: sie prüfen intern „ist der Cursor in fettem
Text?" und schalten um. Für den Aktiv-Zustand der Toolbar-Buttons wird **dieselbe
Prüfung ohne Dispatch** gebraucht, als reine Abfrage `(state: EditorState) => boolean`.

Deshalb `commands/queries.ts`: die Zustands-Prüflogik wird aus den Commands in reine
Query-Funktionen extrahiert (`isBold`, `isItalic`, `isStrikethrough`, `isInlineCode`,
`isQuote`, `isCodeBlock`, `activeHeadingLevel`, `isInUnorderedList`, `isInOrderedList`,
`isInCheckList` …). Commands **und** Aktiv-Zustand nutzen dann dieselbe Logik — keine
Duplikation, beides unit-testbar.

Dies ist der einzige echte Eingriff in bestehenden M2-Code: eine reine Refaktorierung.
Das Verhalten der Commands bleibt identisch und ist durch die vorhandenen Command-Tests
(`commands/__tests__/*`) abgesichert.

### Registrierung

`editor/extensions.ts` reicht eine optionale `updateListener`-Extension in die View.
Die Fassade (`index.ts`) hängt die Toolbar-/Statusbar-Callbacks ein. Toolbar und
Statusbar kennen den Editor **nicht** direkt — sie bekommen bei jedem Update den
`EditorState` gereicht und aktualisieren sich selbst.

---

## 4. Toolbar

### 4.1 Konfigurations-API (easyMDE-kompatibel, CM6-Design §4)

Die `toolbar`-Option akzeptiert wie easyMDE:

- `false` → keine Toolbar
- nicht gesetzt → Default-Toolbar
- Array aus:
  - **Built-in-Namen** (Strings): `'bold'`, `'italic'`, `'|'` (Separator) …
  - **Custom-Button-Objekten**: `{ name, action, className?, title?, … }`

### 4.2 Registry — `ui/actions.ts`

Kern der Verdrahtung: eine Map `Built-in-Name → ToolbarAction`.

```typescript
interface ToolbarAction {
  command: SupaCommand;                     // reine CM6-Command-Funktion aus commands/
  query?: (state: EditorState) => boolean;  // Aktiv-Zustand (optional)
  icon: string;                             // Lucide-Icon-Name
  title: string;                            // Tooltip
  shortcut?: string;                        // für Tooltip-Anzeige, aus keymap.ts abgeleitet
}
```

- **Built-in-Buttons**: Klick → `view.focus()` + `action.command(view)`.
  Aktiv-Zustand → `action.query(state)`.
- **Custom-Buttons**: behalten die easyMDE-Signatur `action(editor)` — bekommen die
  `SupaMDE`-Instanz. Kein Aktiv-Zustand.

Klare Trennung: Built-ins nutzen die reinen Commands, Custom-Buttons die Fassade.

### 4.3 Icons — `ui/icons.ts`

Mapping Built-in-Name → Lucide-Icon (z.B. `bold` → `Bold`, `quote` → `Quote`,
`unordered-list` → `List`, `link` → `Link`, `table` → `Table`). Rendering via
`createElement(iconData)` aus dem `lucide`-Paket → liefert ein fertiges `SVGElement`,
das direkt in den Button gehängt wird (framework-agnostisch, läuft in jsdom).

Custom-Buttons mit `className` bekommen weiterhin ihr `<i class="…">` — API-Kompatibilität
für Nutzer, die eigene Icon-Fonts einbinden.

### 4.4 Rendering — `ui/toolbar.ts`

`<div class="supamde-toolbar">` mit `<button>`-Elementen und `<i>`-Separatoren.
Aktiv-Zustand über CSS-Klasse (`.active`), gesetzt vom `updateListener`. Tooltips mit
Shortcut-Anzeige (aus `keymap.ts` abgeleitet, plattformgerecht).

### 4.5 Abbildung Built-ins → M3-Commands (vorhanden aus M2)

| Built-in | Command-Modul | Aktiv-Zustand |
|---|---|---|
| `bold`, `italic`, `strikethrough`, `code` | `inline.ts` | ✓ |
| `heading-1`…`6`, `heading-smaller/bigger`, `quote`, `code-block`, `horizontal-rule`, `clean-block` | `block.ts` | ✓ (außer `hr`, `clean-block`) |
| `unordered-list`, `ordered-list`, `check-list` | `list.ts` | ✓ |
| `link`, `image` | `link-image.ts` (`drawLink`/`drawImage`) | – |
| `table` | `table.ts` | – |
| `undo`, `redo` | `history.ts` | – |

---

## 5. Statusbar

### 5.1 Konfigurations-API (easyMDE-kompatibel)

Die `status`-Option akzeptiert:

- `false` → keine Statusbar
- nicht gesetzt → Default: `['lines', 'words', 'cursor']`
- Array aus:
  - **Built-in-Namen**: `'lines'`, `'words'`, `'cursor'` (sowie der vorgesehene
    `'autosave'`-Slot: als Name *akzeptiert*, aber **nicht** im Default enthalten und
    in M3 ein No-op — er rendert ein leeres `<span>`, das M5 füllt)
  - **Custom-Item-Objekten**: `{ className, defaultValue, onUpdate?(el), onActivity?(el) }`
    — easyMDE-kompatibel

### 5.2 Built-in-Items (rein aus `EditorState` ableitbar)

- `lines` → `state.doc.lines`
- `words` → `wordCount(state.doc.toString())` aus `features/word-count.ts`
- `cursor` → Zeile/Spalte aus `state.selection.main.head` via `state.doc.lineAt(…)`

### 5.3 Rendering — `ui/statusbar.ts`

`<div class="supamde-statusbar">` mit `<span>` pro Item. Der `updateListener` ruft je
Item die Aktualisierung auf: `onUpdate` bei `docChanged`, `onActivity` bei
`selectionSet` (analog easyMDE).

### 5.4 `features/word-count.ts`

Reine Funktion `wordCount(text: string): number`. Voll unit-getestet (leerer Text,
Whitespace-only, Unicode, mehrere Absätze) — das neue Sicherheitsnetz, das easyMDE fehlt.

---

## 6. Fassaden-Anbindung — `index.ts`

Der Konstruktor baut nach der `EditorView` das DOM-Gerüst:

```
<div class="supamde-container">
  <div class="supamde-toolbar"> … </div>     ← wenn toolbar ≠ false
  <div class="cm-editor"> … </div>            ← die EditorView
  <div class="supamde-statusbar"> … </div>    ← wenn status ≠ false
</div>
```

**Neue/erweiterte öffentliche Methoden:**

- `updateStatusBar(itemName, content)` — API-kompatibel, delegiert an `ui/statusbar.ts`
- `toTextArea()` / `cleanup()` — räumen jetzt auch Toolbar-/Statusbar-DOM ab

**Options-Erweiterung** (`options.ts`): `toolbar?` und `status?` ergänzen;
`resolveOptions` um die Normalisierung erweitern.

---

## 7. Bewusste Abweichung vom CM6-Design

Das ursprüngliche CM6-Migrations-Design (§4/§5) sah vor, dass Built-in-Buttons
FontAwesome-`className`s (`fa fa-bold`) rendern und dies **Teil der öffentlichen API**
ist. M3 weicht hier bewusst ab:

- **Built-in-Buttons rendern gebündelte Lucide-Inline-SVG** statt `fa`-Klassen.
  Grund: SupaMDE ist damit out-of-the-box in jedem Projekt einsatzfähig (kein
  CDN-Einbinden nötig), und im Zielprojekt des Auftraggebers, das ohnehin Lucide nutzt,
  fügt es sich optisch nahtlos ein.
- **Custom-Buttons behalten die `className`-API** — wer eigene Icon-Fonts (FontAwesome,
  Bootstrap Icons) einbindet, kann `className` weiterhin setzen; SupaMDE rendert dann
  `<i class="…">`.

Trade-off: eine `lucide`-Abhängigkeit und Icon-Auswahl-Pflege gegen bessere
Out-of-the-box-Erfahrung. Bewusst gewählt.

---

## 8. Teststrategie (drei Ebenen, CM6-Design §7)

### Unit (Vitest)

- `features/word-count.ts` — Randfälle (leer, Whitespace, Unicode, Absätze)
- `commands/queries.ts` — jede Query gegen headless `EditorState` (ist-fett bei Cursor
  in `**x**`, aktive Heading-Ebene, ist-in-Liste …)
- `ui/toolbar-config.ts` + Statusbar-Normalisierung — Default-Auflösung, `false`,
  Custom-Buttons

### Komponenten (Vitest + jsdom)

- `ui/toolbar.ts` — rendert korrekte Buttons aus Config; Klick löst Command aus;
  Aktiv-Zustand setzt `.active`; Custom-Button ruft `action(editor)`
- `ui/statusbar.ts` — rendert Items; Update ändert Textinhalt
- `ui/actions.ts` — Registry-Vollständigkeit (jeder Default-Built-in hat Command +
  Icon + Titel)
- `ui/icons.ts` — Icon-Erzeugung liefert `SVGElement` (läuft in jsdom)

### Fassade

- Konstruktor baut Container-DOM
- `toTextArea()` räumt Toolbar-/Statusbar-DOM ab

---

## 9. Styling & Beispiel

**Styling:** `src/ui/toolbar.css` + `statusbar.css` — schlichtes Default-Styling, das
easyMDEs Erscheinungsbild grob nachbildet (CSS/DOM darf sich laut §9 des CM6-Designs
ändern). Wird über Vite mitgebaut.

**Beispiel (`example/index.html`):** erweitert um sichtbare Toolbar + Statusbar;
demonstriert Default-Toolbar, einen Custom-Button und die Statusbar-Items. Da Icons
gebündelt sind, ist **kein** CDN-Einbinden nötig — funktioniert autark.

---

## 10. Meilenstein-Ergebnis M3

Sichtbare, klickbare Toolbar mit Aktiv-Zuständen und funktionierende Statusbar im
`example/`; `npm run build` + `npm test` grün; alle neuen Module unit- und
komponentengetestet.

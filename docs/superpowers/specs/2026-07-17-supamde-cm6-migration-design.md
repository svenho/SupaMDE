# SupaMDE — Migration von easyMDE (CodeMirror 5) auf CodeMirror 6

**Datum:** 2026-07-17
**Status:** Freigegeben (Design)
**Ausgangsbasis:** easyMDE v2.21.0 (Klon), CodeMirror v5, ES5-Monolith

---

## 1. Ziel & Leitprinzipien

SupaMDE ist die modernisierte Neufassung von easyMDE. Zwei gleichrangige Ziele:

1. **Drop-in-Ersatz für easyMDE v2** — Grad: **API + Optionen**. Konstruktor,
   Options-Objekt und öffentliche Methoden bleiben strukturell identisch.
   CSS-Klassen und DOM-Struktur **dürfen sich ändern** (CM6 bringt ohnehin eine
   andere DOM-Struktur mit). Nicht garantiert: Zugriff auf das interne CM-Objekt.
2. **Saubere, modulare Codebasis** — weg vom 3085-Zeilen-Monolithen hin zu
   kleinen, fokussierten TypeScript-Modulen mit Unit-Tests.

**Kernspannung, die alles prägt:** Die *Außenseite* (öffentliche API) bleibt
stabil, die *Innenseite* wird CM6-idiomatisch komplett neu gebaut.

**Migrations-Grundansatz:** Neuschreiben auf CM6-Idiomen (Extensions,
StateFields, Commands, Transactions) — **kein** Adapter-Layer. Jede Feature-Aktion
wird ein echter CM6-Command, kein Zwischen-Code.

### Priorisierung (wichtig)

**M0–M2 sind die Priorität des Auftraggebers** (Gerüst, Editor-Kern, Aktionen).
M3–M6 sind klar nachgelagert. Der Implementierungsplan muss den Schwerpunkt auf
M0–M2 legen; spätere Meilensteine dürfen gröber bleiben.

---

## 2. Gesamtarchitektur / Modulstruktur

Statt eines Monolithen kleine Module mit je einer klaren Aufgabe:

```
src/
  index.ts                 → öffentliche SupaMDE-Klasse (Fassade / API-Schicht)
  options.ts               → Optionen-Typen + Defaults + Normalisierung
  editor/
    setup.ts               → baut die CM6 EditorView aus Optionen (fromTextArea-Äquivalent)
    extensions.ts          → stellt die CM6-Extension-Liste aus Optionen zusammen
    theme.ts               → EditorView.theme (ersetzt das CM5 'easymde'-Theme)
    highlight.ts           → HighlightStyle: easyMDE-In-Editor-Formatierung ("Quasi-WYSIWYG")
  commands/                → jede Toolbar-Aktion als reiner CM6-Command
    inline.ts              → bold, italic, strikethrough, inline-code
    block.ts               → heading (smaller/bigger/1–6), quote, code-block, hr, clean-block
    list.ts                → unordered/ordered/check-list (inkl. Listen-Fortsetzung)
    link-image.ts          → link, image, upload-image
    table.ts               → table
    history.ts             → undo/redo (dünn über @codemirror/commands)
  markdown/
    parse.ts               → Markdown→HTML via marked (Preview)
    sanitize.ts            → addAnchorTargetBlank, Checkbox-Handling etc.
  ui/
    toolbar.ts             → Toolbar-DOM + Button-Rendering + Aktiv-Zustand
    statusbar.ts           → Statusbar (words, lines, cursor, autosave …)
    preview.ts             → Preview- & SideBySide-Panels (inkl. Scroll-Sync)
    fullscreen.ts          → Fullscreen-Toggle (CSS-basiert)
  features/
    autosave.ts            → localStorage-Autosave
    image-upload.ts        → uploadImage(s), Drag&Drop, Paste
    word-count.ts          → wordCount-Utility
  utils/
    dom.ts, text.ts …      → kleine reine Helfer (gut unit-testbar)
```

**Prinzip:** Jedes Modul isoliert verständlich und testbar. `commands/`-Funktionen
sind reine CM6-Commands `(view: EditorView) => boolean` — testbar ohne DOM-Toolbar.
`SupaMDE` in `index.ts` ist nur eine dünne Fassade, die auf die Module delegiert.

**Naming:** Paket `supamde`, Hauptklasse `SupaMDE`. Optionaler `EasyMDE`-Alias-Export
(Entscheidung in M6).

---

## 3. Editor-Kern (das Herzstück der Migration)

Vier konzeptionelle Brüche gegenüber CM5:

### 3.1 `fromTextArea` → eigener Helfer

CM6 hat kein `fromTextArea`. Nachbau in `editor/setup.ts` gemäß offizieller
Migrations-Doku: `EditorView` erzeugen, vor das Textarea einfügen, Textarea
verstecken, bei Form-Submit Wert zurücksynchronisieren. Deckt `forceSync` und
`toTextArea()` ab.

```javascript
function editorFromTextArea(textarea, extensions) {
  let view = new EditorView({doc: textarea.value, extensions})
  textarea.parentNode.insertBefore(view.dom, textarea)
  textarea.style.display = "none"
  if (textarea.form) textarea.form.addEventListener("submit", () => {
    textarea.value = view.state.doc.toString()
  })
  return view
}
```

### 3.2 Optionen → Extensions

In CM5 waren Optionen Flags; in CM6 ist jede eine Extension. `editor/extensions.ts`
übersetzt:

| easyMDE-Option | CM6-Extension |
|---|---|
| `lineWrapping` | `EditorView.lineWrapping` |
| `lineNumbers` | `lineNumbers()` (`@codemirror/view`) |
| `tabSize` / `indentUnit` | `EditorState.tabSize` / `indentUnit.of()` |
| `theme: 'easymde'` | eigenes `EditorView.theme` |
| `placeholder` | `placeholder()` (`@codemirror/view`) |
| `autofocus` | `EditorView`-Konstruktor-Option |
| `direction` (RTL) | `contentAttributes` / theme |
| `spellcheck` (nativ) | `contentAttributes: {spellcheck}` |
| Shortcuts | `keymap.of([...])` |

### 3.3 Stream-Mode-Markdown → Lezer

CM5 nutzte den GFM-Stream-Mode. CM6 nutzt `@codemirror/lang-markdown`
(Lezer-basiert) + `syntaxHighlighting`. Robuster (echter Syntaxbaum), aber
optisch anders → CSS wird neu geschrieben (durch "CSS/DOM darf sich ändern"
abgedeckt).

### 3.4 Overlay-Mode entfällt

Kein CM6-Äquivalent. Spellchecker kommt später als Decoration-basiertes Modul
(Backlog). `parsingConfig`/`overlayMode`-Optionen bleiben in der API akzeptiert,
sind im Kern aber No-ops mit Deprecation-Hinweis (bzw. wirken nur auf den Preview).

### 3.5 Zustands-Wechsel

Statt `getValue()`/`setValue()` → `view.state.doc` und Transaktionen
(`view.dispatch({changes})`). easyMDE-Methoden werden dünne Wrapper darüber.
`this.codemirror` ist nun eine CM6-`EditorView`, **nicht** das CM5-Objekt →
Code, der direkt CM5-Methoden auf `editor.codemirror` aufrief, ist die bewusste
Grenze des Drop-in.

### 3.6 "Quasi-WYSIWYG" (In-Editor-Formatierung)

easyMDE ist **kein** echtes WYSIWYG: Der Markdown-Quelltext bleibt sichtbar
(inkl. `**`, `#` …), wird aber per CSS live formatiert. In CM5 vergab der
Stream-Mode CSS-Klassen (`cm-strong` …), die easyMDEs CSS stylte.

**In CM6** (hängt an 3.3): Lezer parst den Syntaxbaum, `syntaxHighlighting` +
ein **eigener `HighlightStyle`** (`editor/highlight.ts`) weisen den Syntax-Knoten
(heading, strong, emphasis, link …) Styling zu, das easyMDEs Erscheinungsbild
nachbildet. Ergebnis: gleicher "lebende Formatierung im Quelltext"-Effekt auf dem
robusteren Parser.

**Scope-Entscheidung: easyMDE-Parität.** Markup bleibt sichtbar; **kein**
Ausblenden von Markup im Kern. (Betrifft NICHT 3.1 `fromTextArea`, sondern 3.3/3.6.)

**Backlog (optional, nicht eingeplant):** Decoration-basiertes Ausblenden/Ersetzen
von Markup (echter WYSIWYG-Effekt, Markup nur am Cursor sichtbar) — geht über
easyMDE hinaus.

---

## 4. Toolbar-Aktionen als CM6-Commands

Größter Volumen-Block (~30 Aktionen). Zielbild — jede Aktion ist ein reiner Command:

```typescript
type SupaCommand = (view: EditorView) => boolean
```

Commands lesen `view.state` (Selektion, Doc, **Lezer-Syntaxbaum** via
`syntaxTree(state)`) und dispatchen eine Transaktion. Kein `editor`-Objekt, kein
verstecktes `getState`-Konstrukt.

**Gruppierung** (= `commands/`-Module):

| Modul | Aktionen |
|---|---|
| `inline.ts` | bold, italic, strikethrough, inline-code |
| `block.ts` | heading (smaller/bigger/1–6), quote, code-block, horizontal-rule, clean-block |
| `list.ts` | unordered-list, ordered-list, check-list |
| `link-image.ts` | link, image, upload-image |
| `table.ts` | table |
| `history.ts` | undo, redo (über `@codemirror/commands`) |

**Kniffligkeiten:**
- **Toggle-Logik** (fett an→aus): über Baum-Abfrage umschließender Knoten
  (`StrongEmphasis` etc.) statt String-Matching von `**` — robuster als easyMDE.
- **Listen-Fortsetzung** (Enter setzt `- ` fort): eigene kleine Extension/Command
  in `list.ts` (ersetzt das CM5-`continuelist`-Addon).
- **Prompts** (Link/Bild-URL): reine DOM-Logik über `prompt()` bzw.
  `promptURLs`/`promptTexts`-Optionen, unabhängig von CM.

**Testbarkeit:** Jeder Command ist reine Funktion über `EditorView`. In Vitest:
headless `EditorView` bauen, Doc+Selektion setzen, Command rufen, `state.doc`
prüfen. Echte Unit-Tests für Aktions-Logik (fehlt easyMDE komplett).

**Toolbar-Konfiguration bleibt API-kompatibel:** `toolbar`-Option (Strings/Objekte,
Built-ins, Custom-Buttons mit `name`/`action`/`className`/`title`) unverändert. Nur
die interne Verdrahtung Button→Command ist neu.

---

## 5. UI-Schicht

Größtenteils DOM-Arbeit, relativ CM-unabhängig — easyMDE-Logik wird portiert und
modernisiert (TS, kleine Module, keine `var`/`prototype`).

**Toolbar** (`ui/toolbar.ts`): Button-/Dropdown-/Separator-Rendering, Tooltips mit
Shortcut-Anzeige. **Aktiv-Zustand** der Buttons via `EditorView.updateListener`
(statt CM5-`cursorActivity`), der bei Selektionsänderung den Syntaxbaum abfragt.
FontAwesome-Icon-Klassen bleiben (Teil der API).

**Preview & SideBySide** (`ui/preview.ts`): `togglePreview` (Panel mit
`markdown(text)`), `toggleSideBySide` (nebeneinander + **Scroll-Sync** via
`scrollDOM` + `updateListener`). Live-Update via `updateListener`. Render über
`markdown/parse.ts` (marked).

**Fullscreen** (`ui/fullscreen.ts`): reines CSS-Toggle (Wrapper-Klasse, `z-index`,
Viewport-Größe) — ersetzt das CM5-`fullscreen`-Addon.

**Statusbar** (`ui/statusbar.ts`): konfigurierbare Items (`autosave`, `lines`,
`words`, `cursor`, Custom mit `onUpdate`/`onActivity`), Update via `updateListener`.
`updateStatusBar(itemName, content)` bleibt öffentlich.

**Roter Faden:** Alle CM5-Events (`cursorActivity`, `scroll`, `change`, `update`)
werden durch **einen** `EditorView.updateListener` ersetzt, der `docChanged` /
`selectionSet` / `viewportChanged` unterscheidet. Entkoppelt UI ↔ Editor, an einer
Stelle testbar.

---

## 6. Features, Datenfluss & öffentliche Fassade

### 6.1 Features (`features/`)

- **Autosave** (`autosave.ts`): localStorage mit `uniqueId`, Intervall,
  Zeitstempel-Anzeige. `autosave`-Option + `clearAutosavedValue()` API-kompatibel.
  Debounced an `updateListener`.
- **Bild-Upload** (`image-upload.ts`): `uploadImage(s)`, `imageUploadFunction`,
  Drag&Drop, Paste — über `EditorView.domEventHandlers({drop, paste})` statt
  CM5-Events. Einfügen nutzt `commands/link-image.ts`.
- **Wortzählung** (`word-count.ts`): reine Funktion `wordCount(text)`.

### 6.2 Datenfluss

```
Benutzer tippt / klickt Button / Shortcut
        │
        ▼
CM6-Command  ──dispatch(transaction)──►  EditorState (neuer Doc-Zustand)
        │                                        │
        │                                        ▼
        │                                 EditorView rendert + HighlightStyle
        │                                        │
        └──────────────►  updateListener  ◄──────┘
                                 │
             ┌───────────────────┼────────────────────┐
             ▼                   ▼                    ▼
      Toolbar-Aktiv-        Statusbar            Preview / SideBySide
      Zustand aktual.    (words/cursor…)         (marked-Render)
                                 │
                                 ▼
                          Autosave (debounced → localStorage)
                                 │
                          forceSync → Textarea (bei Form-Submit)
```

**Ein Mechanismus** (`updateListener`) speist alle reaktiven Teile — die zentrale
Vereinfachung gegenüber easyMDEs verstreuten CM5-Handlern.

### 6.3 Öffentliche Fassade (`index.ts`)

| API-Methode | Delegiert an |
|---|---|
| `value()` / `value(val)` | `view.state.doc` / `dispatch(changes)` |
| `toTextArea()` | `editor/setup.ts` |
| `cleanup()` | statische Aufräum-Logik |
| `togglePreview()`, `toggleSideBySide()`, `toggleFullScreen()` | `ui/*` |
| `isPreviewActive()`, `isSideBySideActive()`, `isFullscreenActive()` | Zustands-Flags |
| `markdown(text)` | `markdown/parse.ts` |
| `updateStatusBar(...)` | `ui/statusbar.ts` |
| `clearAutosavedValue()` | `features/autosave.ts` |
| `uploadImage(s)`, `uploadImagesUsingCustomFunction` | `features/image-upload.ts` |

Statische easyMDE-Methoden (`EasyMDE.toggleBold` etc.) werden als Klassen-Statics
gespiegelt.

**Öffentliche Typen:** `.d.ts` wird aus dem TS-Code **generiert** (nicht
handgepflegt). `Options` bleibt strukturell kompatibel; entfallene/veränderte
Optionen (Overlay-Interna) werden `@deprecated` statt entfernt.

---

## 7. Tooling & Teststrategie

**Tooling:**
- **Vite** (Library-Mode) → ESM- + UMD-Build (`<script>` *und* `import`), CSS mitgebaut.
- **Vitest** (jsdom-Umgebung; CM6 läuft headless).
- **Cypress** bleibt für E2E; bestehende Tests als Verhaltens-Referenz (angepasst
  an neue CSS/DOM-Klassen).
- **TypeScript** strict, **ESLint** (flat config) + Prettier. Gulp/Browserify entfallen.

**Teststrategie (drei Ebenen):**
1. **Unit (Vitest):** Commands (headless `EditorView`), reine Utilities
   (`wordCount`, Text-Helfer, Sanitize). Das neue Sicherheitsnetz.
2. **Komponenten (Vitest+jsdom):** Toolbar-Rendering, Statusbar-Update, Preview.
3. **E2E (Cypress):** Ende-zu-Ende im echten Browser (portierte easyMDE-Tests).

---

## 8. Meilenstein-Fahrplan

Jeder Meilenstein ist lauffähig und testbar. **M0–M2 = Priorität.**

- **M0 — Gerüst:** Vite/Vitest/TS/ESLint-Setup, leere `SupaMDE`-Klasse, CI-fähiger
  Testlauf. Ergebnis: `npm run build` + `npm test` grün.
- **M1 — Editor-Kern:** `fromTextArea`-Äquivalent, Optionen→Extensions,
  Lezer-Markdown + `HighlightStyle` (easyMDE-Parität), `value()`/`toTextArea()`.
  Ergebnis: sichtbarer, formatierender Editor im `example/`.
- **M2 — Aktionen:** alle `commands/` + Shortcuts + Undo/Redo, unit-getestet.
  Ergebnis: Text-Formatierung funktioniert.
- **M3 — Toolbar & Statusbar:** Toolbar-DOM, Aktiv-Zustände, Statusbar.
- **M4 — Preview/SideBySide/Fullscreen:** marked-Preview, Scroll-Sync, Fullscreen.
- **M5 — Features:** Autosave, Bild-Upload (Drag&Drop/Paste), Wortzählung.
- **M6 — Politur & Kompatibilität:** generierte `.d.ts`, Cypress-E2E portiert,
  Deprecation-Hinweise, README/Doku, `EasyMDE`-Alias-Entscheidung.

**Backlog (optional, nicht eingeplant):**
- Decoration-basiertes Markup-Ausblenden (echter WYSIWYG).
- Spellchecker-Neuimplementierung (Decoration statt Overlay-Mode).

---

## 9. Bewusste Grenzen (YAGNI / Scope)

- Kein garantierter Zugriff auf das interne CM-Objekt (nur öffentliche SupaMDE-API).
- Spellchecker & echtes WYSIWYG bewusst aus dem Kern ausgeklammert.
- CSS/DOM-Klassen dürfen sich ändern (CM6-bedingt).
- Markdown-Rendering bleibt bei `marked` (kein Wechsel der Preview-Lib).

# SupaMDE M4 — LaTeX-Live-Vorschau (Side-by-Side) & Fullscreen

**Datum:** 2026-07-25
**Status:** Freigegeben (Design)
**Meilenstein:** M4
**Ausgangsbasis:** M0–M3 abgeschlossen (Editor-Kern, Commands, Toolbar, Statusbar,
zentraler `updateListener`).

---

## 1. Ziel & Abgrenzung

M4 liefert eine **Live-Vorschau für Markdown mit LaTeX-Formeln** und einen
**Fullscreen-Modus**.

**Konkreter Nutzer-Workflow (leitend):** LaTeX-Markdown schreiben und das
gerenderte Ergebnis **neben** dem Quelltext sehen. Formeln in drei Formen:

- **Inline** `$…$` mitten im Text
- **Block** `$$…$$` abgesetzt/zentriert
- **AMS-Umgebungen** (`\begin{align}` etc.) **immer innerhalb** `$$…$$`

**Wichtige Kurskorrektur gegenüber dem Ursprungs-Design-Dok (2026-07-17):**
M4 ist **nicht** an easyMDE-Options-Parität ausgerichtet. Es geht um die
LaTeX-Live-Vorschau für den beschriebenen Workflow. easyMDE-Optionen werden nur
übernommen, soweit sie diesem Ziel dienen; der Rest ist bewusst Backlog (§8).

### In Scope

- **Side-by-Side-Layout (A):** Editor links, Live-Vorschau rechts, gleichzeitig
  sichtbar, bidirektionaler Scroll-Sync.
- **Fullscreen:** SupaMDE-Container übernimmt den Viewport (CSS-Toggle),
  **unabhängig** von Side-by-Side kombinierbar.
- **Renderer:** Markdown (marked) + LaTeX (KaTeX) über eine marked-Extension.
- **KaTeX als optionale Peer-Dependency** mit graceful degradation.

### Nicht in Scope (Backlog / YAGNI, siehe §8)

- **B-Umschalt-Layout** (Editor *oder* Vorschau, Fläche getauscht) — der
  Workflow will das Ergebnis *neben*, nicht *statt* dem Quelltext.
- **Inline-WYSIWYG (C)** — Formeln im Editor selbst rendern (eigene
  CM6-Decorations). Großes, eigenes Thema → **Folge-Meilenstein**, vorgemerkt in §8.2.
- **Preview-Code-Syntax-Highlighting** (`codeSyntaxHighlighting`/`hljs`-Äquivalent)
  → **Folge-Meilenstein**, vorgemerkt in §8.2.
- Weitere easyMDE-Rendering-Optionen jenseits des Kern-Sets: `maxHeight`,
  `sideBySideFullscreen`-Zwangskopplung, `sanitizerFunction`.
- DOMPurify / umfangreiches HTML-Sanitizing im Kern.

---

## 2. Modulstruktur

Neue Module, dem etablierten Muster folgend (kleine, fokussierte Einheiten mit je
einem Zweck, einzeln testbar):

```
src/
  markdown/
    parse.ts         → markdownToHtml(text, opts): Markdown (marked) + KaTeX → HTML-String
    katex-marked.ts  → marked-Extensions (block $$…$$ + inline $…$), lädt KaTeX defensiv
    sanitize.ts      → addAnchorTargetBlank (minimal)
  ui/
    preview.ts       → Side-by-Side-Panel: DOM, Live-Update, Scroll-Sync, an-/abbauen
    fullscreen.ts    → reines CSS-Toggle des SupaMDE-Containers (Viewport)
    preview.css      → Panel-Layout (Flexbox), Formel-Feinschliff
    fullscreen.css   → Fullscreen-Klasse (position:fixed, z-index)
```

**Grenzen der Einheiten:**

| Modul | Kennt | Kennt NICHT | Testbar |
|---|---|---|---|
| `markdown/parse.ts` | nur Strings | Editor, DOM-Panel | ohne jsdom (reine Funktion) |
| `markdown/katex-marked.ts` | marked, KaTeX (optional) | Editor, Panel | isoliert (Formel rein, HTML raus) |
| `ui/preview.ts` | `EditorView`, Panel-DOM, `parse.ts` | Toolbar | jsdom |
| `ui/fullscreen.ts` | Container-`HTMLElement` | Editor, Panel, Rendering | jsdom |

`index.ts` bleibt dünne Fassade: steckt die Module zusammen, keine Logik im
Konstruktor außer Verdrahtung.

---

## 3. Renderer (Markdown + KaTeX)

### 3.1 `markdown/parse.ts`

```typescript
interface RenderOptions {
  singleLineBreaks?: boolean;                 // marked `breaks`, Default true
  previewRender?: (text: string) => string;   // ersetzt den eingebauten Renderer komplett
}

function markdownToHtml(text: string, opts?: RenderOptions): string;
```

- Ist `previewRender` gesetzt, wird **ausschließlich** diese Funktion genutzt
  (Fluchtluke für eigenes Rendering / andere Lib / Server-Roundtrip).
- Sonst: marked (mit `breaks` = `singleLineBreaks ?? true`) + die KaTeX-Extensions
  aus `katex-marked.ts`, danach `addAnchorTargetBlank`.
- Dies ist zugleich die Implementierung der öffentlichen `markdown(text)`-Methode
  der Fassade — **eine Quelle der Wahrheit**.

### 3.2 `markdown/katex-marked.ts` — die zwei marked-Extensions

Umsetzung über marked's Custom-Extensions-API (`marked.use({ extensions: [...] })`),
jede mit `name`, `level`, `start(src)`, `tokenizer(src)` (mit `^`-Anker) und
`renderer(token)`.

- **Block-Extension** `level: 'block'`: erkennt `$$…$$` (mehrzeilig,
  `\begin{align}`-Umgebungen darin) →
  `katex.renderToString(expr, { displayMode: true, throwOnError: false })`.
- **Inline-Extension** `level: 'inline'`: erkennt `$…$` (einzeilig) →
  `katex.renderToString(expr, { displayMode: false, throwOnError: false })`.

**Inline-Abgrenzung — Kein-Leerzeichen-Regel** (wie `marked-katex-extension` &
Pandoc): Ein `$` öffnet/schließt Inline-Math nur, wenn **kein Leerzeichen**
direkt nach dem öffnenden bzw. direkt vor dem schließenden `$` steht. So bleibt
Preistext (`$5 und jenes $10`) Text, während ziffern-beginnende Formeln
(`$x_5$`, `$5x$`) korrekt gerendert werden.

### 3.3 Graceful degradation (KaTeX optional)

KaTeX wird beim Modul-Setup **einmalig defensiv** aufgelöst (kein harter
Top-Level-Import, der bei fehlendem Paket den Build/Import bricht). Ist KaTeX
**nicht verfügbar**, geben die Extension-Renderer den **Rohtext** (`$…$`
unverändert) zurück — die Vorschau zeigt dann reines Markdown ohne Formelsatz,
kein Crash.

`throwOnError: false` ist zentral: Eine **kaputte Formel** wird von KaTeX rot
dargestellt (`.katex-error`), die restliche Vorschau bleibt intakt — kein
Vorschau-Totalausfall wegen eines Tippfehlers.

### 3.4 Sanitizing (minimal)

`markdown/sanitize.ts` enthält nur `addAnchorTargetBlank` (Links im Preview mit
`target="_blank"` + `rel="noopener"`). **Kein** DOMPurify im Kern. Wer
Fremd-Input rendert, hängt eigenes Sanitizing über `previewRender` ein (bewusste
YAGNI-Grenze — der leitende Workflow ist selbst-verfasster LaTeX-MD).

---

## 4. Side-by-Side-Panel (`ui/preview.ts`)

### 4.1 API

```typescript
interface SideBySide {
  dom: HTMLElement;                   // das Vorschau-Panel
  toggle(): void;                     // an/aus
  isActive(): boolean;
  update(state: EditorState): void;   // Live-Re-Render bei Doc-Änderung
  destroy(): void;                    // Panel + Scroll-Handler entfernen
}

function createSideBySide(view: EditorView, opts: {
  previewClass?: string | string[];
  syncSideBySidePreviewScroll?: boolean;   // Default true
  render: (text: string) => string;        // aus markdown/parse.ts (mit Optionen gebunden)
}): SideBySide;
```

### 4.2 Layout (Flexbox)

Bei aktivem Side-by-Side erhält `.supamde-container` die Klasse
`supamde-sided`. Editor (`view.dom`) und Panel sind zwei Flex-Kinder zu je 50 %;
das Panel steht rechts mit eigenem `overflow-y: auto`. Aus → Klasse entfernt,
Panel `display: none`, Editor wieder voll. `previewClass` wird zusätzlich auf das
Panel gesetzt (z. B. Prose-Styles der Host-App).

### 4.3 Live-Update — am zentralen `updateListener`

**Kein neuer Editor-Listener.** Der zentrale Sink in `index.ts` (speist bereits
Toolbar + Statusbar) wird um `preview?.update(state)` erweitert. Bei aktivem
Panel und `docChanged` wird neu gerendert (`render(state.doc.toString())` →
`panel.innerHTML`); ist das Panel inaktiv, ist `update` ein No-op. Das setzt den
„ein Mechanismus speist alles"-Faden des Ursprungs-Design-Doks fort.

### 4.4 Scroll-Sync (bidirektional, ratio-basiert)

Bewährtes Muster mit Feedback-Guard, CM6-idiomatisch:

- **Editor → Panel:** `view.scrollDOM`-`scroll`-Event.
  `ratio = scrollTop / (scrollHeight − clientHeight)`, auf Panel anwenden.
- **Panel → Editor:** `panel`-`scroll`-Event, umgekehrt.
- **Guard gegen Endlosschleife:** ein `syncingFrom: 'editor' | 'preview' | null`-
  Flag markiert den reaktiv ausgelösten Sync, sodass das dadurch entstehende
  Scroll-Event des Ziels nicht zurückfeuert.
- **Abschaltbar:** `syncSideBySidePreviewScroll: false` → Sync-Handler werden
  gar nicht erst registriert.

### 4.5 Aufräumen

`destroy()` entfernt Panel + beide Scroll-Handler. Wird von `toTextArea()` (und
einem künftigen `cleanup()`) gerufen.

---

## 5. Fullscreen (`ui/fullscreen.ts`)

### 5.1 API

```typescript
interface Fullscreen {
  toggle(): void;
  isActive(): boolean;
  destroy(): void;
}

function createFullscreen(container: HTMLElement, opts?: {
  onToggleFullScreen?: (active: boolean) => void;
}): Fullscreen;
```

### 5.2 Verhalten

- Toggelt `supamde-fullscreen` auf dem `.supamde-container`.
  CSS: `position: fixed; inset: 0; z-index: …`, Container füllt den Viewport.
- **Body-Scroll-Sperre:** `document.body.style.overflow = 'hidden'` beim Aktivieren,
  ursprünglicher Wert beim Verlassen wiederhergestellt (das eine JS-Nebeneffekt-
  Stück).
- **`Escape` verlässt Fullscreen** (Keyhandler auf dem Container).
- **Unabhängig von Side-by-Side** — keine easyMDE-Zwangskopplung; beide frei
  kombinierbar (z. B. Side-by-Side im Fullscreen).
- Optionaler `onToggleFullScreen(active)`-Callback bei jedem Wechsel.
- Kennt weder Editor noch Panel — nur den Container.

---

## 6. Toolbar-Verdrahtung

### 6.1 `ToolbarAction` wird zur Union (Entscheidung 1A)

Die Aktionen Preview/SideBySide/Fullscreen sind **keine** CM6-Commands
`(view) => boolean` — sie brauchen die SupaMDE-Instanz (Panel-DOM,
Container-Klassen, Zustand). Der Action-Typ wird daher zur diskriminierten Union:

```typescript
type ToolbarAction =
  | { kind: 'command'; command: SupaCommand; query?: (s: EditorState) => boolean;
      icon: string; title: string; shortcut?: Shortcut }
  | { kind: 'view'; run: (editor: SupaMDE) => void; active?: (editor: SupaMDE) => boolean;
      icon: string; title: string; shortcut?: Shortcut };
```

- Bestehende Built-ins (bold, italic, …) bekommen `kind: 'command'` —
  mechanische Ergänzung, Verhalten unverändert.
- Neu: `'side-by-side'` und `'fullscreen'` als `kind: 'view'`.
  `run` ruft `editor.toggleSideBySide()` / `editor.toggleFullScreen()`;
  `active` liefert den Aktiv-Zustand.

### 6.2 `buildItem` verzweigt nach `kind`

In `ui/toolbar.ts`: `kind: 'command'` → `action.command(view)` (wie bisher);
`kind: 'view'` → `action.run(editor)`. Die Toolbar bekommt die SupaMDE-Instanz
bereits durchgereicht (`editor`).

### 6.3 Aktiv-Zustand

Die `update`-Schleife der Toolbar fragt für `'command'`-Buttons wie bisher
`query(state)` und für `'view'`-Buttons `active(editor)`. Beide Button-Sorten
werden getrennt registriert; `update` erhält Zugriff auf `state` **und** die
`editor`-Instanz.

### 6.4 Default-Toolbar

`side-by-side` und `fullscreen` werden in `DEFAULT_TOOLBAR` ergänzt (ein
Separator + die zwei Buttons am Ende, nach `undo`/`redo`).

---

## 7. Öffentliche API & Optionen

### 7.1 Neue Fassaden-Methoden (`index.ts`)

| Methode | delegiert an |
|---|---|
| `toggleSideBySide()` / `isSideBySideActive()` | `ui/preview.ts` |
| `toggleFullScreen()` / `isFullscreenActive()` | `ui/fullscreen.ts` |
| `markdown(text)` | `markdown/parse.ts` |

Die Namen decken zugleich die entsprechende easyMDE-API ab.

### 7.2 Neue Optionen (`options.ts`)

```typescript
previewRender?: (text: string) => string;         // Renderer-Fluchtluke
previewClass?: string | string[];                  // CSS-Klassen aufs Panel
renderingConfig?: { singleLineBreaks?: boolean };  // marked-Feintuning (schlank)
syncSideBySidePreviewScroll?: boolean;             // Default true
onToggleFullScreen?: (active: boolean) => void;
```

Diese Optionen werden **nicht** in `resolveOptions` normalisiert (das behandelt
ausschließlich die Felder, die zu CM6-Extensions werden — `lineWrapping`,
`tabSize`, …). Die Render-/Preview-Optionen werden an die zuständigen Module
durchgereicht; ihre Normalisierung (insb. der `singleLineBreaks ?? true`-Default)
lebt gebündelt in `renderOptionsFrom`/`markdownToHtml` (`markdown/parse.ts`) — die
eine Quelle der Wahrheit für die Render-Config. Zwei getrennte Normalisierungs-
Ebenen (Editor-Config in `resolveOptions` vs. Render-Config in `parse.ts`) sind
hier bewusst getrennt.

### 7.3 KaTeX als optionale Peer-Dependency

- `peerDependencies.katex` + `peerDependenciesMeta.katex.optional = true`.
- KaTeX-**CSS** (`katex.min.css`) und die zugehörigen **Fonts** werden **nicht**
  von SupaMDE gebündelt; die Host-App bindet sie ein. Das CSS referenziert die
  Fonts relativ.
- `example/index.html` bindet KaTeX-JS + `katex.min.css` ein und enthält eine
  Demo mit inline-, block- und `\begin{align}`-Formeln, damit die Live-Vorschau
  sichtbar funktioniert.

---

## 8. Bewusste Grenzen (YAGNI / Backlog)

### 8.1 Nicht in M4 (endgültig weggelassen / anders gelöst)

- **Kein B-Umschalt-Layout** (Editor *oder* Vorschau) — der Workflow will die
  Vorschau *neben* dem Quelltext.
- **Kein** `maxHeight`-Handling im Kern (in CM6 besser per Theme
  `.cm-scroller { max-height }` lösbar).
- **Keine** `sideBySideFullscreen`-Zwangskopplung — Fullscreen und Side-by-Side
  bleiben unabhängig.
- **Kein** DOMPurify / erweitertes Sanitizing im Kern (`previewRender` als
  Fluchtluke).
- **E2E-Tests (Cypress)** kommen gesammelt in M6, nicht in M4.

### 8.2 Geplante Folge-Meilensteine (nicht in M4, aber vorgemerkt)

Zwei vom Auftraggeber gewünschte Erweiterungen, bewusst **nach** M4, jeweils als
eigenständiges Vorhaben mit eigenem Brainstorming/Spec:

- **Preview-Code-Syntax-Highlighting** (kleiner Folge-Meilenstein).
  Färbung von Fenced Code Blocks **im gerenderten Preview** (` ```js `-Blöcke mit
  Sprach-Highlighting statt reinem monospace-`<pre>`).
  *Ansatz:* `highlight`-Hook an marked, gespeist von einer Highlighting-Lib
  (highlight.js oder Shiki), analog easyMDEs `codeSyntaxHighlighting`, aber als
  optionale Peer-Dependency.
  *Abgrenzung:* Betrifft **nur den Preview**. Das In-Editor-Highlighting der
  Code-Blöcke (Lezer + `HighlightStyle` aus M1) existiert bereits und bleibt
  davon unberührt.

- **Integrierte Ansicht / Inline-WYSIWYG (Layout C)** (großer eigener Meilenstein).
  Markup wird **im Editor selbst** ausgeblendet und durch die gesetzte Darstellung
  ersetzt; die Roh-Syntax (`**`, `#`, `$…$` …) erscheint nur, wenn der Cursor im
  betreffenden Abschnitt steht (Obsidian-/Typora-Stil). Kein separates Panel.
  *Ansatz:* CM6-`replace`-Decorations über den Lezer-Syntaxbaum, mit
  Cursor-in-Range-Logik zum Aussetzen der Decoration; Formeln als
  **KaTeX-Widget-Decoration direkt im Editor** (nutzt den M4-Renderer wieder).
  *Abgrenzung:* Eigenständige Mechanik, baut **nicht** auf marked/Panel auf.
  Koexistiert mit der Side-by-Side-Vorschau aus M4 (ersetzt sie nicht). Dies ist
  der „echte WYSIWYG"-Backlog-Punkt aus dem Ursprungs-Design-Dok (2026-07-17, §9).

---

## 9. Teststrategie

Drei Ebenen wie etabliert:

1. **Unit (Vitest, ohne DOM):** `markdownToHtml` — Markdown→HTML; inline-, block-
   und `\begin{align}`-Formeln → enthalten `.katex`; **Kein-Leerzeichen-Regel**
   (`$5 und $10` bleibt Text, `$x_5$` wird Formel); **KaTeX-fehlt** → Rohtext;
   **kaputte Formel** → kein Crash (rot markiert). Stil wie `word-count`-Tests.
2. **Komponenten (Vitest + jsdom):** Panel an/aus; Live-Update bei Doc-Change;
   Scroll-Sync-Guard (kein Feedback-Loop); Fullscreen-Klasse + `Escape`;
   Toolbar-`view`-Buttons lösen `run` aus und spiegeln den Aktiv-Zustand.
3. **E2E:** in M6 (portierte/erweiterte Tests im echten Browser).

---

## 10. Definition of Done (M4)

- `npm run build`, `npm test`, `npm run typecheck`, `npm run lint` alle grün/sauber.
- Im `example/` schreibt man LaTeX-Markdown und sieht rechts die **live
  gerenderte Vorschau** mit inline-, block- und `\begin{align}`-Formeln.
- **Side-by-Side** lässt sich per Toolbar-Button/API togglen, mit
  funktionierendem Scroll-Sync.
- **Fullscreen** lässt sich togglen (Button/API/`Escape`), unabhängig von
  Side-by-Side kombinierbar.
- Fehlt KaTeX, degradiert die Vorschau elegant auf reines Markdown ohne Crash.

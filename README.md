# SupaMDE

Ein moderner, einbettbarer Markdown-Editor auf Basis von **CodeMirror 6** — die
modernisierte Neufassung von [easyMDE](https://github.com/Ionaru/easy-markdown-editor).

> **Status:** In Entwicklung. Aktueller Meilenstein: **M4 — LaTeX-Live-Vorschau
> & Fullscreen** (Side-by-Side-Vorschau mit Markdown+LaTeX-Rendering, Fullscreen).
> Autosave und Bild-Upload folgen in M5.

## Installation

Aktuell (direkt aus dem Repo):

```bash
npm install git+https://github.com/svenho/SupaMDE.git
```

Später als npm-Paket:

```bash
npm install supamde
```

### Aktualisieren

Denselben Befehl erneut ausführen:

```bash
npm install git+https://github.com/svenho/SupaMDE.git
```

Die URL enthält keine feste Referenz, daher löst npm sie auf den aktuellen
HEAD des Default-Branches auf und schreibt den Commit-Hash in die
`package-lock.json`. `npm update supamde` hilft hier **nicht** — es fehlt ein
Semver-Range, an dem npm sich orientieren könnte. Falls npm einen alten Stand
aus dem Cache zieht, erzwingt `--force` den erneuten Abgleich:

```bash
npm install git+https://github.com/svenho/SupaMDE.git --force
```

**Auf einen festen Stand installieren.** Sobald Releases getaggt sind, wird
der Install reproduzierbar:

```bash
# fester Tag
npm install git+https://github.com/svenho/SupaMDE.git#v0.1.1

# Semver-Range über Tags — hier funktioniert dann auch `npm update`
npm install git+https://github.com/svenho/SupaMDE.git#semver:^0.1.0
```

Bei der `semver:`-Variante landet ein echter Range in der `package.json`, und
`npm update supamde` holt neue passende Tags automatisch.

> **Hinweis:** Das Repo hat derzeit noch **keine Tags** — die beiden Varianten
> oben greifen erst, wenn welche gepusht sind (`git tag v0.1.1 && git push --tags`).

**Was beim Git-Install passiert:** `dist/` ist nicht eingecheckt, sondern wird
bei der Installation gebaut — das `prepare`-Script stößt `npm run build` an.
npm klont dazu das Repo und installiert die Build-Abhängigkeiten (Vite,
TypeScript & Co.). Der Install dauert damit spürbar länger als bei einem
fertigen npm-Paket; der Build selbst liegt im Bereich weniger Sekunden.

> **Wichtig für Build-Abhängigkeiten:** Alles, was der Build zur Bauzeit
> auflösen muss und nicht in `build.rollupOptions.external` steht, gehört in
> `devDependencies` — auch dann, wenn es zusätzlich Peer-Dependency ist
> (Beispiel: `lucide`, dessen Icons ins Bundle wandern). npm installiert die
> Peers des Wurzelprojekts beim Git-Install nicht mit, sodass `prepare` sonst
> mit „failed to resolve import" abbricht.

### CodeMirror 6 als Peer Dependencies

SupaMDE bündelt CodeMirror 6 **nicht** mit — die CM6/Lezer-Pakete sind
Peer Dependencies und müssen im Projekt selbst installiert werden. So teilt
sich SupaMDE dieselbe CM6-Instanz wie dein übriger Code (npm dedupet über die
Version), und es entstehen keine doppelten oder inkompatiblen CM6-Kopien:

```bash
npm install \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/language @codemirror/lang-markdown \
  @lezer/common @lezer/highlight @lezer/markdown
```

Die Einbindung erfolgt über einen Bundler (Vite, esbuild, Rollup, webpack …),
der die Bare-Imports auflöst. SupaMDE wird als ESM ausgeliefert.

### KaTeX (optional, für Formeln in der Vorschau)

Die Live-Vorschau rendert LaTeX-Formeln (`$…$`, `$$…$$`, `\begin{align}` in
`$$`) über **KaTeX**. KaTeX ist eine **optionale** Peer-Dependency — ist es
nicht installiert, zeigt die Vorschau reines Markdown und lässt Formeln als
Text stehen. Zum Aktivieren:

```bash
npm install katex
```

Zusätzlich das KaTeX-CSS (inkl. Schriften) in der Host-Seite einbinden, z.B.:

```html
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">
```

## Grundnutzung

```html
<textarea id="editor"># Hallo **Welt**</textarea>
<script type="module">
  import SupaMDE from 'supamde';
  const editor = new SupaMDE({ element: document.getElementById('editor') });
</script>
```

### Styles

Toolbar, Statusbar, Vorschau-Panel und Vollbild brauchen CSS. SupaMDE setzt
diese Regeln beim ersten Konstruktor-Aufruf selbst als `<style>`-Tag in den
Head — im Normalfall ist **nichts weiter zu tun**. Das Tag trägt das Attribut
`data-supamde-styles`, hängt als erstes Kind im Head und wird pro Seite nur
einmal gesetzt (mehrere Instanzen teilen es sich).

Die Position ganz vorn im Head ist Absicht: Deine eigenen Stylesheets kommen
danach und gewinnen damit bei gleicher Spezifität — Overrides brauchen kein
`!important`.

Willst du die Styles über deine eigene Build-Pipeline laufen lassen (Purging,
Reihenfolge-Kontrolle, eigenes Theming), schalte den Auto-Inject ab und binde
das mitgelieferte Stylesheet selbst ein:

```js
import SupaMDE from 'supamde';
import 'supamde/style.css';

new SupaMDE({ element: document.getElementById('editor'), injectStyles: false });
```

Ohne eines von beidem — weder Auto-Inject noch manueller Import — erscheint der
Editor ungestylt: die Toolbar-Buttons stehen dann als nackte Icon-Reihe da.

Die Farben laufen über CSS-Variablen auf `.supamde-container`, die sich
überschreiben lassen:

| Variable                | Default   | Wirkung                       |
| ----------------------- | --------- | ----------------------------- |
| `--supamde-border`      | `#d0d0d0` | Rahmen von Container/Toolbar. |
| `--supamde-toolbar-bg`  | `#f7f7f7` | Toolbar-Hintergrund.          |
| `--supamde-btn-hover`   | `#e6e6e6` | Button-Hover.                 |
| `--supamde-btn-active`  | `#d8e6ff` | Aktiver Button.               |
| `--supamde-btn-text`    | `#333`    | Icon-/Textfarbe der Buttons.  |

## Optionen (Kern-Set, M1)

| Option         | Typ                   | Default         | Bedeutung                                   |
| -------------- | --------------------- | --------------- | -------------------------------------------- |
| `element`      | `HTMLTextAreaElement` | —               | **Pflicht.** Die zu ersetzende Textarea.      |
| `lineWrapping` | `boolean`             | `true`          | Zeilenumbruch statt horizontalem Scrollen.    |
| `placeholder`  | `string`              | —               | Platzhaltertext im leeren Editor.             |
| `autofocus`    | `boolean`             | `false`         | Fokussiert den Editor nach Erzeugung.         |
| `tabSize`      | `number`              | `2`             | Tab-Breite in Spalten.                        |
| `indentUnit`   | `number`              | `2`             | Einrücktiefe in Leerzeichen.                  |
| `initialValue` | `string`              | Textarea-Inhalt | Startwert (überschreibt Textarea).            |
| `extraKeys`    | `KeyBinding[]`        | `[]`            | Eigene CM6-Tastenkürzel; Vorrang vor Defaults. |

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

## Optionen (Preview/Fullscreen, M4)

| Option                         | Typ                               | Default | Bedeutung                                             |
| ------------------------------ | --------------------------------- | ------- | ----------------------------------------------------- |
| `previewRender`                | `(text) => string`                | —       | Ersetzt den eingebauten Markdown-Renderer komplett.   |
| `previewClass`                 | `string \| string[]`              | —       | Zusätzliche CSS-Klassen aufs Vorschau-Panel. Mehrere als Array. |
| `renderingConfig.singleLineBreaks` | `boolean`                     | `true`  | Einfacher Zeilenumbruch → `<br>`.                     |
| `syncSideBySidePreviewScroll`  | `boolean`                         | `true`  | Bidirektionaler Scroll-Sync im Side-by-Side.          |
| `onToggleFullScreen`           | `(active) => void`                | —       | Callback bei Fullscreen-Wechsel.                      |
| `injectStyles`                 | `boolean`                         | `true`  | Setzt die SupaMDE-Styles automatisch in den Head.     |

### Die Vorschau stylen

Das mitgelieferte CSS gibt für die Vorschau **nur das Layout** vor: halbe
Breite, eigenes Scrolling, Trennlinie, Innenabstand. Für den Inhalt — `h1`,
`p`, `ul`, `pre`, `table` — bringt SupaMDE bewusst **keine** Regeln mit.

Das ist Absicht: Die Vorschau soll aussehen wie dein späteres Ergebnis, nicht
wie ein Fremdkörper. Ein Editor-Paket, das ungefragt eine eigene Typografie in
deine Seite kippt, würde damit kollidieren.

Die Folge: Die Vorschau erbt die Typografie deiner Seite. Hat dein Projekt
einen CSS-Reset oder Tailwinds Preflight, sind `h1` und `ul` dort plattgemacht
— die Vorschau wirkt dann unformatiert, obwohl der Editor korrekt aussieht.
Dagegen hilft einer der folgenden drei Wege.

#### Weg 1 — vorhandene Typografie-Klasse anhängen (empfohlen)

`previewClass` hängt beliebige Klassen ans Vorschau-Panel. Nutze die Klasse,
mit der dein Projekt gerenderte Inhalte ohnehin darstellt — dann zeigt die
Vorschau exakt das spätere Ergebnis:

```js
new SupaMDE({
  element: document.getElementById('editor'),
  // Tailwind + @tailwindcss/typography
  previewClass: ['prose', 'max-w-none'],
});
```

> **Mehrere Klassen als Array übergeben, nicht als ein String mit
> Leerzeichen.** `previewClass: 'prose max-w-none'` wirft einen
> `InvalidCharacterError` und verhindert, dass der Editor startet — die Klassen
> gehen an `classList.add()`, das keine Leerzeichen im einzelnen Token erlaubt.
> Eine einzelne Klasse als String ist dagegen in Ordnung.

`max-w-none` ist bei `prose` sinnvoll, weil die Klasse sonst auf etwa 65
Zeichen begrenzt und in der halben Editorbreite unnötig schmal wirkt. Im
Dark Mode zusätzlich `dark:prose-invert`.

Ohne Tailwind funktioniert dasselbe mit deiner eigenen Content-Klasse:
`previewClass: 'content'`.

#### Weg 2 — eigenes Stylesheet gegen `.supamde-preview-side`

Hat dein Projekt kein Typografie-System, style die **Kinder** des Panels. Die
Panel-Klasse selbst nicht neu definieren — sie trägt das Layout:

```css
/* Erste Überschrift nicht nach unten schieben */
.supamde-preview-side > :first-child { margin-top: 0; }

.supamde-preview-side h1 { font-size: 1.75em; margin: 0.6em 0 0.4em; }
.supamde-preview-side h2 { font-size: 1.4em; margin: 0.6em 0 0.4em; }
.supamde-preview-side p  { margin: 0 0 1em; line-height: 1.6; }
.supamde-preview-side ul,
.supamde-preview-side ol { padding-left: 1.5em; margin: 0 0 1em; }
.supamde-preview-side blockquote {
  margin: 0 0 1em;
  padding-left: 1em;
  border-left: 3px solid var(--supamde-border, #d0d0d0);
  color: #555;
}

/* overflow-x verhindert, dass ein langer Code-Block das 50/50-Layout sprengt */
.supamde-preview-side pre {
  background: #f6f8fa;
  padding: 0.75em 1em;
  border-radius: 4px;
  overflow-x: auto;
}
.supamde-preview-side :not(pre) > code {
  background: #f6f8fa;
  padding: 0.15em 0.35em;
  border-radius: 3px;
}

.supamde-preview-side table { border-collapse: collapse; margin: 0 0 1em; }
.supamde-preview-side th,
.supamde-preview-side td { border: 1px solid var(--supamde-border, #d0d0d0); padding: 0.3em 0.6em; }

/* Bilder nicht über die Panel-Breite hinauslaufen lassen */
.supamde-preview-side img { max-width: 100%; height: auto; }

/* Checklisten: marked erzeugt <input type="checkbox"> im <li> */
.supamde-preview-side li:has(input[type='checkbox']) { list-style: none; }
```

Dieses Stylesheet bindest du ganz normal in deiner Seite ein. Es gewinnt ohne
`!important`, weil die SupaMDE-Styles als erstes Kind im Head sitzen (siehe
[Styles](#styles)).

#### Weg 3 — Renderer ersetzen

Brauchst du eigenes Markup (andere Klassen, Syntax-Highlighting, eigener
Sanitizer), ersetzt `previewRender` den eingebauten Renderer vollständig:

```js
new SupaMDE({
  element: document.getElementById('editor'),
  previewRender: (text) => meinRenderer(text),   // liefert fertiges HTML
});
```

Der Rückgabewert wird als HTML ins Panel geschrieben — Escaping und
Sanitisierung liegen dann bei dir.

#### Welches HTML entsteht

Zum Schreiben eigener Regeln — der eingebaute Renderer (`marked`) erzeugt
gewöhnliches HTML ohne eigene Klassen:

| Markdown        | HTML                                                      |
| --------------- | --------------------------------------------------------- |
| Überschriften   | `<h1>` … `<h6>`                                            |
| Absatz          | `<p>`                                                      |
| Listen          | `<ul>` / `<ol>` mit `<li>`                                 |
| Checkliste      | `<li>` mit `<input type="checkbox" disabled>`              |
| Zitat           | `<blockquote>`                                             |
| Code-Block      | `<pre><code class="language-js">`                          |
| Inline-Code     | `<code>`                                                   |
| Tabelle         | `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`            |
| Link            | `<a target="_blank" rel="noopener noreferrer">`            |
| Trennlinie      | `<hr>`                                                     |
| LaTeX (KaTeX)   | `<span class="katex">` bzw. `.katex-display` bei `$$…$$`   |

Zwei Punkte, die dabei leicht überraschen:

- **Tabellen brauchen `renderingConfig.singleLineBreaks: false`.** Im Default
  wird jeder einfache Zeilenumbruch zu `<br>`, wodurch die Zeilen einer
  Markdown-Tabelle als einzelne Absätze statt als `<table>` ankommen.
- **LaTeX-Formeln brauchen zusätzlich das KaTeX-CSS** in der Host-Seite (siehe
  [KaTeX](#katex-optional-für-formeln-in-der-vorschau)). Ohne dieses Stylesheet
  bleibt die Formel unformatiert, auch wenn KaTeX installiert ist.

## Editor-Modus (Live-Vorschau)

SupaMDE kennt zwei Darstellungsmodi:

| Modus | Verhalten |
|---|---|
| `'source'` (Default) | Das Markdown-Markup bleibt sichtbar und wird live formatiert. |
| `'live'` | Das Markup wird ausgeblendet und erscheint nur dort, wo der Cursor steht (Obsidian-Stil). |

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  editorMode: 'live',
});
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `editorMode` | `'source' \| 'live'` | `'source'` | Darstellungsmodus beim Start. |

**Zur Laufzeit umschalten:**

| Methode | Beschreibung |
|---|---|
| `getEditorMode()` | Liefert den aktuellen Modus. |
| `setEditorMode(mode)` | Setzt den Modus. Idempotent. |
| `toggleEditorMode()` | Wechselt zwischen beiden Modi. |

Der Wechsel erhält Dokument, Cursor, Selektion, Undo-Historie und Scrollposition.

**Was im Live-Modus ausgeblendet wird:** die Marker von Fett, Kursiv,
Durchgestrichen, Inline-Code, ATX-Überschriften (`#` … `######`) und
Blockzitaten. Fenced Code Blocks und Setext-Überschriften (Unterstreichung mit
`=`/`-`) bleiben vollständig sichtbar, ebenso Listen-Marker und Link-Syntax.

Der Text bleibt in beiden Modi editierbarer Markdown-Quelltext — kopierter Text
enthält immer das vollständige Markup.

**Toolbar-Button:** Die Aktion `'editor-mode'` ist bewusst **nicht** Teil der
Standard-Toolbar. Wer sie will, nimmt sie in die eigene `toolbar`-Liste auf:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'editor-mode'],
});
```

## API (M1)

| Methode                        | Beschreibung                                             |
| ------------------------------ | -------------------------------------------------------- |
| `value()` / `getValue()`       | Aktuellen Inhalt als String lesen.                       |
| `value(val)` / `setValue(val)` | Gesamten Inhalt ersetzen.                                |
| `updateStatusBar(name, content)` | Inhalt eines Statusbar-Items setzen (M3).              |
| `toTextArea()`                 | Editor abbauen, ursprüngliche Textarea wiederherstellen. |
| `codemirror`                   | Die zugrunde liegende CodeMirror-6-`EditorView`.         |
| `toggleSideBySide()`            | Side-by-Side-Vorschau an/aus.                            |
| `isSideBySideActive()`          | `true` wenn Side-by-Side aktiv (M4).                     |
| `toggleFullScreen()`            | Fullscreen-Modus an/aus (M4).                            |
| `isFullscreenActive()`          | `true` wenn Fullscreen aktiv (M4).                       |
| `markdown(text)`                | Text als Markdown mit KaTeX rendern (M4).                |

## Tastenkürzel (M2)

Alle Formatierungs-Aktionen sind als CodeMirror-6-Commands umgesetzt und per
Tastenkürzel erreichbar (`Mod` = `Cmd` auf macOS, `Ctrl` sonst). Seit M3 sind alle
Aktionen auch über die grafische Toolbar per Klick erreichbar.

| Kürzel                                | Aktion                                 |
| ------------------------------------- | -------------------------------------- |
| `Mod-B`                               | Fett                                   |
| `Mod-I`                               | Kursiv                                 |
| `Mod-K`                               | Link                                   |
| `Mod-H` / `Shift-Mod-H`               | Überschrift kleiner / größer           |
| `Ctrl-Alt-1` … `Ctrl-Alt-6`           | Überschrift H1 … H6                    |
| `Mod-'` / `Ctrl-Alt-Q`                | Blockzitat                             |
| `Mod-L` / `Mod-Alt-L` / `Shift-Mod-L` | Liste (`- `) / nummeriert / Checkliste |
| `Shift-Alt-Mod-L`                     | Liste mit Sternchen (`* `)             |
| `Mod-Alt-C`                           | Codeblock                              |
| `Mod-Alt-I`                           | Bild einfügen                          |
| `Mod-E`                               | Blockformat entfernen                  |
| `Mod-Z` / `Mod-Y`                     | Rückgängig / Wiederholen               |
| `Tab` / `Shift-Tab`                   | Zeile ein- / ausrücken                 |
| `F9`                                  | Side-by-Side-Vorschau an/aus (M4)      |
| `F10`                                 | Editor-Modus umschalten (Quelltext ↔ Live-Vorschau) |
| `F11` / `Mod-Shift-F`                 | Fullscreen-Modus an/aus (M4)           |

**Vollbild auf macOS:** `F11` ist dort systemweit belegt (Mission Control bzw.
„Schreibtisch einblenden“) und erreicht die Seite je nach Systemeinstellung gar
nicht. Deshalb hört der Vollbildmodus zusätzlich auf `Cmd`+`Shift`+`F` (bzw.
`Strg`+`Shift`+`F` auf Windows/Linux); der Toolbar-Button zeigt auf macOS
entsprechend `⌘⇧F` als Kürzel an.

**Links öffnen:** `Cmd`+Klick (macOS) bzw. `Strg`+Klick öffnet den Link unter dem
Zeiger in einem neuen Tab — in beiden Editor-Modi. Das funktioniert bei
Markdown-Links (`[Text](url)`), Autolinks (`<url>`) und bei nackten URLs, die
GFM automatisch erkennt (`https://…`, `http://…`, `www.…` und E-Mail-Adressen
wie `foo@example.com`). Bei `www.`-Adressen wird `https://` ergänzt, bei
E-Mail-Adressen `mailto:` — jeweils nur, wenn noch kein Schema im Text steht.
Nur `http://`-, `https://`- und (nach dieser Ergänzung) `mailto:`-URLs werden
geöffnet; `https:`/`http:` ohne die beiden Schrägstriche zählen NICHT als
gültiges Schema. Steht eine E-Mail-ähnliche Zeichenfolge als Teil einer
größeren URL im Text (z. B. der Benutzerteil in `https://admin@github.com/…`),
wird sie NICHT zu `mailto:` normalisiert. Cmd/Strg+Klick auf eine solche
Adresse öffnet dann nichts — niemals ungewollt das Mailprogramm. Hinweis zur
Parser-Grenze: GFM erkennt nackte URLs/`www.`-Adressen nur kleingeschrieben —
`HTTPS://EXAMPLE.COM` als Fließtext wird nicht erkannt (Markdown-Links und
Autolinks sind davon nicht betroffen).

Steht der Mauszeiger bei gedrücktem `Cmd`/`Strg` über einem klickbaren Link,
wird er zur Klickhand (`cursor: pointer`) — wie in VS Code.

`Enter` in einer Listenzeile setzt die Liste fort; in einer leeren Listenzeile
beendet es sie. `Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle` sind
über die Toolbar per Klick erreichbar.

`Tab` rückt die aktuelle Zeile um ein `indentUnit` ein, `Shift-Tab` wieder aus —
unabhängig davon, wo der Cursor in der Zeile steht. Bei einer Selektion gilt das
für alle berührten Zeilen. So werden Listen verschachtelt: aus `- Punkt` wird
`  - Punkt`.

> **Hinweis (Barrierefreiheit):** `Tab` wird vom Editor ausnahmslos abgefangen
> und verlässt ihn nicht. Wer den Editor per Tastatur verlassen will, muss
> derzeit auf andere Navigation ausweichen.

> **Hinweis (deutsche Mac-Tastatur):** `Mod-'` (Blockzitat) liegt hier auf
> `Cmd+Shift+#` und wird je nach Browser nicht zuverlässig erkannt. Nutze
> stattdessen das layout-unabhängige `Ctrl-Alt-Q`.

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

## Formatierung anpassen

Der Editor formatiert den Markdown-Quelltext live (easyMDE-„Quasi-WYSIWYG":
die Zeichen bleiben sichtbar, werden aber gestylt). Die Darstellung ist
**tag-basiert**: Der Lezer-Parser vergibt jedem Element ein Syntax-Tag
(`heading1`, `strong`, `emphasis`, `link` …), und ein `HighlightStyle` weist
jedem Tag CSS-Eigenschaften zu. Die Regeln stehen in
[`src/editor/highlight.ts`](src/editor/highlight.ts), die Farbwerte zentral in
[`src/editor/tokens.ts`](src/editor/tokens.ts).

Eine Highlight-Regel ist ein Objekt aus CSS-Eigenschaften (camelCase):

```typescript
{ tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' }
```

**Beispiel: alle Überschriften der zweiten Ebene (`## …`) rot.** Zuerst den
Farbwert in `tokens.ts` ergänzen (eine Quelle für alle Farben):

```typescript
export const colors = {
  quote: '#6a737d',
  link: '#0366d6',
  border: '#ddd',
  heading2: '#d73a49', // neu
} as const;
```

Dann in `highlight.ts` die `heading2`-Regel um `color` erweitern:

```typescript
{ tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold', color: colors.heading2 },
```

Nach `npm run build` (bzw. im laufenden `npm run dev`) wird jede `## `-Zeile rot
dargestellt. Analog lassen sich alle anderen Tags anpassen — z. B. `t.strong`
(Fettdruck), `t.emphasis` (kursiv) oder `t.link`.

> **Tag-basiert, nicht positionsabhängig:** `t.heading2` trifft **jede**
> Überschrift der zweiten Ebene, nicht „die zweite Überschrift im Dokument".
> Eine positionsabhängige Formatierung (z. B. nur die zweite Überschrift
> unabhängig vom Level) wäre keine Highlight-Regel, sondern bräuchte eine
> eigene CodeMirror-Decoration.

## Entwicklung

```bash
npm install
npm run dev        # Vite-Dev-Server (example/)
npm run test:run   # Vitest (einmalig)
npm run build      # Library-Build (ESM-only) + Typdeklarationen
npm run lint       # ESLint
npm run typecheck  # TypeScript ohne Emit
```

## Lizenz

MIT © Sven Deginther

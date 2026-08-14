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
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css" />
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

Farben, Rahmenbreiten und Radius laufen über CSS-Variablen auf
`.supamde-container`, die sich überschreiben lassen.

Jede Linie ist einzeln steuerbar; einen Sammelschalter über alle Linien hinweg
gibt es bewusst nicht. `--supamde-border-width` wirkt nur auf den Außenrahmen —
die Trennlinien im Inneren bleiben davon unberührt.

| Variable                            | Default                  | Wirkung                                      |
| ----------------------------------- | ------------------------ | -------------------------------------------- |
| `--supamde-border-color`            | `#d0d0d0`                | Farbe aller Rahmen und Trennlinien.          |
| `--supamde-border-width`            | `1px`                    | Außenrahmen, alle vier Kanten.               |
| `--supamde-border-top-width`        | `--supamde-border-width` | Außenrahmen nur oben.                        |
| `--supamde-border-right-width`      | `--supamde-border-width` | Außenrahmen nur rechts.                      |
| `--supamde-border-bottom-width`     | `--supamde-border-width` | Außenrahmen nur unten.                       |
| `--supamde-border-left-width`       | `--supamde-border-width` | Außenrahmen nur links.                       |
| `--supamde-radius`                  | `4px`                    | Eckenradius des Containers.                  |
| `--supamde-divider-toolbar-width`   | `1px`                    | Trennlinie Toolbar ↔ Inhalt.                 |
| `--supamde-divider-statusbar-width` | `1px`                    | Trennlinie Inhalt ↔ Statusleiste.            |
| `--supamde-divider-preview-width`   | `1px`                    | Trennlinie Editor ↔ Vorschau (Side-by-Side). |
| `--supamde-toolbar-bg`              | `#f7f7f7`                | Toolbar-Hintergrund.                         |
| `--supamde-statusbar-bg`            | `#f7f7f7`                | Hintergrund der Statusleiste.                |
| `--supamde-btn-hover`               | `#e6e6e6`                | Button-Hover.                                |
| `--supamde-btn-active`              | `#d8e6ff`                | Aktiver Button.                              |
| `--supamde-btn-text`                | `#333`                   | Icon-/Textfarbe der Buttons.                 |

**Nur den Außenrahmen abschalten**, Trennlinien innen behalten:

```css
.supamde-container {
  --supamde-border-width: 0;
  --supamde-radius: 0;
}
```

**Komplett randlos** — jede Linie einzeln aus:

```css
.supamde-container {
  --supamde-border-width: 0;
  --supamde-radius: 0;
  --supamde-divider-toolbar-width: 0;
  --supamde-divider-statusbar-width: 0;
  --supamde-divider-preview-width: 0;
}
```

**Einzelne Kanten** — z. B. bündig in einer Spalte, nur oben und unten eine Linie:

```css
.supamde-container {
  --supamde-border-left-width: 0;
  --supamde-border-right-width: 0;
  --supamde-radius: 0;
}
```

> Zeigt dein Editor trotzdem noch einen Rahmen, stammt er aus dem Host-Projekt:
> SupaMDE setzt auf `.cm-editor` selbst keinen Rahmen. Häufige Quellen sind
> globale Resets oder Framework-Regeln (z. B. Bootstraps `.form-control`).

> **Breaking Change:** Die Farbvariable hieß früher `--supamde-border`. Der Name
> gab vor, ein `border`-Shorthand zu sein, nahm aber nur eine Farbe entgegen —
> daher jetzt `--supamde-border-color`. Der alte Name wirkt nicht mehr.

## Optionen (Kern-Set, M1)

| Option         | Typ                   | Default         | Bedeutung                                               |
| -------------- | --------------------- | --------------- | ------------------------------------------------------- |
| `element`      | `HTMLTextAreaElement` | —               | **Pflicht.** Die zu ersetzende Textarea.                |
| `lineWrapping` | `boolean`             | `true`          | Zeilenumbruch statt horizontalem Scrollen.              |
| `placeholder`  | `string`              | —               | Platzhaltertext im leeren Editor.                       |
| `autofocus`    | `boolean`             | `false`         | Fokussiert den Editor nach Erzeugung.                   |
| `tabSize`      | `number`              | `2`             | Tab-Breite in Spalten.                                  |
| `indentUnit`   | `number`              | `2`             | Einrücktiefe in Leerzeichen.                            |
| `initialValue` | `string`              | Textarea-Inhalt | Startwert (überschreibt Textarea).                      |
| `extraKeys`    | `KeyBinding[]`        | `[]`            | Eigene CM6-Tastenkürzel; Vorrang vor Defaults.          |
| `autosave`     | `AutosaveOptions`     | —               | Autosave, siehe [Autosave (M5)](#autosave-m5).          |
| `uploadImage`  | `UploadImageOptions`  | —               | Bild-Upload, siehe [Bild-Upload (M5)](#bild-upload-m5). |

## Toolbar & Statusbar (M3)

| Option    | Typ                                          | Default                        | Bedeutung                                 |
| --------- | -------------------------------------------- | ------------------------------ | ----------------------------------------- |
| `toolbar` | `false \| Array<string \| CustomButton>`     | Default-Toolbar                | Toolbar-Aufbau. `false` blendet sie aus.  |
| `status`  | `false \| Array<string \| CustomStatusItem>` | `['lines', 'words', 'cursor']` | Statusbar-Items. `false` blendet sie aus. |

**Built-in-Toolbar-Buttons:** `bold`, `italic`, `strikethrough`, `code`,
`heading-smaller`, `heading-bigger`, `heading-1`…`heading-6`, `quote`, `code-block`,
`horizontal-rule`, `clean-block`, `unordered-list`, `ordered-list`, `check-list`,
`link`, `image`, `table`, `undo`, `redo`, `preview-fullscreen`, `side-by-side`,
`fullscreen`, `editor-mode`, `upload-image` (nur bei aktiviertem Bild-Upload
sinnvoll; nicht im Default). `'|'` fügt einen Separator ein.

**Ansichts-Buttons:** `preview-fullscreen` schaltet Nebeneinander-Vorschau und
Vollbild **gemeinsam** — ein Klick genügt für den Arbeitsmodus „Vorschau im
Vollbild". Der Button gilt als aktiv, wenn beide Modi laufen; aus einem
Teilzustand heraus (nur Vorschau oder nur Vollbild) schaltet ein Klick beides
ein. Er ist Teil der Default-Toolbar. Die Einzel-Buttons `side-by-side` und
`fullscreen` bleiben verfügbar, sind aber **nicht** mehr im Default — wer sie
weiterhin einzeln möchte, nimmt sie explizit in die `toolbar`-Option auf:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'side-by-side', 'fullscreen'],
});
```

**Custom-Buttons** behalten die easyMDE-Signatur:

```js
{
  name: 'shout',
  title: 'In Großbuchstaben',
  className: 'fa fa-bullhorn',       // optionale eigene Icon-Klasse
  action: (editor) => editor.setValue(editor.getValue().toUpperCase()),
}
```

**Statusbar-Items:** `lines`, `words`, `cursor`, `autosave`, `upload-image`.
`autosave` und `upload-image` sind **nicht** Teil von `DEFAULT_STATUS` — wer sie
will, nimmt sie in die `status`-Option auf (siehe [Autosave](#autosave-m5) und
[Bild-Upload](#bild-upload-m5)). Custom-Items via
`{ className, defaultValue, onUpdate, onActivity }`.

**Icons:** Die Built-in-Buttons nutzen gebündelte
[Lucide](https://lucide.dev)-SVG-Icons — es muss **kein** Icon-Font eingebunden
werden. Custom-Buttons können über `className` weiterhin eigene Icon-Fonts
(z. B. FontAwesome) verwenden.

## Optionen (Preview/Fullscreen, M4)

| Option                             | Typ                  | Default | Bedeutung                                                       |
| ---------------------------------- | -------------------- | ------- | --------------------------------------------------------------- |
| `previewRender`                    | `(text) => string`   | —       | Ersetzt den eingebauten Markdown-Renderer komplett.             |
| `previewClass`                     | `string \| string[]` | —       | Zusätzliche CSS-Klassen aufs Vorschau-Panel. Mehrere als Array. |
| `renderingConfig.singleLineBreaks` | `boolean`            | `true`  | Einfacher Zeilenumbruch → `<br>`.                               |
| `syncSideBySidePreviewScroll`      | `boolean`            | `true`  | Bidirektionaler Scroll-Sync im Side-by-Side.                    |
| `onToggleFullScreen`               | `(active) => void`   | —       | Callback bei Fullscreen-Wechsel.                                |
| `injectStyles`                     | `boolean`            | `true`  | Setzt die SupaMDE-Styles automatisch in den Head.               |

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
.supamde-preview-side > :first-child {
  margin-top: 0;
}

.supamde-preview-side h1 {
  font-size: 1.75em;
  margin: 0.6em 0 0.4em;
}
.supamde-preview-side h2 {
  font-size: 1.4em;
  margin: 0.6em 0 0.4em;
}
.supamde-preview-side p {
  margin: 0 0 1em;
  line-height: 1.6;
}
.supamde-preview-side ul,
.supamde-preview-side ol {
  padding-left: 1.5em;
  margin: 0 0 1em;
}
.supamde-preview-side blockquote {
  margin: 0 0 1em;
  padding-left: 1em;
  border-left: 3px solid var(--supamde-border-color, #d0d0d0);
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

.supamde-preview-side table {
  border-collapse: collapse;
  margin: 0 0 1em;
}
.supamde-preview-side th,
.supamde-preview-side td {
  border: 1px solid var(--supamde-border-color, #d0d0d0);
  padding: 0.3em 0.6em;
}

/* Bilder nicht über die Panel-Breite hinauslaufen lassen */
.supamde-preview-side img {
  max-width: 100%;
  height: auto;
}

/* Checklisten: marked erzeugt <input type="checkbox"> im <li> */
.supamde-preview-side li:has(input[type='checkbox']) {
  list-style: none;
}
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
  previewRender: (text) => meinRenderer(text), // liefert fertiges HTML
});
```

Der Rückgabewert wird als HTML ins Panel geschrieben — Escaping und
Sanitisierung liegen dann bei dir.

#### Welches HTML entsteht

Zum Schreiben eigener Regeln — der eingebaute Renderer (`marked`) erzeugt
gewöhnliches HTML ohne eigene Klassen:

| Markdown      | HTML                                                     |
| ------------- | -------------------------------------------------------- |
| Überschriften | `<h1>` … `<h6>`                                          |
| Absatz        | `<p>`                                                    |
| Listen        | `<ul>` / `<ol>` mit `<li>`                               |
| Checkliste    | `<li>` mit `<input type="checkbox" disabled>`            |
| Zitat         | `<blockquote>`                                           |
| Code-Block    | `<pre><code class="language-js">`                        |
| Inline-Code   | `<code>`                                                 |
| Tabelle       | `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`          |
| Link          | `<a target="_blank" rel="noopener noreferrer">`          |
| Trennlinie    | `<hr>`                                                   |
| LaTeX (KaTeX) | `<span class="katex">` bzw. `.katex-display` bei `$$…$$` |

Zwei Punkte, die dabei leicht überraschen:

- **Tabellen brauchen `renderingConfig.singleLineBreaks: false`.** Im Default
  wird jeder einfache Zeilenumbruch zu `<br>`, wodurch die Zeilen einer
  Markdown-Tabelle als einzelne Absätze statt als `<table>` ankommen.
- **LaTeX-Formeln brauchen zusätzlich das KaTeX-CSS** in der Host-Seite (siehe
  [KaTeX](#katex-optional-für-formeln-in-der-vorschau)). Ohne dieses Stylesheet
  bleibt die Formel unformatiert, auch wenn KaTeX installiert ist.

## Editor-Modus (Live-Vorschau)

SupaMDE kennt zwei Darstellungsmodi:

| Modus                | Verhalten                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `'source'` (Default) | Das Markdown-Markup bleibt sichtbar und wird live formatiert.                             |
| `'live'`             | Das Markup wird ausgeblendet und erscheint nur dort, wo der Cursor steht (Obsidian-Stil). |

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  editorMode: 'live',
});
```

| Option       | Typ                  | Default    | Beschreibung                  |
| ------------ | -------------------- | ---------- | ----------------------------- |
| `editorMode` | `'source' \| 'live'` | `'source'` | Darstellungsmodus beim Start. |

**Zur Laufzeit umschalten:**

| Methode               | Beschreibung                   |
| --------------------- | ------------------------------ |
| `getEditorMode()`     | Liefert den aktuellen Modus.   |
| `setEditorMode(mode)` | Setzt den Modus. Idempotent.   |
| `toggleEditorMode()`  | Wechselt zwischen beiden Modi. |

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

## Autosave (M5)

Autosave sichert den Inhalt in einem austauschbaren Speicher — der Entwurf
überlebt Absturz, versehentliches Schließen und Reload. Per Default **aus**.

Das Minimum sind zwei Zeilen:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'artikel-42' },
});
```

Mit Statusanzeige und Hinweis bei wiederhergestelltem Entwurf:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: {
    enabled: true,
    key: 'artikel-42',
    delay: 1000,
    onRestore: (entwurf) => {
      hinweisAnzeigen(
        `Ein ungespeicherter Entwurf wurde wiederhergestellt (${entwurf.length} Zeichen).`,
      );
    },
  },
  status: ['lines', 'words', 'cursor', 'autosave'],
});
```

| Option      | Typ                       | Default      | Beschreibung                                             |
| ----------- | ------------------------- | ------------ | -------------------------------------------------------- |
| `enabled`   | `boolean`                 | `false`      | Aktiviert Autosave.                                      |
| `key`       | `string`                  | —            | **Pflicht.** Identifiziert das Dokument im Speicher.     |
| `delay`     | `number`                  | `1000`       | Debounce nach der letzten Änderung, in ms.               |
| `storage`   | `SupaStorage`             | localStorage | Eigener Speicher (siehe unten).                          |
| `onRestore` | `(saved: string) => void` | —            | Wird gerufen, wenn beim Start ein Entwurf geladen wurde. |

**Den `key` sorgfältig wählen.** Er ist die einzige Unterscheidung zwischen zwei
Dokumenten. Zwei Editoren mit demselben `key` überschreiben sich gegenseitig —
in der Praxis also die Dokument-ID mitnehmen, nicht `'editor'`:

```js
autosave: { enabled: true, key: `artikel-${artikelId}` }
```

Im localStorage landet der Eintrag unter `supamde:<key>`.

**Wann wiederhergestellt wird.** Beim Start liest SupaMDE den gespeicherten
Stand. Ist er nicht leer **und** weicht er vom aktuellen Dokument ab, gewinnt er
gegenüber dem Inhalt der Textarea und `onRestore` wird gerufen. Stimmen beide
überein, passiert nichts — es gibt keinen Entwurf wiederherzustellen, wenn er
dem Ausgangsinhalt gleicht.

**Ein `setValue()` direkt nach der Konstruktion gewinnt.** Das Lesen des
Speichers ist asynchron; zwischen `new SupaMDE(...)` und dem Wiederherstellen
liegt mindestens ein Tick. Wer in dieser Zeit selbst Inhalt setzt — Formular
vorbefüllen, Inhalt nachladen — behält ihn: SupaMDE stellt nur wieder her, wenn
das Dokument seit der Konstruktion unberührt ist. Der Entwurf bleibt gespeichert
und ist beim nächsten Öffnen wieder ein Kandidat.

```js
const editor = new SupaMDE({ element: el, autosave: { enabled: true, key: 'artikel-42' } });
// Gewinnt gegen einen gespeicherten Entwurf — der Host weiß mehr über seinen Fall.
editor.value(await inhaltLaden());
```

SupaMDE zeigt dafür **kein eigenes UI**: `onRestore` gibt dem Host die
Möglichkeit, selbst eine Notiz einzublenden, mit „Verwerfen"-Schaltfläche oder
ohne.

**`clearAutosavedValue()` nach dem echten Speichern rufen.** Das ist der Punkt,
den man leicht übersieht: Nach erfolgreichem Speichern im eigenen Backend ist
der lokale Entwurf hinfällig. Wird er nicht gelöscht, holt der Editor beim
nächsten Öffnen den alten Stand zurück und überschreibt damit die frisch
gespeicherte Fassung.

```js
async function speichern() {
  await fetch('/api/artikel/42', {
    method: 'PUT',
    body: JSON.stringify({ inhalt: editor.value() }),
  });
  // Erst NACH dem erfolgreichen Speichern — sonst ist der Entwurf weg,
  // obwohl der Server ihn nie bekommen hat.
  await editor.clearAutosavedValue();
}
```

`clearAutosavedValue()` stoppt zusätzlich den laufenden Debounce-Timer. Ohne das
schriebe die nächste Änderung den gerade gelöschten Eintrag sofort zurück.

**Statusbar.** Das Item `'autosave'` zeigt nach jedem Speichern
`Gespeichert: HH:MM` in der Locale der Umgebung. Es gehört **nicht** zu
`DEFAULT_STATUS` — wer es will, nimmt es in die `status`-Option auf (siehe
Beispiel oben).

**Eigener Speicher.** Der `SupaStorage`-Vertrag ist absichtlich schmal und
async-fähig, damit ein Server-Backend oder IndexedDB ohne Zusatzschicht passt:

```ts
interface SupaStorage {
  load(key: string): string | null | Promise<string | null>;
  save(key: string, value: string): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}
```

Ein Entwurfs-Endpunkt am eigenen Backend, in voller Länge:

```js
const serverStorage = {
  async load(key) {
    const res = await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Entwurf laden fehlgeschlagen: ${res.status}`);
    const daten = await res.json();
    return daten.inhalt;
  },
  async save(key, value) {
    const res = await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inhalt: value }),
    });
    if (!res.ok) throw new Error(`Entwurf speichern fehlgeschlagen: ${res.status}`);
  },
  async clear(key) {
    await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },
};

new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'artikel-42', storage: serverStorage },
});
```

**Wenn der Speicher nicht trägt** — Quota erschöpft, Private Mode, Server nicht
erreichbar — warnt SupaMDE **einmal** auf der Konsole und schaltet Autosave still
ab. Nicht bei jedem Tastendruck erneut. `isAutosaveActive()` liefert dann `false`.

**Kein Konfliktauflösen.** Der gespeicherte Stand gewinnt gegenüber dem
Ausgangsinhalt; einen Abgleich mit einem parallel geänderten Server-Stand nimmt
SupaMDE nicht vor. `onRestore` ist die Stelle, an der der Host das selbst
entscheiden kann.

**Beim Rückbau.** `toTextArea()` räumt den laufenden Timer ab, lässt den
gespeicherten Wert aber stehen — den Editor zu schließen ist kein Signal, den
Entwurf zu verwerfen.

| Methode                 | Beschreibung                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `clearAutosavedValue()` | Stoppt den Timer **und** löscht den Eintrag. `Promise<void>`.        |
| `isAutosaveActive()`    | Ob Autosave aktiv ist (aktiviert, `key` gültig, Speicher verfügbar). |

## Bild-Upload (M5)

Bilder landen per Drag & Drop, Einfügen aus der Zwischenablage oder Dateiauswahl
im Dokument. Per Default **aus**.

### Wie es funktioniert

1. **Validierung** — Größe gegen `maxSize`, MIME-Typ gegen `accept`. Wird eine
   Datei abgelehnt, passiert im Dokument **nichts**: nur Statusbar und `onError`.
2. **Platzhalter** — `![Uploading foo.png…]()` wird an der Cursorposition
   eingefügt und ab da im Dokument mitverfolgt. Tippt man davor weiter, wandert
   er mit.
3. **`upload(file)`** — deine Funktion lädt hoch und liefert die URL.
4. **Ersetzung** — der Platzhalter wird an seiner _aktuellen_ Position durch
   `![foo.png](url)` ersetzt, nicht an der ursprünglichen.

Zwischen Schritt 2 und 4 kann beliebig weitergetippt werden; das Bild landet
trotzdem an der richtigen Stelle. Löscht man den Platzhalter von Hand oder
ersetzt `setValue()` das Dokument, wird **nichts** eingefügt — ein Bild, das in
ein inzwischen fremdes Dokument hineinspringt, wäre schlimmer als ein verlorener
Upload.

### Der `upload`-Vertrag

```ts
upload: (file: File) => Promise<string>;
```

Datei rein, URL raus, **wirft bei Fehler**. Das ist die gesamte Schnittstelle zur
Außenwelt. SupaMDE bringt **keinen** HTTP-Client, kein festes Response-Format,
keine CSRF-Optionen und keine Endpoint-Option mit: Auth, Fehlerformate und
Upload-Flows (direkt, presigned, SDK) unterscheiden sich pro Projekt so stark,
dass jede eingebaute Variante für die Mehrheit falsch wäre.

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  uploadImage: {
    enabled: true,
    upload: async (file) => {
      const daten = new FormData();
      daten.append('datei', file);
      const res = await fetch('/api/bilder', { method: 'POST', body: daten });
      if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
      const { url } = await res.json();
      return url;
    },
  },
  toolbar: ['bold', 'italic', '|', 'image', 'upload-image'],
  status: ['lines', 'words', 'cursor', 'upload-image'],
});
```

| Option    | Typ                               | Default                         | Beschreibung                                               |
| --------- | --------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `enabled` | `boolean`                         | `false`                         | Aktiviert den Bild-Upload.                                 |
| `upload`  | `(file: File) => Promise<string>` | —                               | **Pflicht.** Lädt hoch, liefert die URL, wirft bei Fehler. |
| `maxSize` | `number`                          | `2097152` (2 MB)                | Maximale Dateigröße in Bytes.                              |
| `accept`  | `string[]`                        | PNG, JPEG, GIF, WebP, AVIF, SVG | Erlaubte MIME-Typen.                                       |
| `texts`   | `Partial<UploadTexts>`            | —                               | Überschreibt einzelne Anzeigetexte.                        |
| `onError` | `(error: UploadError) => void`    | —                               | Wird bei jedem Fehler gerufen.                             |

**Toolbar-Button und Statusbar-Item** heißen beide `'upload-image'` und gehören
**nicht** zu den Defaults — wer sie will, nimmt sie in die jeweilige Option auf
(siehe Beispiel oben). Der Button öffnet die Dateiauswahl. `openBrowseFileWindow()`
funktioniert auch bei `toolbar: false`, weil der Datei-Input bei Bedarf erzeugt
und nicht in der Toolbar geparkt wird.

> **Ohne Statusbar-Item und ohne `onError` bleibt der Upload stumm.** Die
> Rückmeldungen gehen ausschließlich an das Statusbar-Item `'upload-image'` und
> an `onError`. Fehlen beide, laufen Uploads unsichtbar — auch Fehler. SupaMDE
> warnt in dem Fall einmal auf der Konsole. Mindestens eines von beiden gehört
> in die Konfiguration:
>
> ```js
> status: ['lines', 'words', 'cursor', 'upload-image'],  // sichtbarer Fortschritt
> // oder/und
> uploadImage: { enabled: true, upload: meinUpload, onError: zeigeToast },
> ```

**Mehrere Dateien** laufen parallel, jede mit eigenem Platzhalter. Die Zuordnung
bleibt korrekt, auch wenn der zweite Upload vor dem ersten fertig wird. Enthält
eine Auswahl gültige und ungültige Dateien, werden die gültigen hochgeladen und
die ungültigen einzeln gemeldet.

**Nicht-Bild-Dateien** werden abgewiesen (`type-not-allowed`), nicht als Link
eingefügt. Das Feature heißt Bild-Upload.

### Backend-Beispiele

**1. `fetch` gegen einen eigenen Endpunkt** — der Standardfall, mit CSRF-Header
und ausgewertetem Fehlerstatus:

```js
upload: async (file) => {
  const daten = new FormData();
  daten.append('datei', file);

  const res = await fetch('/api/bilder', {
    method: 'POST',
    body: daten,
    credentials: 'same-origin',
    headers: {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
    },
  });

  if (!res.ok) {
    // Der Fehlertext des Servers ist oft die nützlichste Information —
    // er landet über onError beim Host.
    const text = await res.text().catch(() => '');
    throw new Error(`Upload fehlgeschlagen (${res.status}): ${text}`);
  }

  const { url } = await res.json();
  return url;
};
```

**2. Presigned Upload (S3 oder kompatibel)** — Signatur beim eigenen Backend
holen, direkt zum Storage hochladen, öffentliche URL zurückgeben:

```js
upload: async (file) => {
  // Schritt 1: Das eigene Backend signiert den Upload. Nur hier ist Auth nötig.
  const signRes = await fetch('/api/uploads/signieren', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  if (!signRes.ok) throw new Error(`Signatur fehlgeschlagen: ${signRes.status}`);
  const { uploadUrl, publicUrl } = await signRes.json();

  // Schritt 2: direkt zum Storage — die Datei berührt das eigene Backend nie.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!putRes.ok) throw new Error(`Storage-Upload fehlgeschlagen: ${putRes.status}`);

  return publicUrl;
};
```

**3. Supabase Storage** — in wenigen Zeilen:

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

upload: async (file) => {
  const pfad = `bilder/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('medien').upload(pfad, file, {
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('medien').getPublicUrl(pfad);
  return data.publicUrl;
};
```

### Was der Endpunkt leisten muss

Die Client-Validierung ist **Komfort, keine Sicherheit** — sie lässt sich mit
zwei Zeilen in der Konsole umgehen. Der Endpunkt muss selbst prüfen:

- **Größe serverseitig begrenzen**, unabhängig von `maxSize`.
- **Typ serverseitig prüfen**, und zwar am Inhalt (Magic Bytes), nicht am
  vom Client geschickten `Content-Type`.
- **Dateinamen nicht ungeprüft übernehmen.** `../../etc/passwd` ist ein
  gültiger Dateiname. Am besten einen eigenen Namen vergeben und den
  Originalnamen nur als Metadatum speichern.
- **SVG mit Vorsicht.** SVG kann Skripte enthalten. Wer es zulässt, sollte es
  serverseitig bereinigen oder von einer separaten Domain ausliefern. Wer es
  nicht braucht, nimmt `'image/svg+xml'` aus der `accept`-Liste.
- **Sinnvolle Statuscodes** zurückgeben: `413` für zu groß, `415` für falschen
  Typ, `401`/`403` für fehlende Berechtigung. Der Fehlertext landet über
  `onError` beim Host und kann dort angezeigt werden.

### Fehlerbehandlung

Fehler werden **strukturiert** gemeldet, nicht vorformatiert — der Host kann
selbst darstellen und übersetzen:

```ts
interface UploadError {
  kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
  file: File;
  /** Der ursprüngliche Fehler aus upload(), bei kind === 'upload-failed'. */
  cause?: unknown;
}
```

```js
uploadImage: {
  enabled: true,
  upload: meinUpload,
  onError: (fehler) => {
    switch (fehler.kind) {
      case 'too-large':
        toast.fehler(`${fehler.file.name} ist größer als 2 MB.`);
        break;
      case 'type-not-allowed':
        toast.fehler(`${fehler.file.name}: nur PNG, JPEG, GIF, WebP, AVIF und SVG.`);
        break;
      case 'upload-failed':
        toast.fehler('Der Upload ist fehlgeschlagen. Bitte erneut versuchen.');
        console.error(fehler.cause);
        break;
    }
  },
}
```

**Kein `alert()`.** SupaMDE reißt bei einem Upload-Fehler keinen blockierenden
Browser-Dialog auf. Default ist die Statusbar-Meldung; wer mehr will, nutzt
`onError`.

**Timeouts gehören in deine `upload`-Funktion.** Ein `upload()`, das nie
auflöst, lässt den Platzhalter stehen. Das ist Absicht: SupaMDE kennt deine
Latenzen nicht, du schon.

```js
upload: async (file) => {
  const abbruch = new AbortController();
  const timer = setTimeout(() => abbruch.abort(), 30_000);
  try {
    const daten = new FormData();
    daten.append('datei', file);
    const res = await fetch('/api/bilder', {
      method: 'POST',
      body: daten,
      signal: abbruch.signal,
    });
    if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
    return (await res.json()).url;
  } finally {
    clearTimeout(timer);
  }
};
```

### Anzeigetexte anpassen

Platzhalter sind benannt und stehen in geschweiften Klammern; **alle** Vorkommen
werden ersetzt.

```js
uploadImage: {
  enabled: true,
  upload: meinUpload,
  texts: {
    placeholder: '![Uploading {name}…]()',
    statusInit: 'Bild hierher ziehen oder einfügen',
    statusUploading: 'Lade {name} hoch…',
    statusDone: '{name} hochgeladen',
    errorTooLarge: '{name} ist zu groß (max. {maxSize}).',
    errorType: '{name} ist kein unterstütztes Bildformat.',
    errorFailed: 'Upload von {name} fehlgeschlagen.',
  },
}
```

Nach Erfolg fällt die Statusanzeige nach etwa 2 s auf `statusInit` zurück, nach
einem Fehler nach etwa 6 s. Laufen mehrere Uploads gleichzeitig, erfolgt der
Rückfall erst, wenn kein Upload mehr offen ist.

### Nicht enthalten

- **Kein Fortschritt in Prozent** — die Promise-API liefert keine
  Fortschritts-Events.
- **Keine Bildvorschau im Editor** — gehört in die Live-Preview-Ausbaustufe,
  nicht in ein Upload-Feature.
- **Keine Bildbearbeitung** (Verkleinern, Zuschneiden, Konvertieren). Wer das
  braucht, macht es in seiner `upload`-Funktion, bevor sie hochlädt.

| Methode                  | Beschreibung                                     |
| ------------------------ | ------------------------------------------------ |
| `uploadImages(files)`    | Startet den Upload für `FileList` oder `File[]`. |
| `openBrowseFileWindow()` | Öffnet die Dateiauswahl.                         |

## API (M1)

| Methode                          | Beschreibung                                             |
| -------------------------------- | -------------------------------------------------------- |
| `value()` / `getValue()`         | Aktuellen Inhalt als String lesen.                       |
| `value(val)` / `setValue(val)`   | Gesamten Inhalt ersetzen.                                |
| `updateStatusBar(name, content)` | Inhalt eines Statusbar-Items setzen (M3).                |
| `toTextArea()`                   | Editor abbauen, ursprüngliche Textarea wiederherstellen. |
| `codemirror`                     | Die zugrunde liegende CodeMirror-6-`EditorView`.         |
| `toggleSideBySide()`             | Side-by-Side-Vorschau an/aus.                            |
| `isSideBySideActive()`           | `true` wenn Side-by-Side aktiv (M4).                     |
| `toggleFullScreen()`             | Fullscreen-Modus an/aus (M4).                            |
| `isFullscreenActive()`           | `true` wenn Fullscreen aktiv (M4).                       |
| `markdown(text)`                 | Text als Markdown mit KaTeX rendern (M4).                |
| `clearAutosavedValue()`          | Entwurf löschen und Timer stoppen (M5).                  |
| `isAutosaveActive()`             | `true` wenn Autosave aktiv (M5).                         |
| `uploadImages(files)`            | Upload für `FileList`/`File[]` starten (M5).             |
| `openBrowseFileWindow()`         | Dateiauswahl öffnen (M5).                                |

## Tastenkürzel (M2)

Alle Formatierungs-Aktionen sind als CodeMirror-6-Commands umgesetzt und per
Tastenkürzel erreichbar (`Mod` = `Cmd` auf macOS, `Ctrl` sonst). Seit M3 sind alle
Aktionen auch über die grafische Toolbar per Klick erreichbar.

| Kürzel                                | Aktion                                              |
| ------------------------------------- | --------------------------------------------------- |
| `Mod-B`                               | Fett                                                |
| `Mod-I`                               | Kursiv                                              |
| `Mod-K`                               | Link                                                |
| `Mod-H` / `Shift-Mod-H`               | Überschrift kleiner / größer                        |
| `Ctrl-Alt-1` … `Ctrl-Alt-6`           | Überschrift H1 … H6                                 |
| `Mod-'` / `Ctrl-Alt-Q`                | Blockzitat                                          |
| `Mod-L` / `Mod-Alt-L` / `Shift-Mod-L` | Liste (`- `) / nummeriert / Checkliste              |
| `Shift-Alt-Mod-L`                     | Liste mit Sternchen (`* `)                          |
| `Mod-Alt-C`                           | Codeblock                                           |
| `Mod-Alt-I`                           | Bild einfügen                                       |
| `Mod-E`                               | Blockformat entfernen                               |
| `Mod-Z` / `Mod-Y`                     | Rückgängig / Wiederholen                            |
| `Tab` / `Shift-Tab`                   | Zeile ein- / ausrücken                              |
| `F8`                                  | Vorschau **und** Vollbild gemeinsam an/aus          |
| `F9`                                  | Side-by-Side-Vorschau an/aus (M4)                   |
| `F10`                                 | Editor-Modus umschalten (Quelltext ↔ Live-Vorschau) |
| `F11` / `Mod-Shift-F`                 | Fullscreen-Modus an/aus (M4)                        |

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
  {
    key: 'Mod-b',
    run: (view) => {
      /* eigene Aktion */ return true;
    },
  },
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

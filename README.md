# SupaMDE

Ein moderner, einbettbarer Markdown-Editor auf Basis von **CodeMirror 6** — die
modernisierte Neufassung von [easyMDE](https://github.com/Ionaru/easy-markdown-editor).

> **Status:** In Entwicklung. Aktueller Meilenstein: **M2 — Aktionen**
> (Formatierungs-Commands per Tastenkürzel, Undo/Redo). Die grafische Toolbar,
> Preview und weitere Features folgen in späteren Meilensteinen.

## Installation

```bash
npm install supamde
```

CodeMirror 6 ist mitgebündelt — es muss nicht separat installiert werden.

## Grundnutzung

```html
<textarea id="editor"># Hallo **Welt**</textarea>
<script type="module">
  import SupaMDE from 'supamde';
  const editor = new SupaMDE({ element: document.getElementById('editor') });
</script>
```

## Optionen (Kern-Set, M1)

| Option         | Typ                   | Default         | Bedeutung                                  |
| -------------- | --------------------- | --------------- | ------------------------------------------ |
| `element`      | `HTMLTextAreaElement` | —               | **Pflicht.** Die zu ersetzende Textarea.   |
| `lineWrapping` | `boolean`             | `true`          | Zeilenumbruch statt horizontalem Scrollen. |
| `placeholder`  | `string`              | —               | Platzhaltertext im leeren Editor.          |
| `autofocus`    | `boolean`             | `false`         | Fokussiert den Editor nach Erzeugung.      |
| `tabSize`      | `number`              | `2`             | Tab-Breite in Spalten.                     |
| `indentUnit`   | `number`              | `2`             | Einrücktiefe in Leerzeichen.               |
| `initialValue` | `string`              | Textarea-Inhalt | Startwert (überschreibt Textarea).         |

## API (M1)

| Methode                        | Beschreibung                                             |
| ------------------------------ | -------------------------------------------------------- |
| `value()` / `getValue()`       | Aktuellen Inhalt als String lesen.                       |
| `value(val)` / `setValue(val)` | Gesamten Inhalt ersetzen.                                |
| `toTextArea()`                 | Editor abbauen, ursprüngliche Textarea wiederherstellen. |
| `codemirror`                   | Die zugrunde liegende CodeMirror-6-`EditorView`.         |

## Tastenkürzel (M2)

Alle Formatierungs-Aktionen sind als CodeMirror-6-Commands umgesetzt und per
Tastenkürzel erreichbar (`Mod` = `Cmd` auf macOS, `Ctrl` sonst). Eine grafische
Toolbar folgt in M3.

| Kürzel                                | Aktion                          |
| ------------------------------------- | ------------------------------- |
| `Mod-B`                               | Fett                            |
| `Mod-I`                               | Kursiv                          |
| `Mod-K`                               | Link                            |
| `Mod-H` / `Shift-Mod-H`               | Überschrift kleiner / größer    |
| `Ctrl-Alt-1` … `Ctrl-Alt-6`           | Überschrift H1 … H6             |
| `Mod-'`                               | Blockzitat                      |
| `Mod-L` / `Mod-Alt-L` / `Shift-Mod-L` | Liste / nummeriert / Checkliste |
| `Mod-Alt-C`                           | Codeblock                       |
| `Mod-Alt-I`                           | Bild einfügen                   |
| `Mod-E`                               | Blockformat entfernen           |
| `Mod-Z` / `Mod-Y`                     | Rückgängig / Wiederholen        |

`Enter` in einer Listenzeile setzt die Liste fort; in einer leeren Listenzeile
beendet es sie. `Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle` sind
als Commands vorhanden und werden mit der Toolbar (M3) auch per Klick erreichbar.

## Entwicklung

```bash
npm install
npm run dev        # Vite-Dev-Server (example/)
npm run test:run   # Vitest (einmalig)
npm run build      # Library-Build (ESM + UMD) + Typdeklarationen
npm run lint       # ESLint
npm run typecheck  # TypeScript ohne Emit
```

## Lizenz

MIT © Sven Deginther

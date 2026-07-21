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

`Enter` in einer Listenzeile setzt die Liste fort; in einer leeren Listenzeile
beendet es sie. `Durchstreichen`, `Inline-Code`, `Trennlinie` und `Tabelle` sind
als Commands vorhanden und werden mit der Toolbar (M3) auch per Klick erreichbar.

> **Hinweis (deutsche Mac-Tastatur):** `Mod-'` (Blockzitat) liegt hier auf
> `Cmd+Shift+#` und wird je nach Browser nicht zuverlässig erkannt. Nutze
> stattdessen das layout-unabhängige `Ctrl-Alt-Q`.

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
npm run build      # Library-Build (ESM + UMD) + Typdeklarationen
npm run lint       # ESLint
npm run typecheck  # TypeScript ohne Emit
```

## Lizenz

MIT © Sven Deginther

# SupaMDE

Ein moderner, einbettbarer Markdown-Editor auf Basis von **CodeMirror 6** — die
modernisierte Neufassung von [easyMDE](https://github.com/Ionaru/easy-markdown-editor).

> **Status:** In Entwicklung. Aktueller Meilenstein: **M1 — Editor-Kern**
> (sichtbarer, live formatierender Editor; Wert-API; `toTextArea`).
> Toolbar, Kommandos, Preview und weitere Features folgen in späteren Meilensteinen.

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

| Option | Typ | Default | Bedeutung |
|---|---|---|---|
| `element` | `HTMLTextAreaElement` | — | **Pflicht.** Die zu ersetzende Textarea. |
| `lineWrapping` | `boolean` | `true` | Zeilenumbruch statt horizontalem Scrollen. |
| `placeholder` | `string` | — | Platzhaltertext im leeren Editor. |
| `autofocus` | `boolean` | `false` | Fokussiert den Editor nach Erzeugung. |
| `tabSize` | `number` | `2` | Tab-Breite in Spalten. |
| `indentUnit` | `number` | `2` | Einrücktiefe in Leerzeichen. |
| `initialValue` | `string` | Textarea-Inhalt | Startwert (überschreibt Textarea). |

## API (M1)

| Methode | Beschreibung |
|---|---|
| `value()` / `getValue()` | Aktuellen Inhalt als String lesen. |
| `value(val)` / `setValue(val)` | Gesamten Inhalt ersetzen. |
| `toTextArea()` | Editor abbauen, ursprüngliche Textarea wiederherstellen. |
| `codemirror` | Die zugrunde liegende CodeMirror-6-`EditorView`. |

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

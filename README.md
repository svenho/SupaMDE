# SupaMDE

A modern, embeddable Markdown editor built on **CodeMirror 6** — a modernized
rewrite of [easyMDE](https://github.com/Ionaru/easy-markdown-editor).

> **Status:** First public release (**0.1.x**). The API may still change before
> 1.0 — breaking changes come with a new minor version.

**[Live demo](https://svenho.github.io/SupaMDE/)**

## Installation

> **Requirement:** Node.js ≥ 22.13 (or ≥ 24).

```bash
npm install supamde
```

### Updating

```bash
npm update supamde
```

`npm update` stays within the semver range from your `package.json` (by
default `^0.1.0`). As long as SupaMDE is in the `0.x` series, every minor
release may contain breaking changes — moving to a new minor version (e.g.
`0.2.0`) requires `npm install supamde@latest`.

### Alternative: straight from the Git repo

For unreleased states, SupaMDE can also be installed directly from the repo —
either from the default branch or from a tag:

```bash
# current state of the default branch
npm install git+https://github.com/svenho/SupaMDE.git

# fixed tag
npm install git+https://github.com/svenho/SupaMDE.git#v0.1.0
```

Without a tag, npm resolves the URL to the current HEAD and writes the commit
hash into `package-lock.json`; `npm update` does **not** help then, only
re-running `npm install … --force` fetches the new state.

**What happens on a Git install:** `dist/` is not checked in but built during
installation — the `prepare` script triggers `npm run build`. npm clones the
repo for this and installs the build dependencies (Vite, TypeScript & co.).
The install therefore takes noticeably longer than with the published npm
package; the build itself takes only a few seconds.

> **Important for build dependencies:** Everything the build has to resolve at
> build time and that is not listed in `build.rollupOptions.external` belongs
> in `devDependencies` (example: `lucide`, whose icons are bundled and which
> is therefore neither a dependency nor a peer dependency). On a Git install,
> npm installs the `devDependencies` for `prepare`; if something is missing
> there, the build aborts with "failed to resolve import". Peer dependencies
> that the build resolves (e.g. for types) therefore also belong in
> `devDependencies`.

### CodeMirror 6 as peer dependencies

SupaMDE does **not** bundle CodeMirror 6 — the CM6/Lezer packages are peer
dependencies and must be installed in your project. This way SupaMDE shares
the same CM6 instance as the rest of your code (npm dedupes by version), and
no duplicate or incompatible CM6 copies end up in your bundle:

```bash
npm install \
  @codemirror/view @codemirror/state @codemirror/commands \
  @codemirror/language @codemirror/lang-markdown \
  @lezer/common @lezer/highlight @lezer/markdown
```

SupaMDE is shipped as ESM and is meant to be used with a bundler (Vite,
esbuild, Rollup, webpack …) that resolves the bare imports.

### KaTeX (optional, for formulas in the preview)

The live preview renders LaTeX formulas (`$…$`, `$$…$$`, `\begin{align}` inside
`$$`) with **KaTeX**. KaTeX is an **optional** peer dependency — if it is not
installed, the preview shows plain Markdown and leaves formulas as text. To
enable it:

```bash
npm install katex
```

Also include the KaTeX CSS (including fonts) in the host page, e.g.:

```html
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css" />
```

## Basic usage

```html
<textarea id="editor"># Hello **world**</textarea>
<script type="module">
  import SupaMDE from 'supamde';
  const editor = new SupaMDE({ element: document.getElementById('editor') });
</script>
```

### Styles

Toolbar, status bar, preview panel and fullscreen need CSS. SupaMDE injects
these rules itself as a `<style>` tag into the head on the first constructor
call — normally there is **nothing else to do**. The tag carries the
`data-supamde-styles` attribute, is inserted as the first child of the head,
and is added only once per page (multiple instances share it).

The position at the very start of the head is intentional: your own
stylesheets come after it and therefore win at equal specificity — overrides
don't need `!important`.

If you want the styles to go through your own build pipeline (purging, order
control, custom theming), turn off the auto-inject and include the bundled
stylesheet yourself:

```js
import SupaMDE from 'supamde';
import 'supamde/style.css';

new SupaMDE({ element: document.getElementById('editor'), injectStyles: false });
```

Without either — neither auto-inject nor a manual import — the editor appears
unstyled: the toolbar buttons show up as a bare row of icons.

Colors, border widths and radius are controlled via CSS variables on
`.supamde-container`, which you can override.

Every line can be controlled individually; there is deliberately no master
switch for all lines. `--supamde-border-width` only affects the outer border —
the dividers inside are not affected.

| Variable                            | Default                  | Effect                                   |
| ----------------------------------- | ------------------------ | ---------------------------------------- |
| `--supamde-border-color`            | `#d0d0d0`                | Color of all borders and dividers.       |
| `--supamde-border-width`            | `1px`                    | Outer border, all four edges.            |
| `--supamde-border-top-width`        | `--supamde-border-width` | Outer border, top only.                  |
| `--supamde-border-right-width`      | `--supamde-border-width` | Outer border, right only.                |
| `--supamde-border-bottom-width`     | `--supamde-border-width` | Outer border, bottom only.               |
| `--supamde-border-left-width`       | `--supamde-border-width` | Outer border, left only.                 |
| `--supamde-radius`                  | `4px`                    | Corner radius of the container.          |
| `--supamde-divider-toolbar-width`   | `1px`                    | Divider toolbar ↔ content.               |
| `--supamde-divider-statusbar-width` | `1px`                    | Divider content ↔ status bar.            |
| `--supamde-divider-preview-width`   | `1px`                    | Divider editor ↔ preview (side by side). |
| `--supamde-toolbar-bg`              | `#f7f7f7`                | Toolbar background.                      |
| `--supamde-statusbar-bg`            | `#f7f7f7`                | Status bar background.                   |
| `--supamde-btn-hover`               | `#e6e6e6`                | Button hover.                            |
| `--supamde-btn-active`              | `#d8e6ff`                | Active button.                           |
| `--supamde-btn-text`                | `#333`                   | Icon/text color of the buttons.          |

**Turn off only the outer border**, keep the dividers inside:

```css
.supamde-container {
  --supamde-border-width: 0;
  --supamde-radius: 0;
}
```

**Completely borderless** — every line turned off individually:

```css
.supamde-container {
  --supamde-border-width: 0;
  --supamde-radius: 0;
  --supamde-divider-toolbar-width: 0;
  --supamde-divider-statusbar-width: 0;
  --supamde-divider-preview-width: 0;
}
```

**Individual edges** — e.g. flush in a column, with a line only at the top and
bottom:

```css
.supamde-container {
  --supamde-border-left-width: 0;
  --supamde-border-right-width: 0;
  --supamde-radius: 0;
}
```

> If your editor still shows a border, it comes from the host project: SupaMDE
> sets no border on `.cm-editor` itself. Common sources are global resets or
> framework rules (e.g. Bootstrap's `.form-control`).

> **Breaking change:** The color variable used to be called `--supamde-border`.
> The name suggested a `border` shorthand but only accepted a color — hence
> `--supamde-border-color` now. The old name no longer has any effect.

## Options (core)

| Option         | Type                   | Default          | Meaning                                                        |
| -------------- | ---------------------- | ---------------- | -------------------------------------------------------------- |
| `element`      | `HTMLTextAreaElement`  | —                | **Required.** The textarea to replace.                         |
| `lineWrapping` | `boolean`              | `true`           | Wrap lines instead of scrolling horizontally.                  |
| `placeholder`  | `string`               | —                | Placeholder text in the empty editor.                          |
| `autofocus`    | `boolean`              | `false`          | Focuses the editor after creation.                             |
| `tabSize`      | `number`               | `2`              | Tab width in columns.                                          |
| `indentUnit`   | `number`               | `2`              | Indentation depth in spaces.                                   |
| `initialValue` | `string`               | textarea content | Initial value (overrides the textarea).                        |
| `extraKeys`    | `KeyBinding[]`         | `[]`             | Custom CM6 key bindings; take precedence over defaults.        |
| `autosave`     | `AutosaveOptions`      | —                | Autosave, see [Autosave](#autosave).                           |
| `uploadImage`  | `UploadImageOptions`   | —                | Image upload, see [Image upload](#image-upload).               |
| `locale`       | `Locale`               | `en`             | UI language, see [Localization](#localization).                |
| `texts`        | `Partial<LocaleTexts>` | —                | Overrides individual UI texts; takes precedence over `locale`. |

## Toolbar & status bar

| Option    | Type                                         | Default                        | Meaning                             |
| --------- | -------------------------------------------- | ------------------------------ | ----------------------------------- |
| `toolbar` | `false \| Array<string \| CustomButton>`     | default toolbar                | Toolbar layout. `false` hides it.   |
| `status`  | `false \| Array<string \| CustomStatusItem>` | `['lines', 'words', 'cursor']` | Status bar items. `false` hides it. |

**Built-in toolbar buttons:** `bold`, `italic`, `strikethrough`, `code`,
`heading-smaller`, `heading-bigger`, `heading-1`…`heading-6`, `quote`, `code-block`,
`horizontal-rule`, `clean-block`, `unordered-list`, `ordered-list`, `check-list`,
`link`, `image`, `table`, `undo`, `redo`, `preview-fullscreen`, `side-by-side`,
`fullscreen`, `editor-mode`, `upload-image` (only useful with image upload
enabled; not in the default). `'|'` inserts a separator.

**View buttons:** `preview-fullscreen` toggles the side-by-side preview and
fullscreen **together** — one click is enough for the "preview in fullscreen"
working mode. The button counts as active when both modes are on; from a
partial state (only preview or only fullscreen) a click turns both on. It is
part of the default toolbar. The individual buttons `side-by-side` and
`fullscreen` remain available but are **no longer** in the default — if you
still want them separately, add them explicitly to the `toolbar` option:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'side-by-side', 'fullscreen'],
});
```

**Custom buttons** keep the easyMDE signature:

```js
{
  name: 'shout',
  title: 'Uppercase',
  className: 'fa fa-bullhorn',       // optional custom icon class
  action: (editor) => editor.setValue(editor.getValue().toUpperCase()),
}
```

**Status bar items:** `lines`, `words`, `cursor`, `autosave`, `upload-image`.
`autosave` and `upload-image` are **not** part of `DEFAULT_STATUS` — add them
to the `status` option if you want them (see [Autosave](#autosave) and
[Image upload](#image-upload)). Custom items via
`{ className, defaultValue, onUpdate, onActivity }`.

**Icons:** The built-in buttons use bundled [Lucide](https://lucide.dev) SVG
icons — **no** icon font needs to be included. Custom buttons can still use
their own icon fonts (e.g. FontAwesome) via `className`.

## Options (preview & fullscreen)

| Option                             | Type                 | Default | Meaning                                                         |
| ---------------------------------- | -------------------- | ------- | --------------------------------------------------------------- |
| `previewRender`                    | `(text) => string`   | —       | Replaces the built-in Markdown renderer entirely.               |
| `previewClass`                     | `string \| string[]` | —       | Additional CSS classes on the preview panel. Multiple as array. |
| `renderingConfig.singleLineBreaks` | `boolean`            | `true`  | Single line break → `<br>`.                                     |
| `syncSideBySidePreviewScroll`      | `boolean`            | `true`  | Bidirectional scroll sync in side-by-side mode.                 |
| `onToggleFullScreen`               | `(active) => void`   | —       | Callback when fullscreen is toggled.                            |
| `injectStyles`                     | `boolean`            | `true`  | Injects the SupaMDE styles into the head automatically.         |

### Styling the preview

For the preview, the bundled CSS defines **only the layout**: half width, its
own scrolling, divider, padding. For the content — `h1`, `p`, `ul`, `pre`,
`table` — SupaMDE deliberately ships **no** rules.

This is intentional: the preview should look like your final result, not like
a foreign object. An editor package that dumps its own typography into your
page unasked would clash with it.

The consequence: the preview inherits your page's typography. If your project
uses a CSS reset or Tailwind's Preflight, `h1` and `ul` are flattened there —
the preview then looks unformatted even though the editor looks correct. One
of the following three approaches fixes that.

#### Approach 1 — attach an existing typography class (recommended)

`previewClass` adds arbitrary classes to the preview panel. Use the class your
project already uses to display rendered content — then the preview shows
exactly the final result:

```js
new SupaMDE({
  element: document.getElementById('editor'),
  // Tailwind + @tailwindcss/typography
  previewClass: ['prose', 'max-w-none'],
});
```

> **Pass multiple classes as an array, not as one string with spaces.**
> `previewClass: 'prose max-w-none'` throws an `InvalidCharacterError` and
> prevents the editor from starting — the classes are passed to
> `classList.add()`, which does not allow spaces within a single token. A
> single class as a string is fine.

`max-w-none` makes sense with `prose`, because the class otherwise limits the
width to about 65 characters, which looks unnecessarily narrow in the
half-width panel. In dark mode, add `dark:prose-invert`.

Without Tailwind, the same works with your own content class:
`previewClass: 'content'`.

#### Approach 2 — your own stylesheet against `.supamde-preview-side`

If your project has no typography system, style the **children** of the
panel. Don't redefine the panel class itself — it carries the layout:

```css
/* Don't push the first heading down */
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

/* overflow-x keeps a long code block from breaking the 50/50 layout */
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

/* Keep images from overflowing the panel width */
.supamde-preview-side img {
  max-width: 100%;
  height: auto;
}

/* Checklists: marked renders <input type="checkbox"> inside the <li> */
.supamde-preview-side li:has(input[type='checkbox']) {
  list-style: none;
}
```

Include this stylesheet in your page as usual. It wins without `!important`,
because the SupaMDE styles sit as the first child of the head (see
[Styles](#styles)).

#### Approach 3 — replace the renderer

If you need your own markup (different classes, syntax highlighting, your own
sanitizer), `previewRender` replaces the built-in renderer entirely:

```js
new SupaMDE({
  element: document.getElementById('editor'),
  previewRender: (text) => myRenderer(text), // returns finished HTML
});
```

The return value is written into the panel as HTML — escaping and
sanitization are then your responsibility.

#### Which HTML is produced

For writing your own rules — the built-in renderer (`marked`) produces plain
HTML without classes of its own:

| Markdown        | HTML                                                    |
| --------------- | ------------------------------------------------------- |
| Headings        | `<h1>` … `<h6>`                                         |
| Paragraph       | `<p>`                                                   |
| Lists           | `<ul>` / `<ol>` with `<li>`                             |
| Checklist       | `<li>` with `<input type="checkbox" disabled>`          |
| Quote           | `<blockquote>`                                          |
| Code block      | `<pre><code class="language-js">`                       |
| Inline code     | `<code>`                                                |
| Table           | `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`         |
| Link            | `<a target="_blank" rel="noopener noreferrer">`         |
| Horizontal rule | `<hr>`                                                  |
| LaTeX (KaTeX)   | `<span class="katex">`, or `.katex-display` for `$$…$$` |

Two things that are easy to be surprised by:

- **Tables need `renderingConfig.singleLineBreaks: false`.** By default every
  single line break becomes `<br>`, so the rows of a Markdown table arrive as
  separate paragraphs instead of a `<table>`.
- **LaTeX formulas additionally need the KaTeX CSS** in the host page (see
  [KaTeX](#katex-optional-for-formulas-in-the-preview)). Without this
  stylesheet the formula stays unformatted, even if KaTeX is installed.

## Editor mode (live preview)

SupaMDE has two display modes:

| Mode                 | Behavior                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| `'source'` (default) | The Markdown markup stays visible and is formatted live.                    |
| `'live'`             | The markup is hidden and only appears where the cursor is (Obsidian style). |

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  editorMode: 'live',
});
```

| Option       | Type                 | Default    | Description              |
| ------------ | -------------------- | ---------- | ------------------------ |
| `editorMode` | `'source' \| 'live'` | `'source'` | Display mode at startup. |

**Switching at runtime:**

| Method                | Description                  |
| --------------------- | ---------------------------- |
| `getEditorMode()`     | Returns the current mode.    |
| `setEditorMode(mode)` | Sets the mode. Idempotent.   |
| `toggleEditorMode()`  | Switches between both modes. |

Switching preserves document, cursor, selection, undo history and scroll
position.

**What is hidden in live mode:** the markers of bold, italic, strikethrough,
inline code, ATX headings (`#` … `######`) and blockquotes. Fenced code blocks
and setext headings (underlined with `=`/`-`) stay fully visible, as do list
markers and link syntax.

In both modes the text remains editable Markdown source — copied text always
contains the full markup.

**Toolbar button:** The `'editor-mode'` action is deliberately **not** part of
the default toolbar. If you want it, add it to your own `toolbar` list:

```js
new SupaMDE({
  element: document.querySelector('#editor'),
  toolbar: ['bold', 'italic', '|', 'editor-mode'],
});
```

## Autosave

Autosave stores the content in a pluggable storage — the draft survives
crashes, accidental closing and reloads. **Off** by default.

The minimum is two lines:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'article-42' },
});
```

With a status display and a notice when a draft was restored:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: {
    enabled: true,
    key: 'article-42',
    delay: 1000,
    onRestore: (draft) => {
      showNotice(`An unsaved draft was restored (${draft.length} characters).`);
    },
  },
  status: ['lines', 'words', 'cursor', 'autosave'],
});
```

| Option      | Type                      | Default      | Description                                           |
| ----------- | ------------------------- | ------------ | ----------------------------------------------------- |
| `enabled`   | `boolean`                 | `false`      | Enables autosave.                                     |
| `key`       | `string`                  | —            | **Required.** Identifies the document in the storage. |
| `delay`     | `number`                  | `1000`       | Debounce after the last change, in ms.                |
| `storage`   | `SupaStorage`             | localStorage | Custom storage (see below).                           |
| `onRestore` | `(saved: string) => void` | —            | Called when a draft was loaded at startup.            |

**Choose the `key` carefully.** It is the only thing that distinguishes two
documents. Two editors with the same `key` overwrite each other — so in
practice include the document ID, not just `'editor'`:

```js
autosave: { enabled: true, key: `article-${articleId}` }
```

In localStorage the entry is stored under `supamde:<key>`.

**When a draft is restored.** At startup SupaMDE reads the saved state. If it
is not empty **and** differs from the current document, it wins over the
textarea content and `onRestore` is called. If both match, nothing happens —
there is no draft to restore if it equals the initial content.

**A `setValue()` right after construction wins.** Reading the storage is
asynchronous; there is at least one tick between `new SupaMDE(...)` and the
restore. If you set content yourself in that window — prefilling a form,
loading content — you keep it: SupaMDE only restores if the document has been
untouched since construction. The draft stays saved and is a candidate again
the next time the editor opens.

```js
const editor = new SupaMDE({ element: el, autosave: { enabled: true, key: 'article-42' } });
// Wins over a saved draft — the host knows more about its own case.
editor.value(await loadContent());
```

SupaMDE shows **no UI of its own** for this: `onRestore` lets the host display
its own notice, with or without a "Discard" button.

**Call `clearAutosavedValue()` after the real save.** This is the point that's
easy to overlook: after a successful save to your own backend, the local draft
is obsolete. If it is not cleared, the editor brings back the old state the
next time it opens and thereby overwrites the freshly saved version.

```js
async function save() {
  await fetch('/api/articles/42', {
    method: 'PUT',
    body: JSON.stringify({ content: editor.value() }),
  });
  // Only AFTER the successful save — otherwise the draft is gone
  // even though the server never received it.
  await editor.clearAutosavedValue();
}
```

`clearAutosavedValue()` also stops the running debounce timer. Without that,
the next change would immediately write back the entry that was just deleted.

**Status bar.** The `'autosave'` item shows `Saved: HH:MM` after every save.
The text comes from the `status.autosaved` key and the time is formatted for
the locale's `code` (see [Localization](#localization)). It is **not** part of
`DEFAULT_STATUS` — add it to the `status` option if you want it (see the
example above).

**Custom storage.** The `SupaStorage` contract is intentionally narrow and
async-capable, so a server backend or IndexedDB fits without an extra layer:

```ts
interface SupaStorage {
  load(key: string): string | null | Promise<string | null>;
  save(key: string, value: string): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}
```

A draft endpoint on your own backend, in full:

```js
const serverStorage = {
  async load(key) {
    const res = await fetch(`/api/drafts/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Loading draft failed: ${res.status}`);
    const data = await res.json();
    return data.content;
  },
  async save(key, value) {
    const res = await fetch(`/api/drafts/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: value }),
    });
    if (!res.ok) throw new Error(`Saving draft failed: ${res.status}`);
  },
  async clear(key) {
    await fetch(`/api/drafts/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },
};

new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'article-42', storage: serverStorage },
});
```

**When the storage fails** — quota exceeded, private mode, server unreachable
— SupaMDE warns **once** on the console and silently disables autosave. Not
again on every keystroke. `isAutosaveActive()` then returns `false`.

**No conflict resolution.** The saved state wins over the initial content;
SupaMDE does not reconcile it with a server state that changed in parallel.
`onRestore` is the place where the host can decide that itself.

**On teardown.** `toTextArea()` clears the running timer but leaves the saved
value in place — closing the editor is not a signal to discard the draft.

| Method                  | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `clearAutosavedValue()` | Stops the timer **and** deletes the entry. `Promise<void>`.           |
| `isAutosaveActive()`    | Whether autosave is active (enabled, valid `key`, storage available). |

## Image upload

Images get into the document via drag & drop, pasting from the clipboard, or
the file picker. **Off** by default.

### How it works

1. **Validation** — size against `maxSize`, MIME type against `accept`. If a
   file is rejected, **nothing** happens in the document: only the status bar
   and `onError`.
2. **Placeholder** — `![Uploading foo.png…]()` is inserted at the cursor
   position and tracked in the document from then on. If you keep typing
   before it, it moves along.
3. **`upload(file)`** — your function uploads the file and returns the URL.
4. **Replacement** — the placeholder is replaced by `![foo.png](url)` at its
   _current_ position, not the original one.

You can keep typing freely between steps 2 and 4; the image still ends up in
the right place. If you delete the placeholder manually or `setValue()`
replaces the document, **nothing** is inserted — an image jumping into what is
by now a different document would be worse than a lost upload.

### The `upload` contract

```ts
upload: (file: File) => Promise<string>;
```

File in, URL out, **throws on error**. That is the entire interface to the
outside world. SupaMDE ships **no** HTTP client, no fixed response format, no
CSRF options and no endpoint option: auth, error formats and upload flows
(direct, presigned, SDK) differ so much between projects that any built-in
variant would be wrong for most of them.

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  uploadImage: {
    enabled: true,
    upload: async (file) => {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/images', { method: 'POST', body: data });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { url } = await res.json();
      return url;
    },
  },
  toolbar: ['bold', 'italic', '|', 'image', 'upload-image'],
  status: ['lines', 'words', 'cursor', 'upload-image'],
});
```

| Option    | Type                              | Default                         | Description                                              |
| --------- | --------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `enabled` | `boolean`                         | `false`                         | Enables image upload.                                    |
| `upload`  | `(file: File) => Promise<string>` | —                               | **Required.** Uploads, returns the URL, throws on error. |
| `maxSize` | `number`                          | `2097152` (2 MB)                | Maximum file size in bytes.                              |
| `accept`  | `string[]`                        | PNG, JPEG, GIF, WebP, AVIF, SVG | Allowed MIME types.                                      |
| `onError` | `(error: UploadError) => void`    | —                               | Called on every error.                                   |

**Toolbar button and status bar item** are both called `'upload-image'` and
are **not** part of the defaults — add them to the respective option if you
want them (see the example above). The button opens the file picker.
`openBrowseFileWindow()` also works with `toolbar: false`, because the file
input is created on demand and not parked in the toolbar.

> **Without the status bar item and without `onError`, the upload is silent.**
> Feedback goes exclusively to the `'upload-image'` status bar item and to
> `onError`. If both are missing, uploads run invisibly — errors included.
> SupaMDE warns once on the console in that case. At least one of the two
> belongs in your configuration:
>
> ```js
> status: ['lines', 'words', 'cursor', 'upload-image'],  // visible progress
> // and/or
> uploadImage: { enabled: true, upload: myUpload, onError: showToast },
> ```

**Multiple files** upload in parallel, each with its own placeholder. The
mapping stays correct even if the second upload finishes before the first. If
a selection contains valid and invalid files, the valid ones are uploaded and
the invalid ones are reported individually.

**Non-image files** are rejected (`type-not-allowed`), not inserted as a link.
The feature is called image upload.

### Backend examples

**1. `fetch` against your own endpoint** — the standard case, with a CSRF
header and evaluated error status:

```js
upload: async (file) => {
  const data = new FormData();
  data.append('file', file);

  const res = await fetch('/api/images', {
    method: 'POST',
    body: data,
    credentials: 'same-origin',
    headers: {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
    },
  });

  if (!res.ok) {
    // The server's error text is often the most useful information —
    // it reaches the host via onError.
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const { url } = await res.json();
  return url;
};
```

**2. Presigned upload (S3 or compatible)** — get a signature from your own
backend, upload directly to the storage, return the public URL:

```js
upload: async (file) => {
  // Step 1: your own backend signs the upload. Auth is only needed here.
  const signRes = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  if (!signRes.ok) throw new Error(`Signing failed: ${signRes.status}`);
  const { uploadUrl, publicUrl } = await signRes.json();

  // Step 2: straight to the storage — the file never touches your own backend.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!putRes.ok) throw new Error(`Storage upload failed: ${putRes.status}`);

  return publicUrl;
};
```

**3. Supabase Storage** — in a few lines:

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

upload: async (file) => {
  const path = `images/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
};
```

### What the endpoint must do

Client-side validation is **convenience, not security** — it can be bypassed
with two lines in the console. The endpoint must check for itself:

- **Limit the size on the server**, independently of `maxSize`.
- **Check the type on the server**, based on the content (magic bytes), not on
  the `Content-Type` sent by the client.
- **Don't accept file names unchecked.** `../../etc/passwd` is a valid file
  name. Best assign your own name and store the original name only as
  metadata.
- **Be careful with SVG.** SVG can contain scripts. If you allow it, sanitize
  it on the server or serve it from a separate domain. If you don't need it,
  remove `'image/svg+xml'` from the `accept` list.
- **Return meaningful status codes**: `413` for too large, `415` for wrong
  type, `401`/`403` for missing permission. The error text reaches the host via
  `onError` and can be displayed there.

### Error handling

Errors are reported **structured**, not preformatted — the host can display
and translate them itself:

```ts
interface UploadError {
  kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
  file: File;
  /** The original error from upload(), when kind === 'upload-failed'. */
  cause?: unknown;
}
```

```js
uploadImage: {
  enabled: true,
  upload: myUpload,
  onError: (error) => {
    switch (error.kind) {
      case 'too-large':
        toast.error(`${error.file.name} is larger than 2 MB.`);
        break;
      case 'type-not-allowed':
        toast.error(`${error.file.name}: only PNG, JPEG, GIF, WebP, AVIF and SVG.`);
        break;
      case 'upload-failed':
        toast.error('The upload failed. Please try again.');
        console.error(error.cause);
        break;
    }
  },
}
```

**No `alert()`.** SupaMDE does not pop up a blocking browser dialog on an
upload error. The default is the status bar message; if you want more, use
`onError`.

**Timeouts belong in your `upload` function.** An `upload()` that never
resolves leaves the placeholder in place. That is intentional: SupaMDE doesn't
know your latencies, you do.

```js
upload: async (file) => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30_000);
  try {
    const data = new FormData();
    data.append('file', file);
    const res = await fetch('/api/images', {
      method: 'POST',
      body: data,
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return (await res.json()).url;
  } finally {
    clearTimeout(timer);
  }
};
```

### Customizing display texts

The upload texts are part of the [localization](#localization). Override them
via the top-level `texts` option with the `upload.*` keys — not inside
`uploadImage`:

```js
new SupaMDE({
  element,
  texts: {
    'upload.statusInit': 'Drop an image here',
    'upload.errorTooLarge': '{name} exceeds {maxSize}.',
  },
  uploadImage: { enabled: true, upload: myUpload },
});
```

After a success, the status display falls back to `upload.statusInit` after about
2 s, after an error after about 6 s. If several uploads run at the same time,
the fallback happens only once no upload is pending anymore.

### Not included

- **No progress in percent** — the promise API provides no progress events.
- **No image preview in the editor** — that belongs in the live-preview
  feature, not in an upload feature.
- **No image editing** (resizing, cropping, converting). If you need that, do
  it in your `upload` function before it uploads.

| Method                   | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `uploadImages(files)`    | Starts the upload for a `FileList` or `File[]`. |
| `openBrowseFileWindow()` | Opens the file picker.                          |

## Localization

All texts users see — toolbar tooltips (and their `aria-label`), the status bar
labels, the autosave status, the image-upload messages, the link/image prompts
and the column headers of the inserted table template — are **English** by default. German ships with
the package:

```js
import SupaMDE, { de } from 'supamde';

new SupaMDE({ element, locale: de });
```

The language is fixed when the editor is constructed. Custom toolbar buttons
and custom status bar items bring their own texts.

### Overriding individual texts

`texts` overrides single keys without writing a whole locale and takes
precedence over `locale`:

```js
new SupaMDE({
  element,
  locale: de,
  texts: { 'toolbar.bold': 'Fettdruck', 'status.autosaved': 'Zuletzt gesichert: {time}' },
});
```

For every key, SupaMDE looks in `texts`, then in `locale.texts`, then in the
built-in English texts.

### Keys

| Key                      | Placeholders          | Used for                                                                                                    |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `toolbar.<action>`       | —                     | Tooltip and `aria-label` of a built-in button, one key per action (`toolbar.bold`, `toolbar.heading-1`, …). |
| `status.lines`           | `{count}`             | Status bar item `lines` (plural text).                                                                      |
| `status.words`           | `{count}`             | Status bar item `words` (plural text).                                                                      |
| `status.autosaved`       | `{time}`              | Status bar item `autosave`.                                                                                 |
| `upload.placeholder`     | `{name}`              | Placeholder inserted into the document while a file uploads.                                                |
| `upload.statusInit`      | —                     | Idle text of the `upload-image` status item.                                                                |
| `upload.statusUploading` | `{name}`              | Upload in progress.                                                                                         |
| `upload.statusDone`      | `{name}`              | Upload finished.                                                                                            |
| `upload.errorTooLarge`   | `{name}`, `{maxSize}` | File exceeds `maxSize`.                                                                                     |
| `upload.errorType`       | `{name}`              | MIME type not in `accept`.                                                                                  |
| `upload.errorFailed`     | `{name}`              | `upload()` threw or rejected.                                                                               |
| `prompt.linkUrl`         | —                     | Prompt of the link action (`window.prompt`).                                                                |
| `prompt.imageUrl`        | —                     | Prompt of the image action (`window.prompt`).                                                               |
| `table.column`           | `{n}`                 | Column header of the table template (`Column 1`, `Column 2`).                                               |

Placeholders are named and written in curly braces; all occurrences are
replaced, unknown ones stay as they are.

### Plural texts

Count-dependent texts are objects with [CLDR plural
forms](https://cldr.unicode.org/index/cldr-spec/plural-rules) (`zero`, `one`,
`two`, `few`, `many`, `other`). `other` is required and used for every missing
form:

```js
texts: { 'status.words': { one: '{count} word', other: '{count} words' } }
```

### Your own locale

A locale is a plain object with a BCP 47 `code` and the texts. The `Locale`
type requires every key, so TypeScript reports a forgotten text; at runtime,
missing keys fall back to English.

```ts
import SupaMDE, { type Locale } from 'supamde';

const fr: Locale = {
  code: 'fr',
  texts: {
    'toolbar.bold': 'Gras',
    'status.lines': { one: '{count} ligne', other: '{count} lignes' },
    // … all other keys
  },
};

new SupaMDE({ element, locale: fr });
```

`code` selects the plural rules (`Intl.PluralRules`) and the time format of the
autosave status (`en`: `Saved: 02:05 PM`, `de`: `Gespeichert: 14:05`). An
invalid code logs one warning and falls back to `'en'` for both; the texts stay
as given.

### Locale from a JSON file

A locale is plain data, so it can live in a JSON file that your bundler
(Vite, webpack, esbuild, …) imports. Abbreviated here — the file needs all keys:

```json
{
  "code": "fr",
  "texts": {
    "toolbar.bold": "Gras",
    "status.lines": { "one": "{count} ligne", "other": "{count} lignes" }
  }
}
```

```js
import SupaMDE from 'supamde';
import fr from './locales/fr.json';

new SupaMDE({ element, locale: fr });
```

A file with only some keys (and no `code`) works as an override file via
`texts`:

```js
import overrides from './locales/overrides.json';

new SupaMDE({ element, locale: de, texts: overrides });
```

Copy the full key list from [`en.ts`](https://github.com/svenho/SupaMDE/blob/main/src/i18n/en.ts)
as a template. In TypeScript, enable `"resolveJsonModule": true`; the imported
file is then checked against `Locale`, so a missing key is reported at compile
time. The file is read at build time and passed as an object — SupaMDE does not
load locale files from a URL at runtime.

## API

| Method                           | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `value()` / `getValue()`         | Read the current content as a string.                |
| `value(val)` / `setValue(val)`   | Replace the entire content.                          |
| `updateStatusBar(name, content)` | Set the content of a status bar item.                |
| `toTextArea()`                   | Tear down the editor, restore the original textarea. |
| `codemirror`                     | The underlying CodeMirror 6 `EditorView`.            |
| `toggleSideBySide()`             | Side-by-side preview on/off.                         |
| `isSideBySideActive()`           | `true` if side-by-side is active.                    |
| `toggleFullScreen()`             | Fullscreen mode on/off.                              |
| `isFullscreenActive()`           | `true` if fullscreen is active.                      |
| `markdown(text)`                 | Render text as Markdown with KaTeX.                  |
| `getEditorMode()`                | Current editor mode (`'source'` or `'live'`).        |
| `setEditorMode(mode)`            | Set the editor mode.                                 |
| `toggleEditorMode()`             | Switch between both editor modes.                    |
| `clearAutosavedValue()`          | Delete the draft and stop the timer.                 |
| `isAutosaveActive()`             | `true` if autosave is active.                        |
| `uploadImages(files)`            | Start the upload for `FileList`/`File[]`.            |
| `openBrowseFileWindow()`         | Open the file picker.                                |

## Keyboard shortcuts

All formatting actions are implemented as CodeMirror 6 commands and reachable
via keyboard shortcuts (`Mod` = `Cmd` on macOS, `Ctrl` elsewhere). All actions
are also available by clicking in the toolbar.

| Shortcut                              | Action                                     |
| ------------------------------------- | ------------------------------------------ |
| `Mod-B`                               | Bold                                       |
| `Mod-I`                               | Italic                                     |
| `Mod-K`                               | Link                                       |
| `Mod-H` / `Shift-Mod-H`               | Heading smaller / bigger                   |
| `Ctrl-Alt-1` … `Ctrl-Alt-6`           | Heading H1 … H6                            |
| `Mod-'` / `Ctrl-Alt-Q`                | Blockquote                                 |
| `Mod-L` / `Mod-Alt-L` / `Shift-Mod-L` | List (`- `) / numbered / checklist         |
| `Shift-Alt-Mod-L`                     | List with asterisks (`* `)                 |
| `Mod-Alt-C`                           | Code block                                 |
| `Mod-Alt-I`                           | Insert image                               |
| `Mod-E`                               | Remove block formatting                    |
| `Mod-Z` / `Mod-Y`                     | Undo / redo                                |
| `Tab` / `Shift-Tab`                   | Indent / outdent line                      |
| `F8`                                  | Preview **and** fullscreen on/off together |
| `F9`                                  | Side-by-side preview on/off                |
| `F10`                                 | Toggle editor mode (source ↔ live preview) |
| `F11` / `Mod-Shift-F`                 | Fullscreen mode on/off                     |

**Fullscreen on macOS:** `F11` is taken system-wide there (Mission Control or
"Show Desktop") and, depending on the system settings, may not reach the page
at all. That's why fullscreen mode also listens to `Cmd`+`Shift`+`F` (or
`Ctrl`+`Shift`+`F` on Windows/Linux); accordingly, the toolbar button shows
`⌘⇧F` as its shortcut on macOS.

**Opening links:** `Cmd`+click (macOS) or `Ctrl`+click opens the link under the
pointer in a new tab — in both editor modes. This works for Markdown links
(`[text](url)`), autolinks (`<url>`) and bare URLs that GFM recognizes
automatically (`https://…`, `http://…`, `www.…` and email addresses such as
`foo@example.com`). `https://` is added to `www.` addresses and `mailto:` to
email addresses — in each case only if no scheme is present in the text yet.
Only `http://`, `https://` and (after this completion) `mailto:` URLs are
opened; `https:`/`http:` without the two slashes do NOT count as a valid
scheme. If an email-like string appears as part of a larger URL in the text
(e.g. the user part in `https://admin@github.com/…`), it is NOT normalized to
`mailto:`. Cmd/Ctrl+click on such an address then opens nothing — never the
mail client unintentionally. Note on a parser limitation: GFM only recognizes
bare URLs/`www.` addresses in lowercase — `HTTPS://EXAMPLE.COM` in running
text is not recognized (Markdown links and autolinks are not affected).

When the mouse pointer is over a clickable link while `Cmd`/`Ctrl` is held, it
turns into a pointing hand (`cursor: pointer`) — like in VS Code.

`Enter` in a list line continues the list; in an empty list line it ends the
list. Strikethrough, inline code, horizontal rule and table are available by
clicking in the toolbar.

`Tab` indents the current line by one `indentUnit`, `Shift-Tab` outdents it —
regardless of where the cursor is in the line. With a selection, this applies
to all touched lines. This is how lists are nested: `- item` becomes
`  - item`.

> **Note (accessibility):** `Tab` is always captured by the editor and does not
> leave it. To leave the editor via keyboard, you currently have to use other
> navigation.

> **Note (German Mac keyboard):** `Mod-'` (blockquote) is on `Cmd+Shift+#`
> there and, depending on the browser, is not recognized reliably. Use the
> layout-independent `Ctrl-Alt-Q` instead.

### Custom key bindings

`extraKeys` lets you add any CodeMirror 6 `KeyBinding`s. CM6 evaluates key
bindings in registration order — the first matching entry wins. `extraKeys`
comes **before** the SupaMDE defaults, so new shortcuts and overrides of
existing defaults behave the same way:

```ts
import SupaMDE, { type KeyBinding } from 'supamde';
import { insertNewlineAndIndent } from '@codemirror/commands';

const extraKeys: KeyBinding[] = [
  // Override: replaces the built-in Mod-B (bold)
  {
    key: 'Mod-b',
    run: (view) => {
      /* custom action */ return true;
    },
  },
  // New: previously unbound key
  { key: 'Mod-Enter', run: insertNewlineAndIndent },
];

const editor = new SupaMDE({
  element: document.getElementById('editor'),
  extraKeys,
});
```

## Customizing the formatting

The editor formats the Markdown source live (easyMDE-style "quasi-WYSIWYG":
the characters stay visible but are styled). The rendering is **tag-based**:
the Lezer parser assigns a syntax tag to each element (`heading1`, `strong`,
`emphasis`, `link` …), and a `HighlightStyle` assigns CSS properties to each
tag. The rules live in [`src/editor/highlight.ts`](src/editor/highlight.ts),
the color values centrally in [`src/editor/tokens.ts`](src/editor/tokens.ts).

A highlight rule is an object of CSS properties (camelCase):

```typescript
{ tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' }
```

**Example: all second-level headings (`## …`) in red.** First add the color
value in `tokens.ts` (one source for all colors):

```typescript
export const colors = {
  quote: '#6a737d',
  link: '#0366d6',
  border: '#ddd',
  heading2: '#d73a49', // new
} as const;
```

Then extend the `heading2` rule in `highlight.ts` with `color`:

```typescript
{ tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold', color: colors.heading2 },
```

After `npm run build` (or in a running `npm run dev`), every `## ` line is
shown in red. All other tags can be adjusted the same way — e.g. `t.strong`
(bold), `t.emphasis` (italic) or `t.link`.

> **Tag-based, not position-based:** `t.heading2` matches **every**
> second-level heading, not "the second heading in the document". Position-based
> formatting (e.g. only the second heading regardless of level) would not be a
> highlight rule but would need its own CodeMirror decoration.

## Development

```bash
npm install
npm run dev          # Vite dev server (example/)
npm run test:run     # unit tests in jsdom (fast, no browser)
npm run test:browser # E2E tests in Chromium (needs a browser binary)
npm run test:all     # both test levels (needs a browser binary)
npm run build        # library build (ESM-only) + type declarations
npm run lint         # ESLint
npm run typecheck    # TypeScript without emit (src + test)
```

The browser tests check what jsdom can't — layout, scroll geometry and the
native drag & drop APIs. They need a Chromium binary:

```bash
npx playwright install chromium
```

`npm test` deliberately runs without a browser so the fast run stays fast.

## License

MIT © Sven Deginther

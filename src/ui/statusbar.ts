import type { EditorState } from '@codemirror/state';
import { wordCount } from '../features/word-count';

/** Ein Custom-Statusbar-Item (easyMDE-kompatibel). */
export interface CustomStatusItem {
  className: string;
  defaultValue?: string;
  onUpdate?(el: HTMLElement): void;
  onActivity?(el: HTMLElement): void;
}

/** Die `status`-Option: false, oder Liste aus Built-in-Namen/Custom-Items. */
export type StatusOption = false | Array<string | CustomStatusItem>;

/** Default-Statusbar-Items. */
export const DEFAULT_STATUS: string[] = ['lines', 'words', 'cursor'];

/** Built-in-Namen, die SupaMDE selbst befüllt. */
const BUILTIN_NAMES = new Set(['lines', 'words', 'cursor', 'autosave']);

/** Ein gerendertes Statusbar-Widget. */
export interface Statusbar {
  dom: HTMLElement;
  update(state: EditorState, opts: { docChanged: boolean; selectionSet: boolean }): void;
  setItem(name: string, content: string): void;
  destroy(): void;
}

interface BuiltinEntry {
  name: string;
  el: HTMLElement;
}

interface CustomEntry {
  item: CustomStatusItem;
  el: HTMLElement;
}

/** Berechnet den Textinhalt eines Built-in-Items aus dem State. */
function builtinContent(name: string, state: EditorState): string {
  switch (name) {
    case 'lines':
      return `${state.doc.lines} Zeilen`;
    case 'words':
      return `${wordCount(state.doc.toString())} Wörter`;
    case 'cursor': {
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      return `${line.number}:${head - line.from + 1}`;
    }
    case 'autosave':
      // M3-No-op; wird in M5 über setItem('autosave', …) befüllt.
      return '';
    default:
      return '';
  }
}

/** Erzeugt die Statusbar aus der `status`-Option. `null` bei `false`. */
export function createStatusbar(option: StatusOption | undefined): Statusbar | null {
  if (option === false) return null;
  const items = option ?? DEFAULT_STATUS;

  const dom = document.createElement('div');
  dom.className = 'supamde-statusbar';

  const builtins: BuiltinEntry[] = [];
  const customs: CustomEntry[] = [];

  for (const entry of items) {
    const span = document.createElement('span');
    if (typeof entry === 'string') {
      span.className = `supamde-status-${entry}`;
      dom.appendChild(span);
      if (BUILTIN_NAMES.has(entry)) {
        builtins.push({ name: entry, el: span });
      }
    } else {
      span.className = `supamde-status-custom ${entry.className}`;
      span.textContent = entry.defaultValue ?? '';
      dom.appendChild(span);
      customs.push({ item: entry, el: span });
    }
  }

  const update = (
    state: EditorState,
    opts: { docChanged: boolean; selectionSet: boolean },
  ): void => {
    for (const { name, el } of builtins) {
      el.textContent = builtinContent(name, state);
    }
    for (const { item, el } of customs) {
      if (opts.docChanged) item.onUpdate?.(el);
      if (opts.selectionSet) item.onActivity?.(el);
    }
  };

  const setItem = (name: string, content: string): void => {
    const found = builtins.find((b) => b.name === name);
    if (found) found.el.textContent = content;
  };

  const destroy = (): void => {
    dom.remove();
  };

  return { dom, update, setItem, destroy };
}

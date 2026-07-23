import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { resolveToolbar, type ResolvedToolbarItem, type ToolbarOption } from './toolbar-config';
import { renderIcon } from './icons';

/** Ein gerendertes Toolbar-Widget mit reaktivem Aktiv-Zustand. */
export interface Toolbar {
  dom: HTMLElement;
  update(state: EditorState): void;
  destroy(): void;
}

/** Ein Built-in-Button samt seiner query, um bei update() .active zu setzen. */
interface ActiveButton {
  el: HTMLButtonElement;
  query: (state: EditorState) => boolean;
}

/** Baut den DOM-Knoten für einen aufgelösten Toolbar-Eintrag. */
function buildItem(
  view: EditorView,
  item: ResolvedToolbarItem,
  editor: unknown,
  activeButtons: ActiveButton[],
): HTMLElement {
  if (item.kind === 'separator') {
    const sep = document.createElement('i');
    sep.className = 'supamde-separator';
    return sep;
  }

  const btn = document.createElement('button');
  btn.type = 'button';

  if (item.kind === 'builtin') {
    const { action, name } = item;
    btn.title = action.title;
    btn.setAttribute('aria-label', action.title);
    btn.dataset.action = name;
    btn.appendChild(renderIcon(action.icon));
    btn.addEventListener('click', () => {
      view.focus();
      action.command(view);
    });
    if (action.query) {
      activeButtons.push({ el: btn, query: action.query });
    }
  } else {
    const { button } = item;
    btn.title = button.title ?? button.name;
    btn.dataset.action = button.name;
    if (button.className) {
      const icon = document.createElement('i');
      icon.className = button.className;
      btn.appendChild(icon);
    } else {
      btn.textContent = button.name;
    }
    btn.addEventListener('click', () => button.action(editor));
  }

  return btn;
}

/**
 * Erzeugt die Toolbar aus der `toolbar`-Option. `null` bei `false`.
 * `editor` ist die SupaMDE-Instanz, die Custom-Buttons als action-Argument bekommen.
 */
export function createToolbar(
  view: EditorView,
  option: ToolbarOption | undefined,
  editor: unknown,
): Toolbar | null {
  const items = resolveToolbar(option);
  if (items === null) return null;

  const dom = document.createElement('div');
  dom.className = 'supamde-toolbar';

  const activeButtons: ActiveButton[] = [];
  for (const item of items) {
    dom.appendChild(buildItem(view, item, editor, activeButtons));
  }

  const update = (state: EditorState): void => {
    for (const { el, query } of activeButtons) {
      el.classList.toggle('active', query(state));
    }
  };

  const destroy = (): void => {
    dom.remove();
  };

  return { dom, update, destroy };
}

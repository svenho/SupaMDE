import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { resolveToolbar, type ResolvedToolbarItem, type ToolbarOption } from './toolbar-config';
import { renderIcon } from './icons';
import { formatShortcut } from './shortcut-label';
import type { SupaLike } from './actions';

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

/** Ein view-Button samt seiner active-Funktion, um bei update() .active zu setzen. */
interface ViewButton {
  el: HTMLButtonElement;
  active: (editor: SupaLike) => boolean;
}

/**
 * Laufzeit-Typwächter: erfüllt `editor` strukturell `SupaLike`? Nötig, weil
 * `createToolbar` ein `editor: unknown` entgegennimmt (Custom-Buttons erlauben
 * beliebige Werte) und `SupaMDE` die vier Methoden erst mit Task 5 bereitstellt.
 */
function isSupaLike(editor: unknown): editor is SupaLike {
  return (
    typeof editor === 'object' &&
    editor !== null &&
    typeof (editor as Partial<SupaLike>).toggleSideBySide === 'function' &&
    typeof (editor as Partial<SupaLike>).toggleFullScreen === 'function' &&
    typeof (editor as Partial<SupaLike>).isSideBySideActive === 'function' &&
    typeof (editor as Partial<SupaLike>).isFullscreenActive === 'function'
  );
}

/** Baut den DOM-Knoten für einen aufgelösten Toolbar-Eintrag. */
function buildItem(
  view: EditorView,
  item: ResolvedToolbarItem,
  editor: unknown,
  activeButtons: ActiveButton[],
  viewButtons: ViewButton[],
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
    const label = action.shortcut
      ? `${action.title} (${formatShortcut(action.shortcut)})`
      : action.title;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.dataset.action = name;
    btn.appendChild(renderIcon(action.icon));
    if (action.kind === 'command') {
      const cmd = action.command;
      btn.addEventListener('click', () => {
        view.focus();
        cmd(view);
      });
      if (action.query) {
        activeButtons.push({ el: btn, query: (state) => action.query!(state) });
      }
    } else {
      const run = action.run;
      btn.addEventListener('click', () => run(editor as SupaLike));
      if (action.active) {
        viewButtons.push({ el: btn, active: action.active });
      }
    }
  } else {
    // UNVERÄNDERT: Custom-Button-Zweig (item.kind === 'custom') — exakt wie bisher.
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
  const viewButtons: ViewButton[] = [];
  for (const item of items) {
    dom.appendChild(buildItem(view, item, editor, activeButtons, viewButtons));
  }

  // Warnt höchstens einmal pro Toolbar-Instanz (nicht bei jedem update()-Tick).
  let supaLikeWarned = false;

  const update = (state: EditorState): void => {
    for (const { el, query } of activeButtons) {
      el.classList.toggle('active', query(state));
    }
    // `editor` implementiert SupaLike erst, sobald die Instanz (SupaMDE, Task 5)
    // toggleSideBySide/toggleFullScreen/isSideBySideActive/isFullscreenActive
    // bereitstellt. Bis dahin (bzw. bei einem Host ohne diese Methoden) still
    // überspringen statt zu werfen — verhindert einen crashenden Toolbar-Update
    // allein durch das Vorhandensein der view-Buttons in DEFAULT_TOOLBAR.
    if (viewButtons.length > 0) {
      if (isSupaLike(editor)) {
        for (const { el, active } of viewButtons) {
          el.classList.toggle('active', active(editor));
        }
      } else if (!supaLikeWarned) {
        // Beobachtbar statt lautlos: verhindert, dass ein Tippfehler in einer der
        // vier SupaLike-Methoden (z.B. bei künftigen Umbenennungen) die
        // view-Buttons dauerhaft und fehlerfrei "totlaufen" lässt.
        supaLikeWarned = true;
        console.warn(
          'SupaMDE: Toolbar enthält view-Buttons (side-by-side/fullscreen), aber die ' +
            'übergebene Editor-Instanz erfüllt SupaLike nicht (toggleSideBySide/' +
            'toggleFullScreen/isSideBySideActive/isFullscreenActive) — Aktiv-Zustand ' +
            'dieser Buttons wird nicht aktualisiert.',
        );
      }
    }
  };

  const destroy = (): void => {
    dom.remove();
  };

  return { dom, update, destroy };
}

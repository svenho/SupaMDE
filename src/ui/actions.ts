import type { EditorState } from '@codemirror/state';
import type { SupaCommand } from '../commands/types';
import type { EditorMode } from '../livepreview';
import { bold, italic, strikethrough, inlineCode } from '../commands/inline';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  horizontalRule,
  cleanBlock,
} from '../commands/block';
import { unorderedList, orderedList, checkList } from '../commands/list';
import { drawLink, drawImage } from '../commands/link-image';
import { table } from '../commands/table';
import { undo, redo } from '../commands/history';
import {
  isBold,
  isItalic,
  isStrikethrough,
  isInlineCode,
  isQuote,
  isInUnorderedList,
  isInOrderedList,
  isInCheckList,
  activeHeadingLevel,
} from '../commands/queries';

/** Plattformabhängiges Anzeige-Kürzel (unverändert). */
type Shortcut = string | { default: string; mac: string };

/** Strukturelles Minimal-Interface der SupaMDE-Instanz für view-Aktionen. */
export interface SupaLike {
  toggleSideBySide(): void;
  toggleFullScreen(): void;
  isSideBySideActive(): boolean;
  isFullscreenActive(): boolean;
  togglePreviewFullScreen(): void;
  isPreviewFullScreenActive(): boolean;
  toggleEditorMode(): void;
  getEditorMode(): EditorMode;
  /** Startet den Upload für die übergebenen Dateien (M5). */
  uploadImages(files: FileList | File[]): void;
  /** Öffnet die Dateiauswahl (M5). */
  openBrowseFileWindow(): void;
}

/** Ein Built-in-Toolbar-Eintrag: entweder CM6-Command oder Instanz-Aktion. */
export type ToolbarAction =
  | {
      kind: 'command';
      command: SupaCommand;
      query?: (state: EditorState) => boolean;
      icon: string;
      /**
       * Anzeige-Kürzel für den Toolbar-Button-Title. Normalfall: einheitlicher
       * String für alle Plattformen. Für Fälle, in denen macOS eine abweichende
       * Bindung hat (z.B. redo via CM6-`historyKeymap`: `Mod-y` non-Mac,
       * `Mod-Shift-z` auf Mac), ein `{ default, mac }`-Objekt verwenden.
       */
      shortcut?: Shortcut;
    }
  | {
      kind: 'view';
      run: (editor: SupaLike) => void;
      active?: (editor: SupaLike) => boolean;
      icon: string;
      shortcut?: Shortcut;
    };

/** Erzeugt die query für eine absolute Überschrift `level`. */
function headingQuery(level: number): (state: EditorState) => boolean {
  return (state) => activeHeadingLevel(state) === level;
}

/**
 * Registry: Built-in-Name → ToolbarAction. Die Anzeigetitel stehen NICHT hier,
 * sondern als `toolbar.${name}` in den Locales (`src/i18n/`).
 */
export const BUILTIN_ACTIONS: Record<string, ToolbarAction> = {
  bold: { kind: 'command', command: bold, query: isBold, icon: 'bold', shortcut: 'Mod-b' },
  italic: {
    kind: 'command',
    command: italic,
    query: isItalic,
    icon: 'italic',
    shortcut: 'Mod-i',
  },
  strikethrough: {
    kind: 'command',
    command: strikethrough,
    query: isStrikethrough,
    icon: 'strikethrough',
  },
  code: {
    kind: 'command',
    command: inlineCode,
    query: isInlineCode,
    icon: 'code',
  },

  'heading-smaller': {
    kind: 'command',
    command: headingSmaller,
    icon: 'heading',
    shortcut: 'Mod-h',
  },
  'heading-bigger': {
    kind: 'command',
    command: headingBigger,
    icon: 'heading',
    shortcut: 'Shift-Mod-h',
  },
  'heading-1': {
    kind: 'command',
    command: setHeading(1),
    query: headingQuery(1),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-1',
  },
  'heading-2': {
    kind: 'command',
    command: setHeading(2),
    query: headingQuery(2),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-2',
  },
  'heading-3': {
    kind: 'command',
    command: setHeading(3),
    query: headingQuery(3),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-3',
  },
  'heading-4': {
    kind: 'command',
    command: setHeading(4),
    query: headingQuery(4),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-4',
  },
  'heading-5': {
    kind: 'command',
    command: setHeading(5),
    query: headingQuery(5),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-5',
  },
  'heading-6': {
    kind: 'command',
    command: setHeading(6),
    query: headingQuery(6),
    icon: 'heading',
    shortcut: 'Ctrl-Alt-6',
  },

  quote: {
    kind: 'command',
    command: quote,
    query: isQuote,
    icon: 'quote',
    shortcut: "Mod-'",
  },
  'code-block': {
    kind: 'command',
    command: codeBlock,
    icon: 'code-block',
    shortcut: 'Mod-Alt-c',
  },
  'horizontal-rule': {
    kind: 'command',
    command: horizontalRule,
    icon: 'horizontal-rule',
  },
  'clean-block': {
    kind: 'command',
    command: cleanBlock,
    icon: 'clean-block',
    shortcut: 'Mod-e',
  },

  'unordered-list': {
    kind: 'command',
    command: unorderedList,
    query: isInUnorderedList,
    icon: 'unordered-list',
    shortcut: 'Mod-l',
  },
  'ordered-list': {
    kind: 'command',
    command: orderedList,
    query: isInOrderedList,
    icon: 'ordered-list',
    shortcut: 'Mod-Alt-l',
  },
  'check-list': {
    kind: 'command',
    command: checkList,
    query: isInCheckList,
    icon: 'check-list',
    shortcut: 'Shift-Mod-l',
  },

  link: { kind: 'command', command: drawLink, icon: 'link', shortcut: 'Mod-k' },
  image: {
    kind: 'command',
    command: drawImage,
    icon: 'image',
    shortcut: 'Mod-Alt-i',
  },
  table: { kind: 'command', command: table, icon: 'table' },

  undo: { kind: 'command', command: undo, icon: 'undo', shortcut: 'Mod-z' },
  // Auf Mac bindet CM6s historyKeymap redo an Mod-Shift-z statt Mod-y (siehe
  // editor/extensions.ts) — das plattformabhängige Kürzel-Objekt sorgt dafür, dass
  // der Toolbar-Button-Title auf Mac das tatsächlich wirksame Kürzel anzeigt.
  redo: {
    kind: 'command',
    command: redo,
    icon: 'redo',
    shortcut: { default: 'Mod-y', mac: 'Mod-Shift-z' },
  },

  'side-by-side': {
    kind: 'view',
    run: (editor) => editor.toggleSideBySide(),
    active: (editor) => editor.isSideBySideActive(),
    icon: 'side-by-side',
    shortcut: 'F9',
  },
  fullscreen: {
    kind: 'view',
    run: (editor) => editor.toggleFullScreen(),
    active: (editor) => editor.isFullscreenActive(),
    icon: 'fullscreen',
    // F11 bleibt gebunden, wird aber auf Mac vom OS abgefangen — deshalb zeigt der
    // Button-Title dort das zuverlässig funktionierende Mod-Shift-F (siehe index.ts).
    shortcut: { default: 'F11', mac: 'Mod-Shift-F' },
  },
  'preview-fullscreen': {
    kind: 'view',
    run: (editor) => editor.togglePreviewFullScreen(),
    active: (editor) => editor.isPreviewFullScreenActive(),
    icon: 'preview-fullscreen',
    shortcut: 'F8',
  },
  'editor-mode': {
    kind: 'view',
    run: (editor) => editor.toggleEditorMode(),
    active: (editor) => editor.getEditorMode() === 'live',
    icon: 'editor-mode',
    shortcut: 'F10',
  },
  'upload-image': {
    kind: 'view',
    run: (editor) => editor.openBrowseFileWindow(),
    // Bewusst OHNE `active`: Bild hochladen ist eine Handlung, kein Zustand —
    // ein Aktiv-Zustand hätte nichts anzuzeigen.
    icon: 'upload-image',
  },
};

/** Liefert die Action zu einem Built-in-Namen, oder undefined. */
export function getAction(name: string): ToolbarAction | undefined {
  return BUILTIN_ACTIONS[name];
}

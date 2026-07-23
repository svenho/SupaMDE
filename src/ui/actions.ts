import type { EditorState } from '@codemirror/state';
import type { SupaCommand } from '../commands/types';
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

/** Ein Built-in-Toolbar-Eintrag: Command + optionaler Aktiv-Zustand + Anzeige. */
export interface ToolbarAction {
  command: SupaCommand;
  query?: (state: EditorState) => boolean;
  icon: string;
  title: string;
  shortcut?: string;
}

/** Erzeugt die query für eine absolute Überschrift `level`. */
function headingQuery(level: number): (state: EditorState) => boolean {
  return (state) => activeHeadingLevel(state) === level;
}

/** Registry: Built-in-Name → ToolbarAction. */
export const BUILTIN_ACTIONS: Record<string, ToolbarAction> = {
  bold: { command: bold, query: isBold, icon: 'bold', title: 'Fett', shortcut: 'Mod-b' },
  italic: { command: italic, query: isItalic, icon: 'italic', title: 'Kursiv', shortcut: 'Mod-i' },
  strikethrough: {
    command: strikethrough,
    query: isStrikethrough,
    icon: 'strikethrough',
    title: 'Durchgestrichen',
  },
  code: { command: inlineCode, query: isInlineCode, icon: 'code', title: 'Inline-Code' },

  'heading-smaller': {
    command: headingSmaller,
    icon: 'heading',
    title: 'Überschrift kleiner',
    shortcut: 'Mod-h',
  },
  'heading-bigger': {
    command: headingBigger,
    icon: 'heading',
    title: 'Überschrift größer',
    shortcut: 'Shift-Mod-h',
  },
  'heading-1': { command: setHeading(1), query: headingQuery(1), icon: 'heading', title: 'Überschrift 1', shortcut: 'Ctrl-Alt-1' },
  'heading-2': { command: setHeading(2), query: headingQuery(2), icon: 'heading', title: 'Überschrift 2', shortcut: 'Ctrl-Alt-2' },
  'heading-3': { command: setHeading(3), query: headingQuery(3), icon: 'heading', title: 'Überschrift 3', shortcut: 'Ctrl-Alt-3' },
  'heading-4': { command: setHeading(4), query: headingQuery(4), icon: 'heading', title: 'Überschrift 4', shortcut: 'Ctrl-Alt-4' },
  'heading-5': { command: setHeading(5), query: headingQuery(5), icon: 'heading', title: 'Überschrift 5', shortcut: 'Ctrl-Alt-5' },
  'heading-6': { command: setHeading(6), query: headingQuery(6), icon: 'heading', title: 'Überschrift 6', shortcut: 'Ctrl-Alt-6' },

  quote: { command: quote, query: isQuote, icon: 'quote', title: 'Blockzitat', shortcut: "Mod-'" },
  'code-block': { command: codeBlock, icon: 'code-block', title: 'Codeblock', shortcut: 'Mod-Alt-c' },
  'horizontal-rule': { command: horizontalRule, icon: 'horizontal-rule', title: 'Trennlinie' },
  'clean-block': { command: cleanBlock, icon: 'clean-block', title: 'Formatierung entfernen', shortcut: 'Mod-e' },

  'unordered-list': {
    command: unorderedList,
    query: isInUnorderedList,
    icon: 'unordered-list',
    title: 'Liste',
    shortcut: 'Mod-l',
  },
  'ordered-list': {
    command: orderedList,
    query: isInOrderedList,
    icon: 'ordered-list',
    title: 'Nummerierte Liste',
    shortcut: 'Mod-Alt-l',
  },
  'check-list': {
    command: checkList,
    query: isInCheckList,
    icon: 'check-list',
    title: 'Checkliste',
    shortcut: 'Shift-Mod-l',
  },

  link: { command: drawLink, icon: 'link', title: 'Link', shortcut: 'Mod-k' },
  image: { command: drawImage, icon: 'image', title: 'Bild', shortcut: 'Mod-Alt-i' },
  table: { command: table, icon: 'table', title: 'Tabelle' },

  undo: { command: undo, icon: 'undo', title: 'Rückgängig', shortcut: 'Mod-z' },
  redo: { command: redo, icon: 'redo', title: 'Wiederholen', shortcut: 'Mod-y' },
};

/** Liefert die Action zu einem Built-in-Namen, oder undefined. */
export function getAction(name: string): ToolbarAction | undefined {
  return BUILTIN_ACTIONS[name];
}

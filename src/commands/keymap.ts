import type { KeyBinding } from '@codemirror/view';
import { bold, italic } from './inline';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  cleanBlock,
} from './block';
import { unorderedList, orderedList, checkList, continueList } from './list';
import { drawLink, drawImage } from './link-image';

/**
 * Default-Tastenkürzel aus easyMDE (Cmd → CM6 `Mod`, plattformgerecht). Nur die
 * M2-relevanten Aktionen — Preview/SideBySide/Fullscreen (F9/F11/Mod-P) folgen
 * mit ihren Features. `strikethrough`/`inlineCode`/`hr`/`table` haben in easyMDE
 * keinen Default-Shortcut und sind über Command/Toolbar erreichbar.
 */
export const supaKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: bold, preventDefault: true },
  { key: 'Mod-i', run: italic, preventDefault: true },
  { key: 'Mod-k', run: drawLink, preventDefault: true },
  { key: 'Mod-h', run: headingSmaller, preventDefault: true },
  { key: 'Shift-Mod-h', run: headingBigger, preventDefault: true },
  { key: 'Ctrl-Alt-1', run: setHeading(1), preventDefault: true },
  { key: 'Ctrl-Alt-2', run: setHeading(2), preventDefault: true },
  { key: 'Ctrl-Alt-3', run: setHeading(3), preventDefault: true },
  { key: 'Ctrl-Alt-4', run: setHeading(4), preventDefault: true },
  { key: 'Ctrl-Alt-5', run: setHeading(5), preventDefault: true },
  { key: 'Ctrl-Alt-6', run: setHeading(6), preventDefault: true },
  { key: 'Mod-e', run: cleanBlock, preventDefault: true },
  { key: 'Mod-Alt-i', run: drawImage, preventDefault: true },
  { key: "Mod-'", run: quote, preventDefault: true },
  // Zweitkürzel für Blockzitat: Mod-' liegt auf DE-Mac-Tastaturen auf Shift+#
  // und ist dort unzuverlässig. Ctrl-Alt-Q ist layout-unabhängig erreichbar und
  // passt zum Ctrl-Alt-Schema der absoluten Überschriften (Ctrl-Alt-1…6).
  { key: 'Ctrl-Alt-q', run: quote, preventDefault: true },
  { key: 'Mod-Alt-l', run: orderedList, preventDefault: true },
  { key: 'Mod-l', run: unorderedList, preventDefault: true },
  { key: 'Shift-Mod-l', run: checkList, preventDefault: true },
  { key: 'Mod-Alt-c', run: codeBlock, preventDefault: true },
  // Listen-Fortsetzung: greift nur in Listenzeilen, sonst false → Standard-Enter.
  { key: 'Enter', run: continueList },
];

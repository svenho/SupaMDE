import type { KeyBinding } from '@codemirror/view';
import { deleteLine, copyLineUp, copyLineDown, moveLineUp, moveLineDown } from '@codemirror/commands';
import { quote } from './block';
import { unorderedListStar, continueList } from './list';
import { indentLines, dedentLines } from './indent';
import { BUILTIN_ACTIONS, type ToolbarAction } from '../ui/actions';

/**
 * Built-ins, deren `shortcut` NICHT als KeyBinding abgeleitet werden darf.
 * undo/redo werden bereits über CM6s `historyKeymap` (siehe editor/extensions.ts)
 * an Mod-z/Mod-y/Mod-Shift-z gebunden — ihr `shortcut` in actions.ts dient nur der
 * Anzeige im Toolbar-Button-Title. Eine zusätzliche Ableitung hier würde dieselbe
 * Taste doppelt binden.
 */
const DISPLAY_ONLY = new Set(['undo', 'redo']);

/**
 * Zieht den zu bindenden `key`-String aus `ToolbarAction['shortcut']`. Bei einem
 * plattformabhängigen Kürzel-Objekt (`{ default, mac }`) ist `default` der Bind-Key:
 * CM6-KeyBinding-`key`-Felder sind bereits plattformneutral (z.B. `Mod-*` löst sich
 * intern zu Cmd auf Mac / Ctrl sonst auf) — das `mac`-Feld dient nur der Anzeige im
 * Toolbar-Title (siehe shortcut-label.ts). Robust auch für künftige, nicht per
 * DISPLAY_ONLY ausgeschlossene Einträge mit Objekt-Kürzel.
 */
function bindKeyOf(shortcut: NonNullable<ToolbarAction['shortcut']>): string {
  return typeof shortcut === 'string' ? shortcut : shortcut.default;
}

/**
 * Aus jedem Built-in mit `shortcut` (außer DISPLAY_ONLY) eine KeyBinding ableiten.
 * `BUILTIN_ACTIONS` (ui/actions.ts) ist damit die alleinige Quelle für Kürzel, die zu
 * einem Toolbar-Button gehören — keine doppelte Pflege mehr in keymap.ts.
 */
const derived: KeyBinding[] = Object.entries(BUILTIN_ACTIONS)
  .filter(([name, action]) => action.shortcut && !DISPLAY_ONLY.has(name))
  .map(([, action]) => ({ key: bindKeyOf(action.shortcut!), run: action.command, preventDefault: true }));

/**
 * Sonderfälle OHNE Toolbar-Button — bleiben handgepflegt, da sie nicht aus
 * BUILTIN_ACTIONS ableitbar sind.
 */
const extras: KeyBinding[] = [
  // Zweitkürzel für Blockzitat: Mod-' (Primärkürzel, wird oben aus dem quote-Button
  // abgeleitet) liegt auf DE-Mac-Tastaturen auf Shift+# und ist dort unzuverlässig.
  // Ctrl-Alt-Q ist layout-unabhängig erreichbar und passt zum Ctrl-Alt-Schema der
  // absoluten Überschriften (Ctrl-Alt-1…6). Derselbe quote-Import wie in actions.ts,
  // damit Primär- und Zweitkürzel dieselbe Command-Instanz teilen.
  { key: 'Ctrl-Alt-q', run: quote, preventDefault: true },
  // Ungeordnete Liste mit Sternchen-Marker (kein eigener Button, Alternative zum
  // Spiegelstrich-Default).
  { key: 'Shift-Alt-Mod-l', run: unorderedListStar, preventDefault: true },
  // Listen-Fortsetzung: greift nur in Listenzeilen, sonst false → Standard-Enter.
  { key: 'Enter', run: continueList },
  // Ein-/Ausrücken der Zeile bzw. aller selektierten Zeilen — greift in JEDER
  // Zeile und an jeder Cursorposition. Tab wird bewusst ausnahmslos konsumiert
  // (keine Escape-Hatch, siehe Spec 2026-07-25).
  { key: 'Tab', run: indentLines, preventDefault: true },
  { key: 'Shift-Tab', run: dedentLines, preventDefault: true },
  // Zeilenoperationen nach VS-Code-Konvention (Löschen/Duplizieren/Verschieben).
  { key: 'Shift-Mod-k', run: deleteLine, preventDefault: true },
  { key: 'Shift-Alt-ArrowDown', run: copyLineDown, preventDefault: true },
  { key: 'Shift-Alt-ArrowUp', run: copyLineUp, preventDefault: true },
  { key: 'Alt-ArrowDown', run: moveLineDown, preventDefault: true },
  { key: 'Alt-ArrowUp', run: moveLineUp, preventDefault: true },
];

/**
 * Default-Tastenkürzel aus easyMDE (Cmd → CM6 `Mod`, plattformgerecht). Der Großteil
 * wird aus `BUILTIN_ACTIONS` (ui/actions.ts) abgeleitet — das ist die Single Source of
 * Truth für Kürzel, die zu einem Toolbar-Button gehören. Nur Bindungen ohne Button
 * (quote-Zweitkürzel, Sternchen-Liste, Listen-Fortsetzung) bleiben hier explizit.
 */
export const supaKeymap: KeyBinding[] = [...derived, ...extras];

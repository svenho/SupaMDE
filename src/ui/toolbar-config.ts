import { getAction, type ToolbarAction } from './actions';

/** Ein Custom-Toolbar-Button (easyMDE-kompatibel): eigenes action(editor). */
export interface CustomToolbarButton {
  name: string;
  action: (editor: unknown) => void;
  className?: string;
  title?: string;
}

/** Die `toolbar`-Option: false, oder Liste aus Built-in-Namen/Custom-Buttons. */
export type ToolbarOption = false | Array<string | CustomToolbarButton>;

/**
 * Default-Toolbar — NUR M1/M2-Aktionen. Preview/SideBySide/Fullscreen kommen mit
 * M4. `'|'` ist ein Separator.
 */
export const DEFAULT_TOOLBAR: string[] = [
  'bold',
  'italic',
  'strikethrough',
  'code',
  '|',
  'heading-smaller',
  'heading-bigger',
  '|',
  'quote',
  'unordered-list',
  'ordered-list',
  'check-list',
  '|',
  'code-block',
  'horizontal-rule',
  '|',
  'link',
  'image',
  'table',
  '|',
  'clean-block',
  '|',
  'undo',
  'redo',
];

/** Aufgelöster Toolbar-Eintrag. */
export type ResolvedToolbarItem =
  | { kind: 'separator' }
  | { kind: 'builtin'; name: string; action: ToolbarAction }
  | { kind: 'custom'; button: CustomToolbarButton };

/**
 * Normalisiert die `toolbar`-Option zu einer aufgelösten Item-Liste.
 * `false` → null (keine Toolbar). `undefined` → DEFAULT_TOOLBAR.
 * Unbekannte Built-in-Strings werden mit Warnung übersprungen.
 */
export function resolveToolbar(
  option: ToolbarOption | undefined,
): ResolvedToolbarItem[] | null {
  if (option === false) return null;
  const items = option ?? DEFAULT_TOOLBAR;

  const resolved: ResolvedToolbarItem[] = [];
  for (const entry of items) {
    if (typeof entry === 'string') {
      if (entry === '|') {
        resolved.push({ kind: 'separator' });
        continue;
      }
      const action = getAction(entry);
      if (!action) {
        console.warn(`SupaMDE: unbekannte Toolbar-Aktion "${entry}" wird übersprungen.`);
        continue;
      }
      resolved.push({ kind: 'builtin', name: entry, action });
    } else {
      resolved.push({ kind: 'custom', button: entry });
    }
  }
  return resolved;
}

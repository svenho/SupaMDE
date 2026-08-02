import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { colors, fontStack } from './tokens';
import { LINK_HOVER_CLASS } from './link-hover-cursor';

/**
 * Basis-Erscheinungsbild des SupaMDE-Editors (Container, Font, Padding).
 * Ersetzt das CM5-'easymde'-Theme. Farben/Font stammen aus `tokens.ts`;
 * Feinschliff (Farben/Abstände) folgt in M3/M6, dann nur an der Token-Quelle.
 */
export const supaTheme: Extension = EditorView.theme({
  '&': {
    fontFamily: fontStack,
    fontSize: '16px',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
  },
  '.cm-content': {
    padding: '10px 12px',
    lineHeight: '1.5',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
  },
  // Klickhand bei Modifier+Hover über einem klickbaren Link (siehe
  // `link-hover-cursor.ts`). Die Klasse landet auf `view.contentDOM`, das
  // bereits `.cm-content` trägt — beide Klassen sitzen also auf demselben
  // Element (kein Nachfahren-Selektor nötig).
  [`.cm-content.${LINK_HOVER_CLASS}`]: {
    cursor: 'pointer',
  },
});

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { colors, fontStack } from './tokens';

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
});

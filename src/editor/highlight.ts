import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { colors } from './tokens';

/**
 * Kern-Formatierungen für die easyMDE-„Quasi-WYSIWYG"-Parität: der Markdown-
 * Quelltext bleibt sichtbar, wird aber live formatiert. Farben stammen aus
 * `tokens.ts`; exakte px/Farben sind bewusst NICHT Teil von M1 (Feinschliff
 * folgt in M3/M6, dann nur an der Token-Quelle).
 */
export const supaHighlightStyle: HighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: 'bold' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: t.heading3, fontSize: '1.25em', fontWeight: 'bold' },
  { tag: t.heading4, fontSize: '1.15em', fontWeight: 'bold' },
  { tag: [t.heading5, t.heading6], fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: 'monospace' },
  { tag: t.quote, color: colors.quote, fontStyle: 'italic' },
  { tag: t.link, color: colors.link, textDecoration: 'underline' },
  { tag: t.url, color: colors.link },
]);

/** Fertige Extension: Syntax-Highlighting mit dem SupaMDE-Stil. */
export const highlightExtension: Extension = syntaxHighlighting(supaHighlightStyle);

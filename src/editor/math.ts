import type { InlineContext, MarkdownConfig } from '@lezer/markdown';

const DOLLAR = 36; // '$'

/**
 * Erkennt `$$…$$` (BlockMath) eagerly ab der ersten `$`, bevor Emphasis/Link
 * geprüft wird — analog zum InlineCode-Parser aus `@lezer/markdown`. Der
 * Inhalt wird dabei NICHT weiter als Markdown geparst (keine Kind-Knoten),
 * wodurch `**…**`/`[…]()` innerhalb der Formel unangetastet bleiben.
 */
function parseBlockMath(cx: InlineContext, next: number, start: number): number {
  if (next != DOLLAR || cx.char(start + 1) != DOLLAR) return -1;
  const close = cx.text.indexOf('$$', start + 2 - cx.offset);
  if (close < 0) return -1;
  const end = close + cx.offset + 2;
  return cx.addElement(cx.elt('BlockMath', start, end));
}

/** Erkennt `$…$` (InlineMath) nach demselben Prinzip wie `parseBlockMath`. */
function parseInlineMath(cx: InlineContext, next: number, start: number): number {
  if (next != DOLLAR) return -1;
  const close = cx.text.indexOf('$', start + 1 - cx.offset);
  if (close < 0) return -1;
  const end = close + cx.offset + 1;
  if (end == start + 2) return -1; // `$$` ohne Inhalt: kein leeres InlineMath
  return cx.addElement(cx.elt('InlineMath', start, end));
}

/**
 * Lezer-Markdown-Extension, die LaTeX-Bereiche (`$…$`, `$$…$$`) als eigene,
 * in sich geschlossene Knoten erkennt. Ohne dies parst der Standard-Parser
 * den Inhalt als normalen Markdown-Fließtext, wodurch z. B. `**…**` oder
 * `[…]()` innerhalb einer Formel fälschlich als Fett/Link interpretiert wird.
 */
export const Math: MarkdownConfig = {
  defineNodes: ['InlineMath', 'BlockMath'],
  parseInline: [
    { name: 'BlockMath', before: 'Escape', parse: parseBlockMath },
    { name: 'InlineMath', before: 'Escape', parse: parseInlineMath },
  ],
};

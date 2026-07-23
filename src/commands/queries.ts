import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { selectedLineRange } from '../utils/text';

/**
 * Die gemeinsame Syntaxbaum-Traversierung: liefert den Knoten namens `nodeName`,
 * der die Hauptselektion umschließt (oder `null`). EINZIGE Quelle dieser
 * Traversierung im Projekt — `inline.ts` setzt hierauf auf (es braucht die Node
 * zum Entfernen der Marker), die Bool-Queries sind `!== null` darüber.
 */
export function resolveEnclosingNode(
  state: EditorState,
  nodeName: string,
): SyntaxNode | null {
  const sel = state.selection.main;
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sel.from, 1);
  while (node) {
    if (node.name === nodeName && node.from <= sel.from && node.to >= sel.to) {
      return node;
    }
    node = node.parent;
  }
  return null;
}

/** Text der ersten von der Selektion berührten Zeile. */
function firstSelectedLineText(state: EditorState): string {
  const { firstLine } = selectedLineRange(state);
  return state.doc.line(firstLine).text;
}

export function isBold(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'StrongEmphasis') !== null;
}

export function isItalic(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'Emphasis') !== null;
}

export function isStrikethrough(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'Strikethrough') !== null;
}

export function isInlineCode(state: EditorState): boolean {
  return resolveEnclosingNode(state, 'InlineCode') !== null;
}

/**
 * Aktuelle Heading-Ebene der ersten Selektionszeile (0 = keine). EINZIGE
 * Heading-Regex im Projekt — `block.ts` (`setHeading`, `headingSmaller`,
 * `headingBigger`) ruft diese Funktion statt einer eigenen `currentLevel`.
 * `match[0].length - 1` = #-Zeichen ohne das trennende Leerzeichen (identisch
 * zur bisherigen `currentLevel`-Semantik).
 */
export function activeHeadingLevel(state: EditorState): number {
  const match = /^(#{1,6}) /.exec(firstSelectedLineText(state));
  return match ? match[0].length - 1 : 0;
}

export function isQuote(state: EditorState): boolean {
  return firstSelectedLineText(state).startsWith('> ');
}

export function isInUnorderedList(state: EditorState): boolean {
  const text = firstSelectedLineText(state);
  // Bullet, aber NICHT die Checklisten-Form (die zählt als eigene Query).
  return /^[-*] /.test(text) && !/^- \[[ xX]\] /.test(text);
}

export function isInOrderedList(state: EditorState): boolean {
  return /^\d+\. /.test(firstSelectedLineText(state));
}

export function isInCheckList(state: EditorState): boolean {
  return /^- \[[ xX]\] /.test(firstSelectedLineText(state));
}

import type { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { SupaCommand } from './types';
import { wrapSelection } from '../utils/text';

/** Lezer-Knoten je Inline-Formatierung + zugehöriger Marker-Kindname. */
interface InlineSpec {
  /** Umschließender Syntaxknoten (z. B. StrongEmphasis). */
  node: string;
  /** Name der Marker-Kindknoten (EmphasisMark bzw. CodeMark). */
  mark: string;
  /** Vor der Selektion einzufügender Marker. */
  before: string;
  /** Nach der Selektion einzufügender Marker. */
  after: string;
}

/** Sucht einen umschließenden Knoten `spec.node` um die Selektion. */
function enclosingNode(view: EditorView, spec: InlineSpec): SyntaxNode | null {
  const sel = view.state.selection.main;
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(sel.from, 1);
  while (node) {
    if (node.name === spec.node && node.from <= sel.from && node.to >= sel.to) {
      return node;
    }
    node = node.parent;
  }
  return null;
}

/** Entfernt die Marker-Kinder eines Formatierungs-Knotens (Toggle-Off). */
function unwrap(view: EditorView, node: SyntaxNode, markName: string): boolean {
  const marks: { from: number; to: number }[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === markName) marks.push({ from: child.from, to: child.to });
  }
  if (marks.length === 0) return false;
  view.dispatch({ changes: marks.map((m) => ({ from: m.from, to: m.to, insert: '' })) });
  return true;
}

function toggle(spec: InlineSpec): SupaCommand {
  return (view) => {
    const node = enclosingNode(view, spec);
    if (node) return unwrap(view, node, spec.mark);
    return wrapSelection(view, spec.before, spec.after);
  };
}

/** Fettdruck (`**…**`) ein-/ausschalten. */
export const bold: SupaCommand = toggle({
  node: 'StrongEmphasis',
  mark: 'EmphasisMark',
  before: '**',
  after: '**',
});

/** Kursiv (`*…*`) ein-/ausschalten. */
export const italic: SupaCommand = toggle({
  node: 'Emphasis',
  mark: 'EmphasisMark',
  before: '*',
  after: '*',
});

/** Durchstreichen (`~~…~~`) ein-/ausschalten. */
export const strikethrough: SupaCommand = toggle({
  node: 'Strikethrough',
  mark: 'StrikethroughMark',
  before: '~~',
  after: '~~',
});

/** Inline-Code (`` `…` ``) ein-/ausschalten. */
export const inlineCode: SupaCommand = toggle({
  node: 'InlineCode',
  mark: 'CodeMark',
  before: '`',
  after: '`',
});

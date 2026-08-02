import type { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import type { SupaCommand } from './types';
import { resolveEnclosingNode } from './queries';
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

/** Sucht den umschließenden Knoten `spec.node` um die Selektion (teilt die Traversierung mit queries.ts). */
function enclosingNode(view: EditorView, spec: InlineSpec): SyntaxNode | null {
  return resolveEnclosingNode(view.state, spec.node);
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

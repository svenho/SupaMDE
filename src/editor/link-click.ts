import type { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/** Nur diese Schemata werden geöffnet — `javascript:` und `data:` sind Angriffsvektoren. */
const SAFE_SCHEME = /^https?:\/\//i;

/** Sucht vom Knoten aufwärts den umschließenden Link- oder Autolink-Knoten. */
function enclosingLink(node: SyntaxNode | null): SyntaxNode | null {
  for (let current = node; current; current = current.parent) {
    if (current.name === 'Link' || current.name === 'Autolink') return current;
  }
  return null;
}

/**
 * Liefert die Ziel-URL des Links an `pos`, oder `null`.
 *
 * `null` bei: keiner Link an der Position, fehlender URL-Knoten, oder einem
 * Schema außerhalb von http/https. Reine Funktion — ohne DOM testbar.
 */
export function linkUrlAt(state: EditorState, pos: number): string | null {
  const link = enclosingLink(syntaxTree(state).resolveInner(pos, 0));
  if (!link) return null;

  const url = link.getChild('URL');
  if (!url) return null;

  const text = state.doc.sliceString(url.from, url.to);
  return SAFE_SCHEME.test(text) ? text : null;
}

/**
 * Cmd/Ctrl+Klick öffnet den Link unter dem Zeiger in einem neuen Tab.
 *
 * Bewusst MODUSUNABHÄNGIG (fest in der Extension-Liste, außerhalb des
 * Live-Preview-Compartments) — es gibt keinen Grund, nützliche Navigation an den
 * Darstellungsmodus zu koppeln.
 */
export const linkClickExtension: Extension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!event.metaKey && !event.ctrlKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const url = linkUrlAt(view.state, pos);
    if (!url) return false;

    // noopener/noreferrer: die geöffnete Seite darf weder auf `window.opener`
    // zugreifen noch den Referrer sehen.
    window.open(url, '_blank', 'noopener,noreferrer');
    event.preventDefault();
    return true;
  },
});

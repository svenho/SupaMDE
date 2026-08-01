import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/** Ein auszublendender Dokumentbereich. */
export interface HiddenRange {
  from: number;
  to: number;
}

/** Welche Lezer-Knotennamen als Markup gelten. */
export interface MarkSets {
  /** Marker, die exakt ihren eigenen Bereich ausblenden. */
  inline: ReadonlySet<string>;
  /** Marker, deren angrenzendes Leerzeichen mit ausgeblendet wird. */
  block: ReadonlySet<string>;
}

/**
 * Die Marker der aktuell unterstützten Formatierungen. Am realen
 * `@lezer/markdown`-Parser (mit `[GFM, Math]`) verifiziert; `StrikethroughMark`
 * hat bewusst einen eigenen Namen und ist NICHT `EmphasisMark`.
 *
 * Exportiert und als Parameter durchgereicht, damit sich der Umfang erweitern
 * lässt (Listen-Marker, Link-Syntax), ohne diese Datei zu editieren.
 */
export const DEFAULT_MARK_SETS: MarkSets = {
  inline: new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']),
  block: new Set(['HeaderMark', 'QuoteMark']),
};

/** Ob `parent` einen der Selektionsbereiche berührt (Grenzen zählen als Berührung). */
function isActive(
  parent: { from: number; to: number },
  ranges: readonly { from: number; to: number }[],
): boolean {
  return ranges.some((r) => r.from <= parent.to && r.to >= parent.from);
}

/**
 * Erweitert einen Block-Marker um das angrenzende Leerzeichen — begrenzt auf die
 * eigene Zeile, damit eine Zeile aus nur `#` oder `>` nicht in die Folgezeile läuft.
 *
 * Öffnender Marker (`# Titel`): nach rechts. Schließender (`# Titel #`): nach links,
 * damit kein freistehendes Leerzeichen am Zeilenende zurückbleibt.
 */
function widenBlockMark(
  state: EditorState,
  node: SyntaxNode,
  parent: { from: number; to: number },
): HiddenRange {
  const line = state.doc.lineAt(node.from);
  const text = state.doc.sliceString(line.from, line.to);
  // Schließender Marker: berührt das Ende des Elternknotens.
  const isClosing = node.to >= parent.to;

  if (isClosing) {
    let from = node.from;
    while (from > line.from && text[from - line.from - 1] === ' ') from--;
    return { from, to: node.to };
  }

  let to = node.to;
  while (to < line.to && text[to - line.from] === ' ') to++;
  return { from: node.from, to };
}

/**
 * Berechnet die auszublendenden Markup-Bereiche für den Live-Modus.
 *
 * Regel (knoten-genau): Das Markup eines Knotens wird ausgeblendet, solange der
 * Knoten KEINEN Cursor und keinen Selektionsbereich berührt. Sobald der Cursor ihn
 * berührt — Grenzen eingeschlossen —, wird sein Markup sichtbar und normal editierbar.
 *
 * Bezugspunkt ist der ELTERNknoten, nicht der Marker: Bei einem mehrzeiligen
 * Blockquote hängen alle `QuoteMark` am selben `Blockquote`, ein Cursor in einer
 * beliebigen Zeile macht daher die Marker aller Zeilen sichtbar. Bewusst so — das
 * Zitat ist eine Einheit.
 *
 * Reine Funktion: kein DOM, keine View, keine Dekorationen. Rückgabe ist nach `from`
 * aufsteigend sortiert und überlappungsfrei (Vertrag für `RangeSet.of()`, das
 * unsortierte Eingaben mit einem Fehler quittiert).
 */
export function computeHiddenRanges(
  state: EditorState,
  visibleRanges: readonly { from: number; to: number }[],
  marks: MarkSets = DEFAULT_MARK_SETS,
): HiddenRange[] {
  const selection = state.selection.ranges;
  const result: HiddenRange[] = [];
  const tree = syntaxTree(state);

  for (const visible of visibleRanges) {
    tree.iterate({
      from: visible.from,
      to: visible.to,
      enter: (nodeRef) => {
        const name = nodeRef.name;
        const isInline = marks.inline.has(name);
        const isBlock = marks.block.has(name);
        if (!isInline && !isBlock) return;

        const parent = nodeRef.node.parent;
        if (!parent) return;
        if (isActive(parent, selection)) return;

        result.push(
          isBlock
            ? widenBlockMark(state, nodeRef.node, parent)
            : { from: nodeRef.from, to: nodeRef.to },
        );
      },
    });
  }

  // Mehrere sichtbare Bereiche liefern getrennt sortierte Teillisten — global
  // sortieren und Duplikate/Überlappungen an den Bereichsgrenzen zusammenfassen.
  result.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: HiddenRange[] = [];
  for (const range of result) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) {
      if (range.to > last.to) last.to = range.to;
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

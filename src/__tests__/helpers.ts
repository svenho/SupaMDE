import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { Math } from '../editor/math';
import type { ResolvedOptions } from '../options';

/**
 * Das Markdown-Setup der Anwendung — identisch zu `src/editor/extensions.ts`.
 * Bewusst `[GFM, Math]` und nicht nur `GFM`: `Math` unterdrückt in `$…$` das
 * Fett/Kursiv-Parsing, ein Test mit reinem GFM prüfte also ein Setup, das es in
 * der Anwendung nicht gibt.
 */
export const markdownSetup: Extension = markdown({ extensions: [GFM, Math] });

/** State mit Markdown-Parser und einfacher Selektion. */
export function stateWith(doc: string, anchor = 0, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdownSetup],
  });
}

/**
 * State mit MEHREREN Cursorn. Das Facet `allowMultipleSelections` ist zwingend —
 * ohne es verwirft CM6 alle Zusatzselektionen still und `state.selection.ranges`
 * enthält nur einen Bereich (der Test misst dann nichts).
 */
export function stateWithCursors(doc: string, positions: number[]): EditorState {
  return EditorState.create({
    doc,
    selection: EditorSelection.create(positions.map((p) => EditorSelection.cursor(p))),
    extensions: [markdownSetup, EditorState.allowMultipleSelections.of(true)],
  });
}

/** Der komplette Dokumentbereich als "sichtbar". */
export function whole(state: EditorState): { from: number; to: number }[] {
  return [{ from: 0, to: state.doc.length }];
}

/**
 * Baut eine echte, am `document.body` hängende View. Das Anhängen ist nötig,
 * weil ViewPlugins über `view.visibleRanges` arbeiten — ohne Layout bliebe die
 * Liste leer. Verifiziert: in jsdom ist sie so gefüllt, kein Fallback nötig.
 */
export function viewWith(
  doc: string,
  extensions: Extension[],
  anchor = 0,
  head = anchor,
): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
      extensions: [markdownSetup, ...extensions],
    }),
    parent,
  });
}

/**
 * Wie `viewWith`, aber OHNE das Markdown-Setup vorzuschalten — für Tests, deren
 * Extension-Liste bereits vollständig ist (z.B. aus `buildExtensions`).
 */
export function viewFromExtensions(
  extensions: Extension[],
  doc: string,
  cursor = 0,
): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(cursor),
      extensions,
    }),
    parent,
  });
}

/** Räumt View und ihren Container ab. Bestehende Konvention: immer am Testende. */
export function cleanup(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

/** Sammelt alle atomaren Bereiche über alle Provider des Facets. */
export function atomicRangesOf(view: EditorView): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  for (const provider of view.state.facet(EditorView.atomicRanges)) {
    const iter = provider(view).iter();
    while (iter.value) {
      found.push({ from: iter.from, to: iter.to });
      iter.next();
    }
  }
  return found;
}

/**
 * Vollständige `ResolvedOptions` mit Defaults. Kommt später ein Pflichtfeld
 * dazu, wird es NUR hier ergänzt — nicht in jedem Testliteral einzeln.
 */
export function makeResolved(overrides: Partial<ResolvedOptions> = {}): ResolvedOptions {
  return {
    lineWrapping: true,
    placeholder: null,
    autofocus: false,
    tabSize: 2,
    indentUnit: 2,
    extraKeys: [],
    // `editorMode` kommt in Task 3 dazu — hier bewusst noch nicht gesetzt,
    // damit der Typecheck in dieser Task grün bleibt.
    ...overrides,
  };
}

import { RangeSet, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { computeHiddenRanges } from './ranges';

/** Blendet einen Bereich vollständig aus (ersetzt ihn durch nichts). */
const hideMark = Decoration.replace({});

/** Baut den DecorationSet für den aktuellen View-Zustand. */
function buildDecorations(view: EditorView): DecorationSet {
  const ranges = computeHiddenRanges(view.state, view.visibleRanges);
  return RangeSet.of(
    ranges.map((r) => hideMark.range(r.from, r.to)),
    // Bereits sortiert (Vertrag von computeHiddenRanges), daher kein erneutes Sortieren.
    false,
  );
}

/**
 * ViewPlugin, das inaktives Markdown-Markup ausblendet.
 *
 * Bewusst ein ViewPlugin und kein StateField: Die Dekoration hängt von der
 * CURSORPOSITION ab, die sich ständig ohne Dokumentänderung ändert. Ein StateField
 * müsste bei jeder Cursorbewegung ohnehin neu rechnen — sein inkrementelles Mapping
 * wäre wertlos — und liefe dabei über das ganze Dokument statt über den sichtbaren
 * Ausschnitt.
 */
const hidePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
    // Dieselbe Menge speist die atomaren Bereiche. EINE Quelle: ein Drift zwischen
    // "ausgeblendet" und "atomar" ist damit konstruktiv ausgeschlossen — ein
    // atomarer Bereich ohne Ausblendung machte sichtbaren Text unnavigierbar.
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);

/** Die fertige Live-Preview-Extension (Ausblenden + atomare Bereiche). */
export const livePreviewPlugin: Extension = hidePlugin;

import type { Extension, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Empfänger für Editor-Updates (Toolbar-Aktiv-Zustand, Statusbar …). */
export interface UpdateSink {
  onUpdate(update: {
    state: EditorState;
    docChanged: boolean;
    selectionSet: boolean;
  }): void;
}

/**
 * Der EINE zentrale updateListener: bei jedem relevanten ViewUpdate wird
 * `sink.onUpdate` mit dem neuen State und den Flags gerufen. Entkoppelt UI ↔
 * Editor an einer Stelle (CM6-Design §5, „roter Faden").
 */
export function updateListenerExtension(sink: UpdateSink): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return;
    sink.onUpdate({
      state: update.state,
      docChanged: update.docChanged,
      selectionSet: update.selectionSet,
    });
  });
}

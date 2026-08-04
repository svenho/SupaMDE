import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, placeholder, keymap } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import type { ResolvedOptions } from '../options';
import { highlightExtension } from './highlight';
import { Math } from './math';
import { supaTheme } from './theme';
import { supaKeymap } from '../commands/keymap';
import { updateListenerExtension, type UpdateSink } from '../ui/update-listener';
import { livePreviewCompartment, livePreviewFor } from '../livepreview';
import { linkClickExtension } from './link-click';
import { linkHoverCursorExtension } from './link-hover-cursor';

/**
 * Übersetzt normalisierte Optionen in die CM6-Extension-Liste. Jede easyMDE-
 * Option wird hier zur echten Extension (kein Flag-Layer). `autofocus` ist
 * bewusst nicht enthalten — es ist eine View-Konstruktor-Option, keine Extension.
 * GFM-Extensions sind aktiviert, um GitHub Flavored Markdown (Strikethrough, Tabellen, etc.) zu parsen.
 * `Math` erkennt `$…$`/`$$…$$` als eigene Knoten, damit LaTeX-Inhalt nicht als
 * Markdown (Fett, Links, …) interpretiert wird.
 * `livePreviewCompartment` hält die Live-Modus-Extension — im Source-Modus leer,
 * per `reconfigure` zur Laufzeit umschaltbar.
 */
export function buildExtensions(resolved: ResolvedOptions, sink?: UpdateSink): Extension[] {
  const extensions: Extension[] = [
    // `addKeymap: false`: `markdown()` bindet Enter sonst per `Prec.high` an
    // `insertNewlineContinueMarkup` — also VOR dem `supaKeymap`, wodurch SupaMDEs
    // `continueList` nie liefe. Dessen Listen-Ende ist zudem mehrstufig (erst eine
    // Leerzeile einschieben, dann ausrücken, dann den Marker entfernen); SupaMDE
    // beendet die Liste stattdessen mit einem einzigen Enter. Die übrigen
    // Markdown-Bindungen der Extension sind für SupaMDE ohne Belang.
    markdown({ extensions: [GFM, Math], addKeymap: false }),
    highlightExtension,
    // Compartment: erlaubt den Modus-Wechsel zur Laufzeit ohne View-Neuaufbau.
    livePreviewCompartment.of(livePreviewFor(resolved.editorMode)),
    // Modusunabhängig: Cmd/Ctrl+Klick öffnet Links in beiden Darstellungsmodi.
    linkClickExtension,
    // Modusunabhängig: Klickhand bei Modifier+Hover über einem Link.
    linkHoverCursorExtension,
    history(),
    keymap.of([...resolved.extraKeys, ...supaKeymap, ...historyKeymap, ...defaultKeymap]),
    supaTheme,
    EditorState.tabSize.of(resolved.tabSize),
    indentUnit.of(' '.repeat(resolved.indentUnit)),
  ];

  if (resolved.lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }
  if (resolved.placeholder !== null) {
    extensions.push(placeholder(resolved.placeholder));
  }
  if (sink) {
    extensions.push(updateListenerExtension(sink));
  }

  return extensions;
}

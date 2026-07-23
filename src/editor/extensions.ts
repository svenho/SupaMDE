import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, placeholder, keymap } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import type { ResolvedOptions } from '../options';
import { highlightExtension } from './highlight';
import { supaTheme } from './theme';
import { supaKeymap } from '../commands/keymap';
import { updateListenerExtension, type UpdateSink } from '../ui/update-listener';

/**
 * Übersetzt normalisierte Optionen in die CM6-Extension-Liste. Jede easyMDE-
 * Option wird hier zur echten Extension (kein Flag-Layer). `autofocus` ist
 * bewusst nicht enthalten — es ist eine View-Konstruktor-Option, keine Extension.
 * GFM-Extensions sind aktiviert, um GitHub Flavored Markdown (Strikethrough, Tabellen, etc.) zu parsen.
 */
export function buildExtensions(resolved: ResolvedOptions, sink?: UpdateSink): Extension[] {
  const extensions: Extension[] = [
    markdown({ extensions: GFM }),
    highlightExtension,
    history(),
    keymap.of([...supaKeymap, ...historyKeymap, ...defaultKeymap]),
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

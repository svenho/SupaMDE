import { EditorView } from '@codemirror/view';
import type { SupaMDEOptions } from '../options';
import { resolveOptions } from '../options';
import { buildExtensions } from './extensions';
import type { UpdateSink } from '../ui/update-listener';

/** Steuerungs-Handle über den erzeugten Editor inkl. Rückbau. */
export interface EditorHandle {
  /** Die zugrunde liegende CM6-EditorView. */
  view: EditorView;
  /** Baut den Editor zurück und liefert die wiederhergestellte Textarea. */
  toTextArea(): HTMLTextAreaElement;
  /** Schreibt den aktuellen Doc-Inhalt sofort in die Textarea. */
  forceSync(): void;
}

/**
 * CM6-Nachbau von `fromTextArea`: erzeugt eine EditorView aus dem Textarea-
 * Inhalt, fügt sie davor ein, versteckt die Textarea und hält den Form-Submit-
 * Wert synchron. Der Textarea-Wert ist die Quelle NUR bei Konstruktion.
 */
export function editorFromTextArea(options: SupaMDEOptions, sink?: UpdateSink): EditorHandle {
  const element = options.element;
  if (!element) {
    throw new Error('SupaMDE: `element` ist erforderlich (eine <textarea>).');
  }
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('SupaMDE: `element` muss ein <textarea> sein.');
  }
  const textarea = element;

  const resolved = resolveOptions(options);
  const doc = options.initialValue ?? textarea.value;

  // Ohne `parent` erzeugt; view.dom wird gleich manuell vor der Textarea platziert.
  const view = new EditorView({
    doc,
    extensions: buildExtensions(resolved, sink),
  });

  // vor die Textarea einfügen, Textarea verstecken
  textarea.parentNode?.insertBefore(view.dom, textarea);
  const previousDisplay = textarea.style.display;
  textarea.style.display = 'none';

  const forceSync = (): void => {
    textarea.value = view.state.doc.toString();
  };

  // Form-Submit-Listener referenziert halten, damit toTextArea ihn entfernen kann
  const onSubmit = (): void => forceSync();
  const form = textarea.form;
  form?.addEventListener('submit', onSubmit);

  if (resolved.autofocus) {
    view.focus();
  }

  const toTextArea = (): HTMLTextAreaElement => {
    forceSync();
    form?.removeEventListener('submit', onSubmit);
    view.destroy();
    view.dom.remove();
    textarea.style.display = previousDisplay;
    return textarea;
  };

  return { view, toTextArea, forceSync };
}

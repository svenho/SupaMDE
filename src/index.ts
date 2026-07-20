import type { EditorView } from '@codemirror/view';
import { VERSION } from './version';
import type { SupaMDEOptions } from './options';
import { editorFromTextArea, type EditorHandle } from './editor/setup';
import { readValue, writeValue } from './editor/value';

export type { SupaMDEOptions } from './options';

/**
 * SupaMDE — moderner Markdown-Editor auf Basis von CodeMirror 6.
 *
 * Dünne Fassade: der Konstruktor baut über `editor/setup.ts` eine EditorView
 * aus der übergebenen Textarea; alle Methoden delegieren an diese View bzw. an
 * die headless value-Logik (`editor/value.ts`). Keine Editor-Logik in der Klasse.
 */
export class SupaMDE {
  /** Aktuelle SupaMDE-Version. */
  static readonly version = VERSION;

  /** Die (rohen) Optionen dieser Instanz. */
  readonly options: SupaMDEOptions;

  /** Die zugrunde liegende CM6-EditorView (NICHT das CM5-Objekt). */
  readonly codemirror: EditorView;

  private readonly handle: EditorHandle;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;
    this.handle = editorFromTextArea(options);
    this.codemirror = this.handle.view;
  }

  /** Liest (ohne Argument) oder setzt (mit Argument) den Editor-Inhalt. */
  value(): string;
  value(val: string): void;
  value(val?: string): string | void {
    if (val === undefined) {
      return this.getValue();
    }
    this.setValue(val);
  }

  /** Liefert den aktuellen Editor-Inhalt als String. */
  getValue(): string {
    return readValue(this.codemirror);
  }

  /** Ersetzt den gesamten Editor-Inhalt. */
  setValue(val: string): void {
    writeValue(this.codemirror, val);
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    return this.handle.toTextArea();
  }
}

export { VERSION } from './version';
export default SupaMDE;

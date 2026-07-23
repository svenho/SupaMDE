import './ui/toolbar.css';
import './ui/statusbar.css';

import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { VERSION } from './version';
import type { SupaMDEOptions } from './options';
import { editorFromTextArea, type EditorHandle } from './editor/setup';
import { readValue, writeValue } from './editor/value';
import { createToolbar, type Toolbar } from './ui/toolbar';
import { createStatusbar, type Statusbar } from './ui/statusbar';

export type { SupaMDEOptions } from './options';

/**
 * SupaMDE — moderner Markdown-Editor auf Basis von CodeMirror 6.
 *
 * Dünne Fassade: der Konstruktor baut über `editor/setup.ts` eine EditorView aus
 * der übergebenen Textarea, umgibt sie mit Toolbar und Statusbar und verdrahtet
 * beide über EINEN updateListener. Alle Methoden delegieren an die Module.
 */
export class SupaMDE {
  /** Aktuelle SupaMDE-Version. */
  static readonly version = VERSION;

  /** Die (rohen) Optionen dieser Instanz. */
  readonly options: SupaMDEOptions;

  /** Die zugrunde liegende CM6-EditorView (NICHT das CM5-Objekt). */
  readonly codemirror: EditorView;

  private readonly handle: EditorHandle;
  private readonly container: HTMLElement;
  private readonly toolbar: Toolbar | null;
  private readonly statusbar: Statusbar | null;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;

    // Der EINE Sink: speist Toolbar-Aktiv-Zustand und Statusbar.
    const sink = {
      onUpdate: (u: { state: EditorState; docChanged: boolean; selectionSet: boolean }): void => {
        this.toolbar?.update(u.state);
        this.statusbar?.update(u.state, { docChanged: u.docChanged, selectionSet: u.selectionSet });
      },
    };

    this.handle = editorFromTextArea(options, sink);
    this.codemirror = this.handle.view;

    this.toolbar = createToolbar(this.codemirror, options.toolbar, this);
    this.statusbar = createStatusbar(options.status);

    // Container um view.dom bauen: Toolbar oben, Editor Mitte, Statusbar unten.
    this.container = document.createElement('div');
    this.container.className = 'supamde-container';
    const viewDom = this.codemirror.dom;
    viewDom.parentNode?.insertBefore(this.container, viewDom);
    if (this.toolbar) this.container.appendChild(this.toolbar.dom);
    this.container.appendChild(viewDom);
    if (this.statusbar) this.container.appendChild(this.statusbar.dom);

    // Initialer Zustand, damit Statusbar/Aktiv-Zustand sofort stimmen.
    const state = this.codemirror.state;
    this.toolbar?.update(state);
    this.statusbar?.update(state, { docChanged: true, selectionSet: true });
  }

  value(): string;
  value(val: string): void;
  value(val?: string): string | void {
    if (val === undefined) return this.getValue();
    this.setValue(val);
  }

  getValue(): string {
    return readValue(this.codemirror);
  }

  setValue(val: string): void {
    writeValue(this.codemirror, val);
  }

  /** Überschreibt den Inhalt eines Statusbar-Items (API-kompatibel zu easyMDE). */
  updateStatusBar(itemName: string, content: string): void {
    this.statusbar?.setItem(itemName, content);
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    this.toolbar?.destroy();
    this.statusbar?.destroy();
    const textarea = this.handle.toTextArea();
    this.container.remove();
    return textarea;
  }
}

export { VERSION } from './version';
export default SupaMDE;

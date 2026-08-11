// Diese vier Imports erzeugen im Library-Build `dist/supamde.css` — die Datei,
// die Host-Projekte über `supamde/style.css` einbinden können. Sie wird NICHT
// automatisch geladen; dafür sorgt `injectStyles()`, das dieselben Quellen per
// `?inline` als String im Bundle mitführt.
import './ui/toolbar.css';
import './ui/statusbar.css';
import './ui/preview.css';
import './ui/fullscreen.css';

import type { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { VERSION } from './version';
import type { SupaMDEOptions } from './options';
import { editorFromTextArea, type EditorHandle } from './editor/setup';
import { readValue, writeValue } from './editor/value';
import { createToolbar, type Toolbar } from './ui/toolbar';
import { createStatusbar, type Statusbar } from './ui/statusbar';
import { createSideBySide, type SideBySide } from './ui/preview';
import { createFullscreen, type Fullscreen } from './ui/fullscreen';
import { injectStyles } from './ui/inject-styles';
import { markdownToHtml, renderOptionsFrom, type RenderOptions } from './markdown/parse';
import type { SupaLike } from './ui/actions';
import { livePreviewCompartment, livePreviewFor, type EditorMode } from './livepreview';

export type { SupaMDEOptions } from './options';
export type { KeyBinding } from '@codemirror/view';
export type { EditorMode } from './livepreview';

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
  private readonly editorRow: HTMLElement;
  private readonly toolbar: Toolbar | null;
  private readonly statusbar: Statusbar | null;
  private readonly preview: SideBySide | null;
  private readonly fullscreen: Fullscreen;
  /** Referenz auf den F8/F9/F10/F11-Keydown-Handler, damit toTextArea() ihn abräumt. */
  private readonly onViewShortcuts: (event: KeyboardEvent) => void;
  /**
   * EINMALIG im Konstruktor berechneter Render-Options-Snapshot — Panel UND
   * `markdown()` nutzen GENAU dieses Feld (nicht `renderOptionsFrom(this.options)`
   * bei jedem Aufruf neu), damit beide auch bei einer nachträglichen Mutation von
   * `this.options` konsistent bleiben (eine Quelle der Wahrheit, kein stiller Split).
   */
  private readonly renderOpts: RenderOptions;
  /**
   * Aktueller Darstellungsmodus. Bewusst ein Instanzfeld und KEIN StateField:
   * Der Modus ist eine Eigenschaft der Ansicht, nicht des Dokuments — gleiches
   * Muster wie bei Fullscreen und Side-by-Side.
   */
  private editorMode: EditorMode;

  constructor(options: SupaMDEOptions = {}) {
    this.options = options;

    // VOR dem DOM-Aufbau: sonst hinge der Editor kurz ungestylt in der Seite.
    // Idempotent — mehrere Instanzen teilen sich EIN <style>-Tag.
    if (options.injectStyles !== false) injectStyles();

    // Der EINE Sink: speist Toolbar-Aktiv-Zustand, Statusbar UND Vorschau-Panel.
    const sink = {
      onUpdate: (u: { state: EditorState; docChanged: boolean; selectionSet: boolean }): void => {
        this.toolbar?.update(u.state);
        this.statusbar?.update(u.state, { docChanged: u.docChanged, selectionSet: u.selectionSet });
        this.preview?.update(u.state);
      },
    };

    this.handle = editorFromTextArea(options, sink);
    this.codemirror = this.handle.view;

    // Aus dem Handle, NICHT über einen zweiten resolveOptions()-Aufruf: die
    // Extension-Erzeugung hat die Optionen bereits normalisiert. Ein zweiter
    // Aufruf ergäbe zwei unabhängige Auswertungen und eine doppelte Warnung bei
    // ungültigem editorMode. Eine Quelle der Wahrheit — hier wörtlich.
    this.editorMode = this.handle.resolved.editorMode;

    this.toolbar = createToolbar(this.codemirror, options.toolbar, this);
    this.statusbar = createStatusbar(options.status);

    // EINE Quelle für die Render-Optionen (Panel + markdown()-Fassade teilen sie).
    this.renderOpts = renderOptionsFrom(options);
    this.preview = createSideBySide(this.codemirror, {
      render: (text) => markdownToHtml(text, this.renderOpts),
      previewClass: options.previewClass,
      syncScroll: options.syncSideBySidePreviewScroll,
    });

    // Container um view.dom bauen: Toolbar oben, Editor-Zeile Mitte, Statusbar unten.
    this.container = document.createElement('div');
    this.container.className = 'supamde-container';
    const viewDom = this.codemirror.dom;
    viewDom.parentNode?.insertBefore(this.container, viewDom);
    if (this.toolbar) this.container.appendChild(this.toolbar.dom);

    // Editor-Zeile: Editor + Vorschau-Panel nebeneinander (Flex via CSS), damit
    // Toolbar/Statusbar außerhalb der Flex-Zeile volle Breite behalten.
    this.editorRow = document.createElement('div');
    this.editorRow.className = 'supamde-editor-row';
    this.editorRow.appendChild(viewDom);
    this.editorRow.appendChild(this.preview.dom);
    this.container.appendChild(this.editorRow);

    if (this.statusbar) this.container.appendChild(this.statusbar.dom);

    this.fullscreen = createFullscreen(this.container, {
      // Jeder Fullscreen-Wechsel läuft hier durch — auch der modul-interne
      // Escape-Pfad, der NICHT über setFullScreen() kommt. Deshalb ist das die
      // richtige Stelle für das Toolbar-Update: eine Pflegestelle statt zwei.
      // Die Nutzer-Option wird weitergereicht, nicht ersetzt.
      onToggleFullScreen: (active) => {
        this.toolbar?.update(this.codemirror.state);
        options.onToggleFullScreen?.(active);
      },
    });

    // F8/F9/F10/F11 sind view-Aktionen (preview-fullscreen/side-by-side/editorMode/fullscreen), keine
    // CM6-Commands — sie lassen sich nicht über die CM6-keymap (commands/keymap.ts)
    // ableiten, da sie nicht auf der EditorView, sondern auf der SupaMDE-Instanz
    // wirken (siehe Kommentar dort). Deshalb hier ein eigener Keydown-Handler auf
    // dem Container, der `event.preventDefault()` für F11 aufruft, damit der
    // Browser nicht zusätzlich ins native Vollbild wechselt. Vollbild hört
    // zusätzlich auf Mod-Shift-F, weil F11 auf macOS vom OS abgefangen wird.
    this.onViewShortcuts = (event: KeyboardEvent): void => {
      if (event.key === 'F8') {
        // Vorschau + Vollbild gemeinsam (Alles-oder-nichts, siehe togglePreviewFullScreen).
        event.preventDefault();
        this.togglePreviewFullScreen();
      } else if (event.key === 'F9') {
        event.preventDefault();
        this.toggleSideBySide();
      } else if (event.key === 'F10') {
        // preventDefault, weil F10 in einigen Browsern die Menüleiste fokussiert.
        event.preventDefault();
        this.toggleEditorMode();
      } else if (event.key === 'F11') {
        event.preventDefault();
        this.toggleFullScreen();
      } else if (
        // Zweitbindung für Vollbild: macOS belegt F11 systemweit (Mission Control /
        // "Schreibtisch einblenden"), die Taste erreicht die Seite dort oft gar nicht.
        // Cmd/Ctrl+Shift+F kollidiert weder mit dem OS noch mit Browser-Defaults
        // (Cmd+Ctrl+F wäre das native macOS-Vollbild des Fensters).
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey &&
        (event.key === 'F' || event.key === 'f')
      ) {
        event.preventDefault();
        this.toggleFullScreen();
      }
    };
    this.container.addEventListener('keydown', this.onViewShortcuts);

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

  /** Rendert Markdown (inkl. LaTeX) zu HTML. Teilt exakt denselben Render-Options-Snapshot wie das Panel. */
  markdown(text: string): string {
    return markdownToHtml(text, this.renderOpts);
  }

  /**
   * Schaltet die Nebeneinander-Vorschau gezielt an oder aus. Idempotent —
   * ein Aufruf mit dem bereits aktiven Zustand ändert nichts.
   */
  setSideBySide(on: boolean): void {
    this.preview?.set(on);
    this.container.classList.toggle('supamde-sided', this.isSideBySideActive());
    this.toolbar?.update(this.codemirror.state);
  }
  toggleSideBySide(): void {
    this.setSideBySide(!this.isSideBySideActive());
  }
  isSideBySideActive(): boolean {
    return this.preview?.isActive() ?? false;
  }

  /** Schaltet den Vollbildmodus gezielt an oder aus. Idempotent. */
  setFullScreen(on: boolean): void {
    this.fullscreen.set(on);
    this.toolbar?.update(this.codemirror.state);
  }
  toggleFullScreen(): void {
    this.setFullScreen(!this.isFullscreenActive());
  }
  isFullscreenActive(): boolean {
    return this.fullscreen.isActive();
  }

  /**
   * Vorschau UND Vollbild gemeinsam schalten (Alles-oder-nichts): Ist nicht
   * bereits beides aktiv, wird beides eingeschaltet — auch aus einem
   * Teilzustand heraus. Sind beide aktiv, wird beides ausgeschaltet.
   */
  togglePreviewFullScreen(): void {
    const on = !this.isPreviewFullScreenActive();
    this.setSideBySide(on);
    this.setFullScreen(on);
  }
  /** Ob Vorschau und Vollbild gleichzeitig aktiv sind. */
  isPreviewFullScreenActive(): boolean {
    return this.isSideBySideActive() && this.isFullscreenActive();
  }

  /** Der aktuelle Darstellungsmodus. */
  getEditorMode(): EditorMode {
    return this.editorMode;
  }

  /**
   * Setzt den Darstellungsmodus. Idempotent — ein Aufruf mit dem bereits aktiven
   * Modus dispatcht nichts. Der Wechsel läuft über ein Compartment-`reconfigure`,
   * daher bleiben Dokument, Cursor, Historie und Scrollposition erhalten.
   */
  setEditorMode(mode: EditorMode): void {
    if (mode === this.editorMode) return;
    this.editorMode = mode;
    this.codemirror.dispatch({
      effects: livePreviewCompartment.reconfigure(livePreviewFor(mode)),
    });
    this.toolbar?.update(this.codemirror.state);
  }

  /** Wechselt zwischen `'source'` und `'live'`. */
  toggleEditorMode(): void {
    this.setEditorMode(this.editorMode === 'live' ? 'source' : 'live');
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    this.container.removeEventListener('keydown', this.onViewShortcuts);
    this.toolbar?.destroy();
    this.statusbar?.destroy();
    this.preview?.destroy();
    this.fullscreen.destroy();
    const textarea = this.handle.toTextArea();
    this.container.remove();
    return textarea;
  }
}

// Stellt sicher, dass SupaMDE strukturell SupaLike erfüllt (die Toolbar reicht
// `this` als SupaLike durch). Bricht der Vertrag, schlägt der Typecheck HIER fehl —
// nicht erst indirekt an der Durchreich-Stelle in toolbar.ts.
const _supaLikeCheck: SupaLike = null as unknown as SupaMDE;
void _supaLikeCheck;

export { VERSION } from './version';
export default SupaMDE;

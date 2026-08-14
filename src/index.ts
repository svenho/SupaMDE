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
import { createAutosave, type Autosave } from './features/autosave';
import {
  createImageUploader,
  resolveUploadTexts,
  type ImageUploader,
} from './features/image-upload';
import { uploadPlaceholderField } from './features/upload-placeholder';
import { uploadDropPasteExtension, openFilePicker } from './features/upload-dom';

export type { SupaMDEOptions } from './options';
export type { KeyBinding } from '@codemirror/view';
export type { EditorMode } from './livepreview';
export type { SupaStorage } from './features/storage';
export type { AutosaveOptions } from './features/autosave';
export type { UploadImageOptions, UploadError, UploadTexts } from './features/image-upload';

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
  /**
   * Autosave dieser Instanz. Immer erzeugt, aber nur aktiv, wenn die Option es
   * verlangt UND der Speicher trägt — `isActive()` ist die Wahrheit, nicht die
   * Option.
   */
  private readonly autosave: Autosave;
  /**
   * Der Uploader dieser Instanz. Wird NACH der View erzeugt (er braucht sie),
   * die Drop/Paste-Extension zeigt daher über eine Closure auf dieses Feld statt
   * direkt auf den Uploader.
   */
  private uploader: ImageUploader | null = null;
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
        // Nur bei echter Dokumentänderung — eine Cursorbewegung ist kein Grund
        // zu speichern und würde den Debounce sinnlos verlängern.
        if (u.docChanged) this.autosave.schedule();
      },
    };

    // Die Extension wird VOR dem Uploader gebaut — sie kann ihn also nicht
    // direkt referenzieren. Die Closure löst das: Sie liest `this.uploader`
    // erst beim Drop/Paste, wenn das Feld längst gesetzt ist.
    const uploadAktiv = options.uploadImage?.enabled === true;
    const uploadExtensions = uploadAktiv
      ? [
          uploadPlaceholderField,
          uploadDropPasteExtension((files) => this.uploader?.uploadFiles(files)),
        ]
      : [];

    this.handle = editorFromTextArea(options, sink, uploadExtensions);
    this.codemirror = this.handle.view;

    // Aus dem Handle, NICHT über einen zweiten resolveOptions()-Aufruf: die
    // Extension-Erzeugung hat die Optionen bereits normalisiert. Ein zweiter
    // Aufruf ergäbe zwei unabhängige Auswertungen und eine doppelte Warnung bei
    // ungültigem editorMode. Eine Quelle der Wahrheit — hier wörtlich.
    this.editorMode = this.handle.resolved.editorMode;

    // Spec §4.2: Der Button wird NUR bei aktiviertem Bild-Upload gerendert. Ein
    // Button, dessen Klick folgenlos bleibt, ist schlimmer als gar keiner.
    // Gefiltert wird hier statt in `resolveToolbar`, weil nur die Fassade die
    // `uploadImage`-Option kennt — und ohne Warnung, denn der Name IST gültig.
    // `filter` liefert eine neue Liste; die übergebene Option bleibt unberührt.
    const toolbarOption =
      !uploadAktiv && Array.isArray(options.toolbar)
        ? options.toolbar.filter((eintrag) => eintrag !== 'upload-image')
        : options.toolbar;

    this.toolbar = createToolbar(this.codemirror, toolbarOption, this);
    this.statusbar = createStatusbar(options.status);

    // NACH der Statusbar: onSaved schreibt in sie hinein. Die Instanz wird immer
    // erzeugt (der sink referenziert sie), bleibt ohne autosave-Option aber
    // inaktiv — `start()` verlässt sich bei fehlendem `enabled` sofort wieder.
    //
    // `createAutosave` liest hier den Ausgangswert des Dokuments und merkt ihn
    // als Referenzpunkt für den Restore. Diese Zeile muss deshalb NACH dem
    // View-Aufbau stehen (sonst gäbe es kein Dokument zu lesen) und VOR jeder
    // Gelegenheit, bei der der Host `setValue()` rufen könnte — beides ist im
    // Konstruktor gegeben.
    this.autosave = createAutosave(options.autosave ?? { enabled: false, key: '' }, {
      getValue: () => this.getValue(),
      setValue: (v) => this.setValue(v),
      onSaved: (time) => {
        const zeit = new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(time);
        // Instanz-eigene Statusbar statt easyMDEs globalem
        // getElementById('autosaved') — zwei Editoren auf einer Seite störten
        // sich dort gegenseitig. `setItem` schreibt textContent, kein innerHTML.
        this.statusbar?.setItem('autosave', `Gespeichert: ${zeit}`);
      },
    });

    // Nur bei aktivierter Option: ohne `upload`-Funktion gibt es nichts zu tun,
    // und `uploadImages()` soll dann folgenlos bleiben.
    if (uploadAktiv && options.uploadImage) {
      // SupaMDE ist eine Bibliothek mit JavaScript-Hosts — der Typ macht
      // `upload` zur Pflicht, das schützt zur Laufzeit aber niemanden. Ohne
      // diese Prüfung passierte bei der Konstruktion nichts, und erst beim
      // ersten Drop würfe `options.upload is not a function` mitten im
      // Ablauf. Deshalb dieselbe Warnpraxis wie unten: EINE Meldung, der
      // Editor läuft weiter, aber es entsteht KEIN Uploader — `uploadImages()`
      // und `openBrowseFileWindow()` bleiben dann folgenlos.
      if (typeof options.uploadImage.upload !== 'function') {
        console.warn(
          'SupaMDE: uploadImage.enabled ist true, aber uploadImage.upload ist keine ' +
            'Funktion — Bild-Upload bleibt aus.',
        );
      } else {
        this.uploader = createImageUploader(this.codemirror, options.uploadImage, {
          setStatus: (text) => this.statusbar?.setItem('upload-image', text),
        });

        // `setItem` findet ein Item nur, wenn es tatsächlich gerendert wurde —
        // also nur, wenn sein Name in der `status`-Option steht (siehe
        // ui/statusbar.ts). Fehlt es UND fehlt `onError`, verschwinden sämtliche
        // Rückmeldungen des Uploads spurlos: kein Fortschritt, keine Fehler. Das
        // ist eine gültige Konfiguration (ein Host kann das bewusst wollen), aber
        // fast immer ein Versehen. Genau EINE Warnung — der Editor läuft weiter.
        const statusZeigtUpload =
          Array.isArray(options.status) && options.status.includes('upload-image');
        if (!statusZeigtUpload && !options.uploadImage.onError) {
          console.warn(
            'SupaMDE: uploadImage ist aktiviert, aber weder das Statusbar-Item ' +
              "'upload-image' (status-Option) noch uploadImage.onError ist gesetzt — " +
              'Fortschritt und Fehler des Uploads bleiben unsichtbar.',
          );
        }

        // Der Slot zeigt von Anfang an den Einladungstext, nicht erst nach dem
        // ersten Upload — sonst bliebe er beim frisch geöffneten Editor leer.
        this.statusbar?.setItem(
          'upload-image',
          resolveUploadTexts(options.uploadImage.texts).statusInit,
        );
      }
    }

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

    // Async und bewusst nicht awaited — ein Konstruktor kann nicht warten. Ein
    // eventueller Restore landet als normale Transaktion im Dokument, sobald
    // der Speicher geantwortet hat.
    void this.autosave.start();
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

  /**
   * Löscht den gespeicherten Entwurf UND stoppt den laufenden Debounce-Timer.
   * Nach erfolgreichem Speichern im eigenen Backend zu rufen — sonst holt der
   * Editor beim nächsten Öffnen den alten Entwurf zurück.
   */
  async clearAutosavedValue(): Promise<void> {
    await this.autosave.clear();
    this.statusbar?.setItem('autosave', '');
  }

  /** Ob Autosave aktiv ist (aktiviert, `key` gültig, Speicher verfügbar). */
  isAutosaveActive(): boolean {
    return this.autosave.isActive();
  }

  /**
   * Startet den Upload für die übergebenen Dateien. Jede Datei wird einzeln
   * validiert; ungültige werden über `onError` gemeldet, ohne die gültigen
   * aufzuhalten. Ohne aktivierten Bild-Upload folgenlos.
   */
  uploadImages(files: FileList | File[]): void {
    this.uploader?.uploadFiles(files);
  }

  /**
   * Öffnet die Dateiauswahl. Der Input wird bei Bedarf erzeugt und nicht in der
   * Toolbar geparkt — funktioniert deshalb auch bei `toolbar: false`.
   */
  openBrowseFileWindow(): void {
    if (!this.uploader) return;
    openFilePicker(this.uploader.accept(), (files) => this.uploader?.uploadFiles(files));
  }

  /** Baut den Editor zurück und stellt die ursprüngliche Textarea wieder her. */
  toTextArea(): HTMLTextAreaElement {
    // Nur den Timer abräumen: Der gespeicherte Wert bleibt erhalten — Rückbau
    // des Editors ist kein Signal, den Entwurf zu verwerfen.
    this.autosave.stop();
    // Wie beim Autosave nur die Zeitgeber: Der Rückfall-Timer der Statusanzeige
    // liefe sonst nach dem Rückbau weiter und schriebe gegen eine zerstörte
    // Statusbar. Laufende Uploads bleiben unangetastet — ihre Promise gehört dem
    // Host, und ihr Ergebnis findet über den verschwundenen Platzhalter ohnehin
    // kein Ziel mehr.
    this.uploader?.destroy();
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

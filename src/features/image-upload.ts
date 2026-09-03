import type { EditorView } from '@codemirror/view';
import {
  addPlaceholder,
  removePlaceholder,
  createIdSource,
  placeholderRange,
} from './upload-placeholder';
import { formatText, formatBytes } from '../util/text-format';

/** Die Anzeigetexte des Bild-Uploads. Platzhalter: `{name}`, `{maxSize}`. */
export interface UploadTexts {
  placeholder: string;
  statusInit: string;
  statusUploading: string;
  statusDone: string;
  errorTooLarge: string;
  errorType: string;
  errorFailed: string;
}

/**
 * Ein Upload-Fehler — strukturiert statt vorformatiert, damit der Host selbst
 * darstellen und übersetzen kann.
 */
export interface UploadError {
  kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
  file: File;
  /** Der ursprüngliche Fehler aus `upload()`, bei `kind === 'upload-failed'`. */
  cause?: unknown;
}

/** Konfiguration des Bild-Uploads. */
export interface UploadImageOptions {
  /** Aktiviert den Bild-Upload. Default: false. */
  enabled?: boolean;
  /** Pflicht. Lädt die Datei hoch und liefert die URL; wirft bei Fehler. */
  upload: (file: File) => Promise<string>;
  /** Maximale Dateigröße in Bytes. Default: 2 MB. */
  maxSize?: number;
  /** Erlaubte MIME-Typen. */
  accept?: string[];
  /** Überschreibt einzelne Anzeigetexte. */
  texts?: Partial<UploadTexts>;
  /** Wird bei jedem Fehler gerufen. Default: keiner (nur Statusbar). */
  onError?: (error: UploadError) => void;
}

/** Das Steuerungs-Handle über den Uploader. */
export interface ImageUploader {
  uploadFiles(files: FileList | File[]): void;
  /** Die erlaubten MIME-Typen — für das `accept`-Attribut des File-Inputs. */
  accept(): string[];
  isActive(): boolean;
  /**
   * Räumt den Rückfall-Timer ab. Beim Rückbau des Editors zu rufen — sonst
   * feuerte er nach `toTextArea()` gegen eine bereits zerstörte Statusbar.
   * Laufende Uploads werden NICHT abgebrochen: Ihre `upload()`-Promise gehört
   * dem Host, und ihr Ergebnis findet über den dann leeren Platzhalter-Bereich
   * ohnehin kein Ziel mehr.
   */
  destroy(): void;
}

/** Default-Obergrenze: 2 MB. */
export const DEFAULT_UPLOAD_MAX_SIZE = 2 * 1024 * 1024;

/** Default-Liste erlaubter MIME-Typen. */
export const DEFAULT_UPLOAD_ACCEPT: string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

/** Die Default-Anzeigetexte. */
export const DEFAULT_UPLOAD_TEXTS: UploadTexts = {
  placeholder: '![Uploading {name}…]()',
  statusInit: 'Bild hierher ziehen oder einfügen',
  statusUploading: 'Lade {name} hoch…',
  statusDone: '{name} hochgeladen',
  errorTooLarge: '{name} ist zu groß (max. {maxSize}).',
  errorType: '{name} ist kein unterstütztes Bildformat.',
  errorFailed: 'Upload von {name} fehlgeschlagen.',
};

/** Anzeigedauer der Erfolgsmeldung, bevor auf `statusInit` zurückgefallen wird. */
export const STATUS_DONE_MS = 2000;
/** Anzeigedauer der Fehlermeldung. Länger, weil sie gelesen werden muss. */
export const STATUS_ERROR_MS = 6000;

/** Füllt fehlende Texte mit den Defaults auf. Mutiert `texts` nicht. */
export function resolveUploadTexts(texts?: Partial<UploadTexts>): UploadTexts {
  return { ...DEFAULT_UPLOAD_TEXTS, ...texts };
}

/**
 * Die Markdown-Textform eines fertigen Bildes.
 *
 * Bewusst NICHT über `insertImage()` aus `commands/link-image.ts`: Jenes fügt an
 * der aktuellen SELEKTION ein — genau der Weg, den die Positionsregel verbietet.
 * Der Upload muss an der gemappten Platzhalter-Position ersetzen, nicht an der
 * Cursorposition. Geteilt wird deshalb nur die Textform, hier als eine Zeile.
 */
export function imageMarkdown(alt: string, url: string): string {
  // `]` und `[` im Alt-Text und `(`/`)`/Leerzeichen in der URL brechen die
  // Markdown-Bildsyntax. Alt-Text maskieren, URL in spitze Klammern setzen —
  // die von CommonMark vorgesehene Form für URLs mit Sonderzeichen.
  const altSicher = alt.replace(/([[\]\\])/g, '\\$1');
  const urlSicher = /[\s()<>]/.test(url) ? `<${url.replace(/([<>\\])/g, '\\$1')}>` : url;
  return `![${altSicher}](${urlSicher})`;
}

/**
 * Prüft eine Datei. `null` heißt: in Ordnung. Größe zuerst — eine zu große
 * Datei ist auch dann zu groß, wenn ihr Typ zusätzlich nicht passt, und die
 * Größe ist die häufigere Ursache.
 */
export function validateFile(
  file: File,
  opts: { maxSize: number; accept: string[] },
): UploadError['kind'] | null {
  if (file.size > opts.maxSize) return 'too-large';
  if (!opts.accept.includes(file.type)) return 'type-not-allowed';
  return null;
}

export function createImageUploader(
  view: EditorView,
  options: UploadImageOptions,
  hooks: { setStatus(text: string): void },
): ImageUploader {
  const enabled = options.enabled ?? false;
  const maxSize = options.maxSize ?? DEFAULT_UPLOAD_MAX_SIZE;
  const accept = options.accept ?? DEFAULT_UPLOAD_ACCEPT;
  const texts = resolveUploadTexts(options.texts);
  /** Eigene ID-Sequenz pro Uploader — kein geteilter Modulzustand. */
  const nächsteId = createIdSource();

  /** Zahl der noch laufenden Uploads — steuert den Rückfall auf `statusInit`. */
  let offen = 0;
  let rückfallTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Setzt den Status und plant den Rückfall auf `statusInit`. Der Rückfall
   * greift nur, wenn dann KEIN Upload mehr läuft — sonst überschriebe die
   * Erfolgsmeldung der ersten Datei die Fortschrittsmeldung der zweiten.
   */
  const zeige = (text: string, rückfallNach?: number): void => {
    hooks.setStatus(text);
    if (rückfallTimer !== null) {
      clearTimeout(rückfallTimer);
      rückfallTimer = null;
    }
    if (rückfallNach === undefined) return;
    rückfallTimer = setTimeout(() => {
      rückfallTimer = null;
      if (offen === 0) hooks.setStatus(texts.statusInit);
    }, rückfallNach);
  };

  const meldeFehler = (kind: UploadError['kind'], file: File, cause?: unknown): void => {
    const werte = { name: file.name, maxSize: formatBytes(maxSize) };
    const vorlage =
      kind === 'too-large'
        ? texts.errorTooLarge
        : kind === 'type-not-allowed'
          ? texts.errorType
          : texts.errorFailed;
    zeige(formatText(vorlage, werte), STATUS_ERROR_MS);
    options.onError?.({ kind, file, cause });
  };

  const ladeEine = (file: File): void => {
    const fehler = validateFile(file, { maxSize, accept });
    if (fehler) {
      // Bei Ablehnung passiert im Dokument NICHTS — kein Platzhalter, kein Link.
      meldeFehler(fehler, file);
      return;
    }

    const id = nächsteId();
    const text = formatText(texts.placeholder, { name: file.name });
    // Eine bestehende Selektion wird ERSETZT, nicht umschlossen — gleiches
    // Verhalten wie beim Einfügen von Text. Bei mehreren Dateien setzt die
    // vorige Einfügung den Cursor hinter sich, sodass die zweite Datei dahinter
    // landet statt die erste zu überschreiben.
    const sel = view.state.selection.main;
    // Platzhalter und Effect in EINER Transaktion: das Feld kennt den Bereich ab
    // exakt der Transaktion, die ihn erzeugt hat — kein Fenster, in dem eine
    // dazwischenfunkende Änderung nicht mitgemappt würde.
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: text },
      effects: addPlaceholder.of({ id, from: sel.from, to: sel.from + text.length }),
      selection: { anchor: sel.from + text.length },
    });

    offen += 1;
    zeige(formatText(texts.statusUploading, { name: file.name }));

    // `Promise.resolve().then(...)` statt eines direkten Aufrufs: wirft der
    // Host-Code in `upload()` SYNCHRON statt eine abgelehnte Promise zu
    // liefern, propagierte der Fehler sonst aus `ladeEine()` heraus — der
    // Platzhalter bliebe für immer stehen, `offen` würde nie dekrementiert.
    // So wird ein synchroner Wurf zu einer Ablehnung und läuft durch den
    // bestehenden Fehlerpfad unten.
    Promise.resolve()
      .then(() => options.upload(file))
      .then(
        (url) => {
          offen -= 1;
          // AUSSCHLIESSLICH die gemappte Position — nie die beim Einfügen
          // gemerkte. Ist der Eintrag weg, hat der Nutzer den Platzhalter
          // gelöscht oder das Dokument ersetzt: dann wird NICHTS eingefügt. Ein
          // Bild, das in ein inzwischen fremdes Dokument hineinspringt, wäre
          // schlimmer als ein verlorener Upload.
          const bereich = placeholderRange(view.state, id);
          if (!bereich) return;
          view.dispatch({
            changes: { from: bereich.from, to: bereich.to, insert: imageMarkdown(file.name, url) },
            effects: removePlaceholder.of(id),
          });
          zeige(formatText(texts.statusDone, { name: file.name }), STATUS_DONE_MS);
        },
        (ursache: unknown) => {
          offen -= 1;
          const bereich = placeholderRange(view.state, id);
          if (bereich) {
            // Ersatzlos entfernen — der Platzhaltertext darf nicht im Dokument
            // stehen bleiben.
            view.dispatch({
              changes: { from: bereich.from, to: bereich.to, insert: '' },
              effects: removePlaceholder.of(id),
            });
          }
          meldeFehler('upload-failed', file, ursache);
        },
      );
  };

  const uploadFiles = (files: FileList | File[]): void => {
    if (!enabled) return;
    // Jede Datei EINZELN validieren und behandeln: eine gemischte Auswahl lädt
    // die gültigen Dateien hoch und meldet die ungültigen einzeln.
    for (const file of Array.from(files)) ladeEine(file);
  };

  /**
   * Nur der Timer. Laufende `upload()`-Promises gehören dem Host und lassen
   * sich von hier weder abbrechen noch sollten sie es — ihr Ergebnis findet
   * über den dann verschwundenen Platzhalter-Bereich ohnehin kein Ziel mehr.
   * Mehrfach aufrufbar.
   */
  const destroy = (): void => {
    if (rückfallTimer !== null) {
      clearTimeout(rückfallTimer);
      rückfallTimer = null;
    }
  };

  return { uploadFiles, accept: () => accept, isActive: () => enabled, destroy };
}

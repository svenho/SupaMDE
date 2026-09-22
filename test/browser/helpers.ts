import { afterEach, vi } from 'vitest';
import SupaMDE from '../../src/index';
import type { SupaMDEOptions } from '../../src/options';

/** Was ein Test zum Arbeiten braucht — fertig aufgelöst, damit niemand nachsucht. */
export interface Mounted {
  editor: SupaMDE;
  /** Der Container, den die Fassade um den Editor baut. */
  container: HTMLElement;
  /** Der scrollende Bereich des Editors (`.cm-scroller`). */
  scroller: HTMLElement;
  cleanup: () => void;
}

/**
 * Baut eine echte SupaMDE-Instanz auf einer Textarea am document.body und
 * wartet, bis das Layout steht.
 *
 * Bewusst NICHT der jsdom-Helfer aus src/__tests__/helpers.ts: der baut
 * EditorState/EditorView ohne Layout und ist auf die Unit-Ebene zugeschnitten.
 * Hier geht es um die vollständige Fassade samt Container, Toolbar und CSS.
 *
 * `async`, weil CodeMirror sich asynchron einmisst (`measure()`-rAF zur
 * Geometrie-Berechnung). Wer direkt nach dem Mount Geometrie misst, misst
 * sonst einen Zwischenstand — genau die Sorte Flakiness, die eine Browser-Suite
 * unbrauchbar macht.
 */
export async function mountEditor(options: SupaMDEOptions = {}): Promise<Mounted> {
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);

  const editor = new SupaMDE({ element: textarea, ...options });

  const container = editor.codemirror.dom.closest('.supamde-container');
  if (!container) throw new Error('Container .supamde-container nicht gefunden');

  const cleanup = (): void => {
    // Gürtel und Hosenträger: toTextArea() ruft intern bereits
    // fullscreen.destroy(), das den Modus verlässt. Wirft toTextArea() aber
    // vorher, bliebe fullscreenCount (MODULWEITER Zustand in
    // src/ui/fullscreen.ts) stehen und document.body.style.overflow gesperrt —
    // der nächste Test liefe auf verfälschtem Ausgangszustand.
    try {
      editor.setFullScreen(false);
      editor.toTextArea();
    } catch {
      // Schon zurückgebaut — dann ist nichts mehr zu tun.
    }
    textarea.remove();
    document.body.style.overflow = '';
  };

  await naechsterFrame();
  return {
    editor,
    container: container as HTMLElement,
    scroller: editor.codemirror.scrollDOM,
    cleanup,
  };
}

/**
 * Das gemeinsame afterEach. Einmal pro Testdatei am Kopf rufen; der Helfer
 * hält die Referenz und räumt selbst ab.
 *
 * Gibt eine `merke`-Funktion zurück, durch die der Test sein Mount durchreicht.
 */
export function registriereCleanup(): (m: Mounted) => Mounted {
  let offen: (() => void) | null = null;
  afterEach(() => {
    offen?.();
    offen = null;
  });
  return (m: Mounted): Mounted => {
    offen = m.cleanup;
    return m;
  };
}

/** Das Vorschau-Panel neben dem Editor. */
export function panelOf(mounted: Mounted): HTMLElement {
  const panel = mounted.container.querySelector('.supamde-preview-side');
  if (!panel) throw new Error('Vorschau-Panel .supamde-preview-side nicht gefunden');
  return panel as HTMLElement;
}

/** Die Editor-Zeile, die Editor und Vorschau nebeneinander legt. */
export function editorRowOf(mounted: Mounted): HTMLElement {
  const row = mounted.container.querySelector('.supamde-editor-row');
  if (!row) throw new Error('Editor-Zeile .supamde-editor-row nicht gefunden');
  return row as HTMLElement;
}

/** Ein Dokument, das sicher länger als jeder Testviewport ist. */
export function langesDokument(zeilen = 200): string {
  return Array.from({ length: zeilen }, (_, i) => `Zeile ${i + 1} mit etwas Text.`).join('\n');
}

/** Scroll-Fortschritt als Anteil, damit unterschiedliche Höhen vergleichbar sind. */
export function anteil(el: HTMLElement): number {
  const denom = el.scrollHeight - el.clientHeight;
  return denom > 0 ? el.scrollTop / denom : 0;
}

/** Wartet einen Frame ab (Guard-Reset in src/ui/preview.ts läuft per rAF). */
export function naechsterFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wartet, bis die Bedingung zutrifft. `label` landet in der Fehlermeldung —
 * ein nackter Timeout ohne Grund ist bei einem CI-Fehlschlag wertlos.
 */
export async function bisGilt(pruefung: () => boolean, label: string, ms = 2000): Promise<void> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (pruefung()) return;
    await new Promise((r) => setTimeout(r, 16));
  }
  throw new Error(`Timeout nach ${ms} ms: ${label}`);
}

/** Frist, nach der ein ausbleibendes scroll-Event als Fehler gilt (wie `bisGilt`). */
const SCROLL_TIMEOUT_MS = 2000;

/**
 * Setzt `scrollTop` und wartet das NATIVE scroll-Event ab, danach einen Frame.
 *
 * Kein `dispatchEvent(new Event('scroll'))`: im Browser feuert die Zuweisung
 * selbst ein Event (asynchron, vor dem nächsten Paint). Wer zusätzlich manuell
 * dispatcht, erzeugt ZWEI Durchläufe — der zweite trifft auf ein Guard-Flag,
 * das der zwischenzeitlich gelaufene rAF-Release schon gelöscht hat. Das
 * Ergebnis hinge dann an der Frame-Taktung.
 *
 * Der Kurzschluss muss gegen den **geklemmten** Zielwert prüfen, nicht gegen
 * den rohen: Fordert man ein Ziel über dem Maximum (z.B. 6000), aber scrollTop
 * steht bereits geklemmt am Maximum (z.B. 150), würde die Zuweisung die Wert
 * nicht ändern, das scroll-Event feuert nicht, und die Funktion hängt. Deshalb
 * vergleichen wir gegen `Math.min(ziel, scrollHeight - clientHeight)`.
 */
export async function scrolleUndWarte(el: HTMLElement, ziel: number): Promise<void> {
  // `max` kann nie negativ werden — der Browser garantiert scrollHeight >= clientHeight
  // (in Chromium für alle geprüften Geometrien verifiziert). Das äußere Math.max hält
  // die Klemmung trotzdem im gültigen Bereich, falls diese Annahme je fällt: ein negatives
  // Ziel würde der Browser auf 0 klemmen, ohne ein Event zu feuern.
  const max = Math.max(el.scrollHeight - el.clientHeight, 0);
  const geklemmtZiel = Math.round(Math.min(Math.max(ziel, 0), max));
  const istAktuell = Math.round(el.scrollTop) === geklemmtZiel;

  if (istAktuell) {
    await naechsterFrame();
    return;
  }

  let listener: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const gefeuert = new Promise<void>((resolve, reject) => {
    const handleScroll = (): void => {
      if (listener) {
        el.removeEventListener('scroll', listener);
        listener = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      resolve();
    };
    listener = handleScroll;
    el.addEventListener('scroll', listener, { once: true });

    // Timeout-Schutz: Wenn ein Event nach korrektem Kurzschluss ausbleibt,
    // deutet das auf ein echtes Problem hin (Sub-Pixel-Rundung, Browser-Bug).
    // Statt unbegrenzt zu warten (und bei CI-Fehlschlag wertlos zu sein), werfen
    // wir eine aussagekräftige Fehlermeldung.
    timeoutId = setTimeout(() => {
      if (listener) {
        el.removeEventListener('scroll', listener);
        listener = null;
      }
      timeoutId = null;
      reject(
        new Error(
          `scroll-Event feuerte nicht nach ${SCROLL_TIMEOUT_MS} ms: ` +
            `Ziel=${ziel}, scrollTop=${el.scrollTop}, max=${max}, geklemmtZiel=${geklemmtZiel}`,
        ),
      );
    }, SCROLL_TIMEOUT_MS);
  });

  el.scrollTop = geklemmtZiel;
  await gefeuert;
  // Ein Frame extra: der Sync-Handler schreibt die Gegenseite und gibt erst im
  // nächsten Frame den Guard frei (scheduleGuardReset).
  await naechsterFrame();
}

/** Scrollt auf einen Anteil der scrollbaren Strecke. */
export function scrolleAufAnteil(el: HTMLElement, wert: number): Promise<void> {
  return scrolleUndWarte(el, (el.scrollHeight - el.clientHeight) * wert);
}

/** Eine echte Bilddatei — im Browser, nicht nachgebaut wie in jsdom. */
export function bildDatei(name = 'bild.png'): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type: 'image/png' });
}

/** Ein echter DataTransfer mit Dateien — in jsdom ist `files` nicht befüllbar. */
export function datentransferMit(...files: File[]): DataTransfer {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt;
}

/**
 * Ein Upload, dessen Auflösung der Test von aussen steuert. Ersetzt das
 * handgebaute Promise-mit-externem-resolve, das sonst in jedem Upload-Test
 * neu entstünde.
 */
export function steuerbarerUpload(): {
  upload: (file: File) => Promise<string>;
  aufloesen: (url: string) => void;
  ablehnen: (grund?: unknown) => void;
} {
  let ok!: (url: string) => void;
  let fail!: (grund?: unknown) => void;
  const upload = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        ok = resolve;
        fail = reject;
      }),
  );
  return {
    upload,
    aufloesen: (url) => ok(url),
    ablehnen: (grund) => fail(grund ?? new Error('Netzwerk')),
  };
}

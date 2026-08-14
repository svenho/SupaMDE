import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createImageUploader,
  resolveUploadTexts,
  validateFile,
  imageMarkdown,
  DEFAULT_UPLOAD_ACCEPT,
  DEFAULT_UPLOAD_MAX_SIZE,
  type UploadError,
} from '../image-upload';
import { uploadPlaceholderField } from '../upload-placeholder';
import { fileOf } from '../../__tests__/helpers';

/** View mit dem Platzhalter-Feld, am Body hängend (Konvention der Suite). */
function viewOf(doc: string, cursor = doc.length): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: [uploadPlaceholderField],
    }),
    parent,
  });
}

function cleanup(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

/** Ein `upload`-Stub, dessen Promise der Test von Hand auflöst oder verwirft. */
function deferredUpload() {
  const auflöser: Array<(url: string) => void> = [];
  const verwerfer: Array<(err: unknown) => void> = [];
  const upload = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        auflöser.push(resolve);
        verwerfer.push(reject);
      }),
  );
  // `createImageUploader` ruft `options.upload()` seit dem Fix für den
  // synchronen-Wurf-Fall über `Promise.resolve().then(...)` auf — das
  // verzögert den tatsächlichen Aufruf (und damit das Füllen von `auflöser`/
  // `verwerfer`) um einen Microtask gegenüber `uploadFiles()`. `löseAuf`/
  // `verwirf` warten deshalb selbst einen Tick, bevor sie zugreifen.
  const wartenAufEintrag = async (index: number): Promise<void> => {
    while (auflöser[index] === undefined) await Promise.resolve();
  };
  return {
    upload,
    löseAuf: async (index: number, url: string) => {
      await wartenAufEintrag(index);
      auflöser[index]!(url);
    },
    verwirf: async (index: number, err: unknown) => {
      await wartenAufEintrag(index);
      verwerfer[index]!(err);
    },
  };
}

describe('resolveUploadTexts', () => {
  it('liefert die Defaults ohne Angabe', () => {
    expect(resolveUploadTexts().placeholder).toBe('![Uploading {name}…]()');
  });

  it('überschreibt einzelne Texte, der Rest bleibt Default', () => {
    const t = resolveUploadTexts({ statusDone: 'fertig' });
    expect(t.statusDone).toBe('fertig');
    expect(t.statusInit).toBe('Bild hierher ziehen oder einfügen');
  });
});

describe('validateFile', () => {
  const opts = { maxSize: 100, accept: DEFAULT_UPLOAD_ACCEPT };

  it('akzeptiert ein gültiges Bild', () => {
    expect(validateFile(fileOf('a.png', 'image/png', 50), opts)).toBeNull();
  });

  it('lehnt eine zu große Datei ab', () => {
    expect(validateFile(fileOf('a.png', 'image/png', 200), opts)).toBe('too-large');
  });

  it('lehnt einen nicht erlaubten Typ ab', () => {
    expect(validateFile(fileOf('a.pdf', 'application/pdf', 10), opts)).toBe('type-not-allowed');
  });

  it('prüft die Größe VOR dem Typ', () => {
    expect(validateFile(fileOf('a.pdf', 'application/pdf', 200), opts)).toBe('too-large');
  });

  it('erlaubt SVG (Teil der Defaults)', () => {
    expect(validateFile(fileOf('a.svg', 'image/svg+xml', 10), opts)).toBeNull();
  });

  it('respektiert eine eigene accept-Liste', () => {
    const nurPng = { maxSize: 100, accept: ['image/png'] };
    expect(validateFile(fileOf('a.jpg', 'image/jpeg', 10), nurPng)).toBe('type-not-allowed');
  });

  it('Default-maxSize ist 2 MB', () => {
    expect(DEFAULT_UPLOAD_MAX_SIZE).toBe(2 * 1024 * 1024);
  });
});

describe('imageMarkdown', () => {
  it('bettet eine gewöhnliche URL ohne Sonderzeichen unverändert ein', () => {
    expect(imageMarkdown('a.png', 'https://cdn.test/a.png')).toBe(
      '![a.png](https://cdn.test/a.png)',
    );
  });

  it('maskiert `]` im Alt-Text', () => {
    expect(imageMarkdown('a]b.png', 'https://cdn.test/a.png')).toBe(
      '![a\\]b.png](https://cdn.test/a.png)',
    );
  });

  it('setzt eine URL mit Leerzeichen in spitze Klammern', () => {
    expect(imageMarkdown('a.png', 'https://cdn.test/x y.png')).toBe(
      '![a.png](<https://cdn.test/x y.png>)',
    );
  });

  it('setzt eine URL mit Klammern in spitze Klammern', () => {
    expect(imageMarkdown('a.png', 'https://cdn.test/x(1).png')).toBe(
      '![a.png](<https://cdn.test/x(1).png>)',
    );
  });

  it('maskiert Alt-Text mit `]` UND setzt eine URL mit Leerzeichen/Klammern in spitze Klammern', () => {
    // Der im Review belegte Fall: `Screenshot (1).png` als Dateiname landet oft
    // 1:1 im Alt-Text, Leerzeichen in URLs entstehen bei jedem Backend, das den
    // Originalnamen in den Pfad übernimmt.
    expect(imageMarkdown('a]b(c).png', 'https://cdn/x y(1).png')).toBe(
      '![a\\]b(c).png](<https://cdn/x y(1).png>)',
    );
  });
});

describe('createImageUploader — Erfolgsfall', () => {
  it('fügt sofort einen Platzhalter am Cursor ein', () => {
    const view = viewOf('Text ');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    expect(view.state.doc.toString()).toBe('Text ![Uploading a.png…]()');
    cleanup(view);
  });

  it('ersetzt den Platzhalter nach Erfolg durch das fertige Bild', async () => {
    const view = viewOf('Text ');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.löseAuf(0, 'https://cdn.test/a.png');
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe('Text ![a.png](https://cdn.test/a.png)'),
    );
    cleanup(view);
  });

  it('setzt das Bild an die MITGEWANDERTE Position, wenn davor getippt wurde', async () => {
    const view = viewOf('');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    // Der Nutzer tippt VOR dem Platzhalter weiter.
    view.dispatch({ changes: { from: 0, insert: 'davor ' } });
    await d.löseAuf(0, 'u');
    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('davor ![a.png](u)'));
    cleanup(view);
  });

  it('meldet Start und Ende über die Statusbar', async () => {
    const view = viewOf('');
    const setStatus = vi.fn();
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    expect(setStatus).toHaveBeenCalledWith('Lade a.png hoch…');
    await d.löseAuf(0, 'u');
    await vi.waitFor(() => expect(setStatus).toHaveBeenCalledWith('a.png hochgeladen'));
    cleanup(view);
  });
});

describe('createImageUploader — Fehlerfall', () => {
  it('entfernt den Platzhalter ersatzlos, wenn upload wirft', async () => {
    const view = viewOf('Text ');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.verwirf(0, new Error('500'));
    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('Text '));
    cleanup(view);
  });

  it('meldet den Fehler über onError mit kind und cause', async () => {
    const view = viewOf('');
    const fehler: UploadError[] = [];
    const d = deferredUpload();
    const ursache = new Error('500');
    const u = createImageUploader(
      view,
      { enabled: true, upload: d.upload, onError: (e) => fehler.push(e) },
      { setStatus: vi.fn() },
    );
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.verwirf(0, ursache);
    await vi.waitFor(() => expect(fehler).toHaveLength(1));
    expect(fehler[0]!.kind).toBe('upload-failed');
    expect(fehler[0]!.cause).toBe(ursache);
    expect(fehler[0]!.file.name).toBe('a.png');
    cleanup(view);
  });

  it('fügt bei zu großer Datei KEINEN Platzhalter ein', () => {
    const view = viewOf('Text');
    const fehler: UploadError[] = [];
    const upload = vi.fn();
    const u = createImageUploader(
      view,
      { enabled: true, upload, maxSize: 100, onError: (e) => fehler.push(e) },
      { setStatus: vi.fn() },
    );
    u.uploadFiles([fileOf('gross.png', 'image/png', 500)]);
    expect(view.state.doc.toString()).toBe('Text');
    expect(upload).not.toHaveBeenCalled();
    expect(fehler[0]!.kind).toBe('too-large');
    cleanup(view);
  });

  it('weist Nicht-Bilder ab, statt sie als Link einzufügen', () => {
    const view = viewOf('Text');
    const fehler: UploadError[] = [];
    const upload = vi.fn();
    const u = createImageUploader(
      view,
      { enabled: true, upload, onError: (e) => fehler.push(e) },
      { setStatus: vi.fn() },
    );
    u.uploadFiles([fileOf('doc.pdf', 'application/pdf')]);
    expect(view.state.doc.toString()).toBe('Text');
    expect(upload).not.toHaveBeenCalled();
    expect(fehler[0]!.kind).toBe('type-not-allowed');
    cleanup(view);
  });

  it('behandelt einen SYNCHRONEN Wurf aus upload() wie eine Ablehnung', async () => {
    // Wirft der Host-Code synchron statt eine abgelehnte Promise zu liefern,
    // darf der Fehler NICHT aus ladeEine() herausbrechen — sonst bliebe der
    // Platzhalter für immer im Dokument stehen und die Statusanzeige hinge
    // dauerhaft auf 'Lade … hoch…'.
    const view = viewOf('Text ');
    const fehler: UploadError[] = [];
    const setStatus = vi.fn();
    const ursache = new Error('sync-boom');
    const upload = vi.fn(() => {
      throw ursache;
    });
    const u = createImageUploader(
      view,
      { enabled: true, upload, onError: (e) => fehler.push(e) },
      { setStatus },
    );
    expect(() => u.uploadFiles([fileOf('a.png', 'image/png')])).not.toThrow();
    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('Text '));
    expect(fehler[0]!.kind).toBe('upload-failed');
    expect(fehler[0]!.cause).toBe(ursache);
    await vi.waitFor(() =>
      expect(setStatus).toHaveBeenLastCalledWith('Upload von a.png fehlgeschlagen.'),
    );
    cleanup(view);
  });

  it('läuft ohne onError durch (Default ist nur die Statusbar)', () => {
    const view = viewOf('Text');
    const setStatus = vi.fn();
    const u = createImageUploader(
      view,
      { enabled: true, upload: vi.fn(), maxSize: 100 },
      { setStatus },
    );
    expect(() => u.uploadFiles([fileOf('gross.png', 'image/png', 500)])).not.toThrow();
    expect(setStatus).toHaveBeenCalledWith('gross.png ist zu groß (max. 100 B).');
    cleanup(view);
  });
});

describe('createImageUploader — mehrere Dateien', () => {
  it('ordnet korrekt zu, wenn der zweite Upload vor dem ersten fertig wird', async () => {
    const view = viewOf('');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('erste.png', 'image/png'), fileOf('zweite.png', 'image/png')]);
    expect(view.state.doc.toString()).toBe(
      '![Uploading erste.png…]()![Uploading zweite.png…]()',
    );
    await d.löseAuf(1, 'url-zwei');
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe('![Uploading erste.png…]()![zweite.png](url-zwei)'),
    );
    await d.löseAuf(0, 'url-eins');
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe('![erste.png](url-eins)![zweite.png](url-zwei)'),
    );
    cleanup(view);
  });

  it('lädt die gültigen Dateien einer gemischten Auswahl hoch', async () => {
    const view = viewOf('');
    const fehler: UploadError[] = [];
    const d = deferredUpload();
    const u = createImageUploader(
      view,
      { enabled: true, upload: d.upload, maxSize: 100, onError: (e) => fehler.push(e) },
      { setStatus: vi.fn() },
    );
    u.uploadFiles([
      fileOf('ok.png', 'image/png', 10),
      fileOf('gross.png', 'image/png', 500),
      fileOf('doc.pdf', 'application/pdf', 10),
    ]);
    expect(fehler.map((f) => f.kind)).toEqual(['too-large', 'type-not-allowed']);
    // `upload()` wird über `Promise.resolve().then(...)` gerufen — ein
    // Microtask nach `uploadFiles()`. `löseAuf` wartet das bereits ab, die
    // Aufruf-Assertion muss deshalb NACH diesem Warten geprüft werden.
    await d.löseAuf(0, 'u');
    expect(d.upload).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('![ok.png](u)'));
    cleanup(view);
  });
});

describe('createImageUploader — verschwundener Platzhalter', () => {
  it('fügt NICHTS ein, wenn der Platzhalter währenddessen gelöscht wurde', async () => {
    const view = viewOf('');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    // Der Nutzer löscht den Platzhalter von Hand.
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    await d.löseAuf(0, 'https://cdn.test/a.png');
    // Kurz laufen lassen, damit ein etwaiger Einfüge-Dispatch durchkäme.
    await Promise.resolve();
    await Promise.resolve();
    expect(view.state.doc.toString()).toBe('');
    cleanup(view);
  });

  it('fügt NICHTS ein, wenn setValue das Dokument ersetzt hat', async () => {
    const view = viewOf('alt');
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'ganz neues Dokument' } });
    await d.löseAuf(0, 'u');
    await Promise.resolve();
    await Promise.resolve();
    expect(view.state.doc.toString()).toBe('ganz neues Dokument');
    cleanup(view);
  });
});

describe('createImageUploader — Rückfall der Statusanzeige', () => {
  // Eigener Fake-Timer-Block: die übrigen Tests brauchen echte Microtasks für
  // `vi.waitFor`, hier geht es ausschließlich um die Rückfallzeiten.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fällt nach Erfolg nach 2 s auf statusInit zurück', async () => {
    const view = viewOf('');
    const setStatus = vi.fn();
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.löseAuf(0, 'u');
    await vi.advanceTimersByTimeAsync(0);
    expect(setStatus).toHaveBeenLastCalledWith('a.png hochgeladen');
    await vi.advanceTimersByTimeAsync(1999);
    expect(setStatus).toHaveBeenLastCalledWith('a.png hochgeladen');
    await vi.advanceTimersByTimeAsync(1);
    expect(setStatus).toHaveBeenLastCalledWith('Bild hierher ziehen oder einfügen');
    cleanup(view);
  });

  it('fällt nach einem Fehler erst nach 6 s zurück', async () => {
    const view = viewOf('');
    const setStatus = vi.fn();
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.verwirf(0, new Error('500'));
    await vi.advanceTimersByTimeAsync(0);
    expect(setStatus).toHaveBeenLastCalledWith('Upload von a.png fehlgeschlagen.');
    await vi.advanceTimersByTimeAsync(5999);
    expect(setStatus).toHaveBeenLastCalledWith('Upload von a.png fehlgeschlagen.');
    await vi.advanceTimersByTimeAsync(1);
    expect(setStatus).toHaveBeenLastCalledWith('Bild hierher ziehen oder einfügen');
    cleanup(view);
  });

  it('fällt NICHT zurück, solange noch ein Upload offen ist', async () => {
    const view = viewOf('');
    const setStatus = vi.fn();
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus });
    u.uploadFiles([fileOf('a.png', 'image/png'), fileOf('b.png', 'image/png')]);
    // Nur der erste ist fertig; der zweite läuft weiter.
    await d.löseAuf(0, 'u1');
    await vi.advanceTimersByTimeAsync(3000);
    // Der Einladungstext darf hier NICHT erscheinen — sonst sähe es aus, als
    // wäre nichts mehr im Gange, während b.png noch hochlädt.
    expect(setStatus).not.toHaveBeenCalledWith('Bild hierher ziehen oder einfügen');

    await d.löseAuf(1, 'u2');
    await vi.advanceTimersByTimeAsync(2000);
    expect(setStatus).toHaveBeenLastCalledWith('Bild hierher ziehen oder einfügen');
    cleanup(view);
  });

  it('destroy räumt den laufenden Rückfall-Timer ab', async () => {
    // Ohne das feuerte der Timer nach dem Rückbau des Editors gegen eine
    // zerstörte Statusbar. `setItem` wirft dort zwar nicht (es findet den Slot
    // schlicht nicht mehr), aber der Timer hielte die Closure samt View am
    // Leben und der Aufruf käme trotzdem.
    const view = viewOf('');
    const setStatus = vi.fn();
    const d = deferredUpload();
    const u = createImageUploader(view, { enabled: true, upload: d.upload }, { setStatus });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    await d.löseAuf(0, 'u');
    await vi.advanceTimersByTimeAsync(0);
    expect(setStatus).toHaveBeenLastCalledWith('a.png hochgeladen');

    u.destroy();
    setStatus.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(setStatus).not.toHaveBeenCalled();
    cleanup(view);
  });

  it('destroy ist ohne laufenden Timer folgenlos', () => {
    const view = viewOf('');
    const u = createImageUploader(
      view,
      { enabled: true, upload: vi.fn() },
      { setStatus: vi.fn() },
    );
    expect(() => {
      u.destroy();
      u.destroy();
    }).not.toThrow();
    cleanup(view);
  });
});

describe('createImageUploader — inaktiv', () => {
  it('tut nichts bei enabled: false', () => {
    const view = viewOf('Text');
    const upload = vi.fn();
    const u = createImageUploader(view, { enabled: false, upload }, { setStatus: vi.fn() });
    u.uploadFiles([fileOf('a.png', 'image/png')]);
    expect(view.state.doc.toString()).toBe('Text');
    expect(upload).not.toHaveBeenCalled();
    expect(u.isActive()).toBe(false);
    cleanup(view);
  });
});

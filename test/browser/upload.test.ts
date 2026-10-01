import { describe, it, expect, vi } from 'vitest';
import {
  mountEditor,
  registriereCleanup,
  bildDatei,
  datentransferMit,
  steuerbarerUpload,
  bisGilt,
} from './helpers';

const merke = registriereCleanup();

describe('Bild-Upload über die öffentliche API', () => {
  it('setzt einen Platzhalter und ersetzt ihn durch die Bild-Syntax', async () => {
    const { upload, aufloesen } = steuerbarerUpload();
    const m = merke(
      await mountEditor({ initialValue: '', uploadImage: { enabled: true, upload } }),
    );

    m.editor.uploadImages([bildDatei()]);
    await bisGilt(() => m.editor.getValue().includes('Uploading'), 'Platzhalter erscheint');
    expect(m.editor.getValue()).toContain('![Uploading bild.png…]()');

    aufloesen('https://example.test/bild.png');
    await bisGilt(() => m.editor.getValue().includes('example.test'), 'Platzhalter wird ersetzt');

    const text = m.editor.getValue();
    expect(text).toContain('![bild.png](https://example.test/bild.png)');
    expect(text).not.toContain('Uploading');
  });

  it('hält die Platzhalter-Position, wenn davor getippt wird', async () => {
    // Der Daseinszweck des StateField in src/features/upload-placeholder.ts.
    const { upload, aufloesen } = steuerbarerUpload();
    const m = merke(
      await mountEditor({ initialValue: 'ENDE', uploadImage: { enabled: true, upload } }),
    );

    // Cursor ans Dokumentende, dort entsteht der Platzhalter.
    const laenge = m.editor.codemirror.state.doc.length;
    m.editor.codemirror.dispatch({ selection: { anchor: laenge } });
    m.editor.uploadImages([bildDatei('x.png')]);
    await bisGilt(() => m.editor.getValue().includes('Uploading'), 'Platzhalter erscheint');

    // Jetzt VOR dem Platzhalter einfügen — die Positionen verschieben sich.
    m.editor.codemirror.dispatch({ changes: { from: 0, insert: 'NEU ' } });

    aufloesen('https://example.test/x.png');
    await bisGilt(() => m.editor.getValue().includes('example.test'), 'Platzhalter wird ersetzt');

    const text = m.editor.getValue();
    expect(text).toContain('NEU ENDE');
    expect(text).toContain('![x.png](https://example.test/x.png)');
    expect(text).not.toContain('Uploading');
  });

  it('ersetzt den Platzhalter bei Fehlschlag und meldet den Fehler', async () => {
    const { upload, ablehnen } = steuerbarerUpload();
    const onError = vi.fn();
    const m = merke(
      await mountEditor({
        initialValue: '',
        uploadImage: { enabled: true, upload, onError },
      }),
    );

    m.editor.uploadImages([bildDatei('kaputt.png')]);
    await bisGilt(() => m.editor.getValue().includes('Uploading'), 'Platzhalter erscheint');

    ablehnen(new Error('Netzwerk'));
    await bisGilt(() => !m.editor.getValue().includes('Uploading'), 'Platzhalter verschwindet');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]!.kind).toBe('upload-failed');
  });
});

describe('Drop und Paste mit echten Browser-Objekten', () => {
  it('lädt eine per Drop übergebene Bilddatei hoch', async () => {
    const upload = vi.fn(() => Promise.resolve('https://example.test/drop.png'));
    const m = merke(
      await mountEditor({ initialValue: '', uploadImage: { enabled: true, upload } }),
    );

    // Echter DataTransfer — in jsdom ist `files` nicht befüllbar und musste
    // per Objektliteral nachgebaut werden (siehe upload-dom.test.ts:13).
    const dt = datentransferMit(bildDatei('drop.png'));
    expect(dt.files.length).toBe(1);

    m.editor.codemirror.contentDOM.dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
    );

    await bisGilt(() => m.editor.getValue().includes('example.test'), 'Drop-Upload landet im Text');
    expect(m.editor.getValue()).toContain('![drop.png](https://example.test/drop.png)');
  });

  it('lädt eine per Paste übergebene Bilddatei hoch', async () => {
    const upload = vi.fn(() => Promise.resolve('https://example.test/paste.png'));
    const m = merke(
      await mountEditor({ initialValue: '', uploadImage: { enabled: true, upload } }),
    );

    const dt = datentransferMit(bildDatei('paste.png'));

    m.editor.codemirror.contentDOM.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );

    await bisGilt(() => m.editor.getValue().includes('example.test'), 'Paste-Upload landet im Text');
    expect(m.editor.getValue()).toContain('![paste.png](https://example.test/paste.png)');
  });
});

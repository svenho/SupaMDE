import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { imageFilesFrom, uploadDropPasteExtension, openFilePicker } from '../upload-dom';
import { fileOf } from '../../__tests__/helpers';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/**
 * Synthetischer DataTransfer. jsdom kennt den Konstruktor, aber `files` ist dort
 * nicht befüllbar — deshalb ein Objektliteral mit genau den Feldern, die der
 * Code liest.
 */
function transferMit(files: File[], text = ''): DataTransfer {
  return {
    files: files as unknown as FileList,
    items: files.map((f) => ({ kind: 'file', type: f.type })),
    getData: () => text,
    types: files.length > 0 ? ['Files'] : ['text/plain'],
  } as unknown as DataTransfer;
}

describe('imageFilesFrom', () => {
  it('liefert die enthaltenen Bilddateien', () => {
    const files = imageFilesFrom(transferMit([fileOf('a.png', 'image/png')]));
    expect(files.map((f) => f.name)).toEqual(['a.png']);
  });

  it('liefert eine leere Liste ohne Dateien', () => {
    expect(imageFilesFrom(transferMit([], 'nur Text'))).toEqual([]);
  });

  it('liefert eine leere Liste bei null', () => {
    expect(imageFilesFrom(null)).toEqual([]);
  });

  it('filtert Nicht-Bilder heraus', () => {
    const files = imageFilesFrom(
      transferMit([fileOf('a.png', 'image/png'), fileOf('b.pdf', 'application/pdf')]),
    );
    expect(files.map((f) => f.name)).toEqual(['a.png']);
  });
});

describe('uploadDropPasteExtension', () => {
  function viewMit(onFiles: (files: File[]) => void): EditorView {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    return new EditorView({
      state: EditorState.create({ doc: '', extensions: [uploadDropPasteExtension(onFiles)] }),
      parent,
    });
  }

  it('fängt einen Drop mit Bilddateien ab', () => {
    const onFiles = vi.fn();
    const view = viewMit(onFiles);
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: transferMit([fileOf('a.png', 'image/png')]),
    });
    view.contentDOM.dispatchEvent(event);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    view.destroy();
  });

  it('lässt einen reinen Text-Drop unverändert durchlaufen', () => {
    const onFiles = vi.fn();
    const view = viewMit(onFiles);
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: transferMit([], 'Hallo') });
    view.contentDOM.dispatchEvent(event);
    // Nur DASS der Upload nicht anspringt, ist hier prüfbar. `defaultPrevented`
    // wäre kein Maß: CM6 behandelt einen Text-Drop selbst und ruft dabei
    // `preventDefault()` — das misst CM6, nicht diesen Handler.
    expect(onFiles).not.toHaveBeenCalled();
    view.destroy();
  });

  it('fängt ein Paste mit Bilddateien ab', () => {
    const onFiles = vi.fn();
    const view = viewMit(onFiles);
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
      value: transferMit([fileOf('screenshot.png', 'image/png')]),
    });
    view.contentDOM.dispatchEvent(event);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    view.destroy();
  });

  it('lässt ein reines Text-Paste unverändert durchlaufen', () => {
    const onFiles = vi.fn();
    const view = viewMit(onFiles);
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: transferMit([], 'Hallo') });
    view.contentDOM.dispatchEvent(event);
    // Wie beim Text-Drop: `defaultPrevented` misst hier CM6s eigenes
    // Paste-Handling, nicht diesen Handler.
    expect(onFiles).not.toHaveBeenCalled();
    view.destroy();
  });
});

describe('openFilePicker', () => {
  it('erzeugt einen Input mit accept und multiple', () => {
    let erzeugt: HTMLInputElement | null = null;
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag === 'input') erzeugt = el as HTMLInputElement;
      return el;
    });
    openFilePicker(['image/png', 'image/jpeg'], vi.fn());
    expect(erzeugt!.type).toBe('file');
    expect(erzeugt!.multiple).toBe(true);
    expect(erzeugt!.accept).toBe('image/png,image/jpeg');
  });

  it('meldet die gewählten Dateien und räumt den Input wieder ab', () => {
    let erzeugt: HTMLInputElement | null = null;
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag === 'input') erzeugt = el as HTMLInputElement;
      return el;
    });
    const onFiles = vi.fn();
    openFilePicker(['image/png'], onFiles);

    const datei = fileOf('a.png', 'image/png');
    Object.defineProperty(erzeugt!, 'files', { value: [datei] as unknown as FileList });
    erzeugt!.dispatchEvent(new Event('change'));

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]![0]![0].name).toBe('a.png');
    expect(erzeugt!.isConnected).toBe(false);
  });

  it('räumt den Input auch bei Abbruch im Dateidialog ab', () => {
    // Klickt der Nutzer im Systemdialog auf "Abbrechen", feuert `change` NICHT.
    // Ohne eigenes Aufräumen bliebe der versteckte Input für immer im Body und
    // sammelte sich bei jedem weiteren Klick auf den Toolbar-Button an.
    let erzeugt: HTMLInputElement | null = null;
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag === 'input') erzeugt = el as HTMLInputElement;
      return el;
    });
    const onFiles = vi.fn();
    openFilePicker(['image/png'], onFiles);

    erzeugt!.dispatchEvent(new Event('cancel'));

    expect(onFiles).not.toHaveBeenCalled();
    expect(erzeugt!.isConnected).toBe(false);
  });

  it('hinterlässt nach mehreren Aufrufen keine Input-Leichen im Body', () => {
    // Der Summentest: Egal ob Erfolg oder Abbruch — nach jedem Durchlauf ist der
    // Body so leer wie vorher.
    const onFiles = vi.fn();
    openFilePicker(['image/png'], onFiles);
    document.querySelector('input[type="file"]')!.dispatchEvent(new Event('cancel'));
    openFilePicker(['image/png'], onFiles);
    document.querySelector('input[type="file"]')!.dispatchEvent(new Event('cancel'));

    expect(document.querySelectorAll('input[type="file"]').length).toBe(0);
  });
});

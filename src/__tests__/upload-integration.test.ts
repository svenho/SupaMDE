import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupaMDE } from '../index';
import { fileOf } from './helpers';

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function editorMit(upload: (file: File) => Promise<string>, extra = {}): SupaMDE {
  return new SupaMDE({
    element: textarea,
    status: ['upload-image'],
    toolbar: ['bold', 'upload-image'],
    uploadImage: { enabled: true, upload, ...extra },
  });
}

describe('SupaMDE — Upload-Verdrahtung', () => {
  it('uploadImages fügt Platzhalter und danach das Bild ein', async () => {
    const editor = editorMit(async () => 'https://cdn.test/a.png');
    editor.uploadImages([fileOf('a.png', 'image/png')]);
    expect(editor.getValue()).toBe('![Uploading a.png…]()');
    await vi.waitFor(() => expect(editor.getValue()).toBe('![a.png](https://cdn.test/a.png)'));
    editor.toTextArea();
  });

  it('zeigt den Einladungstext von Anfang an', () => {
    const editor = editorMit(async () => 'u');
    const slot = document.querySelector('.supamde-status-upload-image')!;
    expect(slot.textContent).toBe('Bild hierher ziehen oder einfügen');
    editor.toTextArea();
  });

  it('schreibt die Upload-Meldung in die Statusbar', async () => {
    const editor = editorMit(async () => 'u');
    editor.uploadImages([fileOf('a.png', 'image/png')]);
    const slot = document.querySelector('.supamde-status-upload-image')!;
    expect(slot.textContent).toBe('Lade a.png hoch…');
    await vi.waitFor(() => expect(slot.textContent).toBe('a.png hochgeladen'));
    editor.toTextArea();
  });

  it('rendert den Button NICHT, wenn der Upload deaktiviert ist', () => {
    const editor = new SupaMDE({
      element: textarea,
      toolbar: ['bold', 'upload-image'],
      uploadImage: { enabled: false, upload: async () => 'u' },
    });
    expect(document.querySelector('[data-action="upload-image"]')).toBeNull();
    expect(document.querySelector('[data-action="bold"]')).not.toBeNull();
    editor.toTextArea();
  });

  it('lässt die übergebene toolbar-Liste unverändert, WÄHREND sie gefiltert wird', () => {
    // Der interessante Fall ist der, in dem der Filter tatsächlich greift:
    // Upload aus, `'upload-image'` in der Liste. Der Button verschwindet aus dem
    // DOM, die übergebene Liste bleibt aber unangetastet (Global Constraint:
    // Options-Objekte werden nie mutiert).
    const liste = ['bold', 'upload-image'];
    const editor = new SupaMDE({
      element: textarea,
      toolbar: liste,
      uploadImage: { enabled: false, upload: async () => 'u' },
    });
    expect(document.querySelector('[data-action="upload-image"]')).toBeNull();
    expect(liste).toEqual(['bold', 'upload-image']);
    editor.toTextArea();
  });

  it('lässt die toolbar-Liste auch bei aktivem Upload unverändert', () => {
    const liste = ['bold', 'upload-image'];
    const editor = new SupaMDE({
      element: textarea,
      toolbar: liste,
      uploadImage: { enabled: true, upload: async () => 'u' },
    });
    expect(document.querySelector('[data-action="upload-image"]')).not.toBeNull();
    expect(liste).toEqual(['bold', 'upload-image']);
    editor.toTextArea();
  });

  it('warnt einmal, wenn Upload aktiv ist, aber weder Statusbar-Item noch onError', () => {
    // Ohne beides ist der Upload vollständig stumm: keine Fortschrittsmeldung,
    // keine Fehlermeldung. Das ist eine gültige Konfiguration, aber fast nie
    // gewollt — deshalb genau eine Warnung, nicht mehr.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = new SupaMDE({
      element: textarea,
      uploadImage: { enabled: true, upload: async () => 'u' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('upload-image');
    editor.toTextArea();
  });

  it('warnt NICHT, wenn das Statusbar-Item vorhanden ist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = editorMit(async () => 'u');
    expect(warn).not.toHaveBeenCalled();
    editor.toTextArea();
  });

  it('warnt NICHT, wenn onError gesetzt ist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = new SupaMDE({
      element: textarea,
      uploadImage: { enabled: true, upload: async () => 'u', onError: () => {} },
    });
    expect(warn).not.toHaveBeenCalled();
    editor.toTextArea();
  });

  it('toTextArea räumt den Rückfall-Timer des Uploaders ab', async () => {
    // Ohne `uploader.destroy()` in `toTextArea()` liefe der Rückfall-Timer nach
    // dem Rückbau weiter und schriebe gegen eine zerstörte Statusbar.
    //
    // Gemessen wird über den Statusbar-Slot, NICHT über `vi.getTimerCount()`:
    // Der zählt alle offenen Fake-Timer im Prozess, auch die von CM6 selbst —
    // eine Zusicherung darauf prüfte fremden Code mit.
    vi.useFakeTimers();
    try {
      const editor = editorMit(async () => 'u');
      const slot = document.querySelector('.supamde-status-upload-image')!;
      editor.uploadImages([fileOf('a.png', 'image/png')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(slot.textContent).toBe('a.png hochgeladen');

      editor.toTextArea();
      const beimRückbau = slot.textContent;

      // Der abgeräumte Slot hängt nicht mehr im Dokument; feuerte der Timer
      // trotzdem, änderte sich sein Inhalt hier noch einmal.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(slot.textContent).toBe(beimRückbau);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ein Drop mit Bilddatei startet den Upload', async () => {
    const editor = editorMit(async () => 'u');
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [fileOf('drop.png', 'image/png')] as unknown as FileList,
        getData: () => '',
        types: ['Files'],
      },
    });
    editor.codemirror.contentDOM.dispatchEvent(event);
    await vi.waitFor(() => expect(editor.getValue()).toBe('![drop.png](u)'));
    editor.toTextArea();
  });

  it('ein Paste mit Bilddatei startet den Upload', async () => {
    const editor = editorMit(async () => 'u');
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [fileOf('shot.png', 'image/png')] as unknown as FileList,
        getData: () => '',
        types: ['Files'],
      },
    });
    editor.codemirror.contentDOM.dispatchEvent(event);
    await vi.waitFor(() => expect(editor.getValue()).toBe('![shot.png](u)'));
    editor.toTextArea();
  });

  it('der Toolbar-Button öffnet die Dateiauswahl', () => {
    const editor = editorMit(async () => 'u');
    const geöffnet = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const btn = document.querySelector<HTMLButtonElement>('[data-action="upload-image"]')!;
    btn.click();
    expect(geöffnet).toHaveBeenCalledTimes(1);
    editor.toTextArea();
  });

  it('openBrowseFileWindow funktioniert auch ohne Toolbar', () => {
    const editor = new SupaMDE({
      element: textarea,
      toolbar: false,
      uploadImage: { enabled: true, upload: async () => 'u' },
    });
    const geöffnet = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    expect(() => editor.openBrowseFileWindow()).not.toThrow();
    expect(geöffnet).toHaveBeenCalledTimes(1);
    editor.toTextArea();
  });

  it('tut ohne uploadImage-Option nichts', () => {
    const editor = new SupaMDE({ element: textarea });
    editor.uploadImages([fileOf('a.png', 'image/png')]);
    expect(editor.getValue()).toBe('');
    editor.toTextArea();
  });

  it('DEFAULT_TOOLBAR enthält upload-image nicht', () => {
    const editor = new SupaMDE({
      element: textarea,
      uploadImage: { enabled: true, upload: async () => 'u' },
    });
    expect(document.querySelector('[data-action="upload-image"]')).toBeNull();
    editor.toTextArea();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupaMDE } from '../index';
import { createMemoryStorage, type SupaStorage } from '../features/storage';

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  vi.useFakeTimers();
  textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function editorMit(doc: string, storage: SupaStorage, extra = {}): SupaMDE {
  textarea.value = doc;
  return new SupaMDE({
    element: textarea,
    status: ['autosave'],
    autosave: { enabled: true, key: 'doc', storage, ...extra },
  });
}

describe('SupaMDE — Autosave-Verdrahtung', () => {
  it('speichert den Inhalt nach der Debounce-Zeit', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0); // start() ist async

    editor.setValue('Getippter Text');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await storage.load('doc')).toBe('Getippter Text');
    editor.toTextArea();
  });

  it('zeigt den Speicherzeitpunkt in der Statusbar', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0);

    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(1000);
    const slot = document.querySelector('.supamde-status-autosave')!;
    // Die Locale der Testumgebung ist `en-US`, dort formatiert `Intl` als
    // `02:03 PM`. Das ist gewollt — SupaMDE erzwingt kein 24-Stunden-Format,
    // sondern folgt der Umgebung. Der Test prüft deshalb Präfix und Zeitanteil,
    // nicht den Stundenzyklus.
    expect(slot.textContent).toMatch(/^Gespeichert: \d{1,2}:\d{2}( (AM|PM))?$/);
    editor.toTextArea();
  });

  it('der Statusbar-Text überlebt die nächste Änderung', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0);

    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(1000);
    const vorher = document.querySelector('.supamde-status-autosave')!.textContent;
    editor.setValue('xy');
    expect(document.querySelector('.supamde-status-autosave')!.textContent).toBe(vorher);
    editor.toTextArea();
  });

  it('stellt einen gespeicherten Entwurf beim Start wieder her', async () => {
    const storage = createMemoryStorage();
    await storage.save('doc', 'Entwurf von gestern');
    const onRestore = vi.fn();
    const editor = editorMit('Textarea-Inhalt', storage, { onRestore });
    await vi.advanceTimersByTimeAsync(0);

    expect(editor.getValue()).toBe('Entwurf von gestern');
    expect(onRestore).toHaveBeenCalledWith('Entwurf von gestern');
    editor.toTextArea();
  });

  it('ein setValue direkt nach der Konstruktion gewinnt gegen den Entwurf', async () => {
    // Der Realfall: Der Host lädt den Inhalt nach und setzt ihn sofort. `start()`
    // ist async und käme erst danach zum Zug — ohne den Ausgangswert-Vergleich in
    // `autosave.ts` überschriebe der Entwurf den frisch gesetzten Wert.
    const storage = createMemoryStorage();
    await storage.save('doc', 'Entwurf von gestern');
    const onRestore = vi.fn();
    const editor = editorMit('Textarea-Inhalt', storage, { onRestore });

    // VOR dem Auflösen von start() — genau das Zeitfenster, um das es geht.
    editor.setValue('Vom Host nachgeladen');
    await vi.advanceTimersByTimeAsync(0);

    expect(editor.getValue()).toBe('Vom Host nachgeladen');
    expect(onRestore).not.toHaveBeenCalled();
    editor.toTextArea();
  });

  it('isAutosaveActive meldet den Zustand', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0);
    expect(editor.isAutosaveActive()).toBe(true);
    editor.toTextArea();
  });

  it('ist ohne autosave-Option inaktiv und speichert nichts', async () => {
    textarea.value = '';
    const editor = new SupaMDE({ element: textarea });
    await vi.advanceTimersByTimeAsync(0);
    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(5000);
    expect(editor.isAutosaveActive()).toBe(false);
    editor.toTextArea();
  });

  it('clearAutosavedValue löscht den Eintrag und stoppt den Timer', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0);

    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await storage.load('doc')).toBe('x');

    editor.setValue('xy');
    await editor.clearAutosavedValue();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await storage.load('doc')).toBeNull();
    editor.toTextArea();
  });

  it('toTextArea räumt den Timer ab, der gespeicherte Wert bleibt', async () => {
    const storage = createMemoryStorage();
    const editor = editorMit('', storage);
    await vi.advanceTimersByTimeAsync(0);

    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(1000);
    editor.setValue('xy');
    editor.toTextArea();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await storage.load('doc')).toBe('x');
  });
});

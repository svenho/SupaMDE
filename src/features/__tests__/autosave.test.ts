import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosave, type AutosaveOptions } from '../autosave';
import { createMemoryStorage, type SupaStorage } from '../storage';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Baut Autosave über einem Doc-String, den die Hooks lesen und schreiben. */
function setup(
  doc: string,
  options: Partial<AutosaveOptions> & { storage?: SupaStorage } = {},
) {
  let wert = doc;
  const onSaved = vi.fn();
  const storage = options.storage ?? createMemoryStorage();
  const autosave = createAutosave(
    { enabled: true, key: 'doc', storage, ...options },
    {
      getValue: () => wert,
      setValue: (v) => {
        wert = v;
      },
      onSaved,
    },
  );
  return {
    autosave,
    storage,
    onSaved,
    get wert() {
      return wert;
    },
    tippe(neu: string) {
      wert = neu;
      autosave.schedule();
    },
    /**
     * Änderung von außen OHNE `schedule()` — genau das, was ein Host-seitiges
     * `editor.setValue()` auslöst: Das Dokument ändert sich, ohne dass Autosave
     * davon einen Debounce startet.
     */
    setzeVonAussen(neu: string) {
      wert = neu;
    },
  };
}

describe('createAutosave — Debounce', () => {
  it('speichert erst nach Ablauf der Verzögerung', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('Hallo');
    expect(await s.storage.load('doc')).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await s.storage.load('doc')).toBe('Hallo');
  });

  it('feuert einmal, nicht pro Tastendruck', async () => {
    const s = setup('');
    await s.autosave.start();
    const save = vi.spyOn(s.storage, 'save');
    s.tippe('H');
    await vi.advanceTimersByTimeAsync(500);
    s.tippe('Ha');
    await vi.advanceTimersByTimeAsync(500);
    s.tippe('Hal');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await s.storage.load('doc')).toBe('Hal');
  });

  it('respektiert eine eigene delay-Angabe', async () => {
    const s = setup('', { delay: 250 });
    await s.autosave.start();
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(249);
    expect(await s.storage.load('doc')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(await s.storage.load('doc')).toBe('x');
  });

  it('meldet jedes erfolgreiche Speichern über onSaved', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.onSaved).toHaveBeenCalledTimes(1);
    expect(s.onSaved.mock.calls[0]![0]).toBeInstanceOf(Date);
  });
});

describe('createAutosave — leerer Inhalt', () => {
  it('löscht den Eintrag statt einen leeren String zu speichern', async () => {
    const s = setup('Text');
    await s.autosave.start();
    s.tippe('Text');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await s.storage.load('doc')).toBe('Text');

    s.tippe('');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await s.storage.load('doc')).toBeNull();
  });

  it('behandelt reinen Whitespace als leer', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('   \n  ');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await s.storage.load('doc')).toBeNull();
  });
});

describe('createAutosave — Restore', () => {
  it('stellt einen gespeicherten Entwurf beim Start wieder her', async () => {
    const storage = createMemoryStorage();
    await storage.save('doc', 'Entwurf von gestern');
    const onRestore = vi.fn();
    const s = setup('Ausgangsinhalt', { storage, onRestore });
    await s.autosave.start();
    expect(s.wert).toBe('Entwurf von gestern');
    expect(onRestore).toHaveBeenCalledWith('Entwurf von gestern');
  });

  it('ruft onRestore NICHT, wenn der Stand dem Dokument gleicht', async () => {
    const storage = createMemoryStorage();
    await storage.save('doc', 'gleich');
    const onRestore = vi.fn();
    const s = setup('gleich', { storage, onRestore });
    await s.autosave.start();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('stellt nichts wieder her, wenn nichts gespeichert ist', async () => {
    const onRestore = vi.fn();
    const s = setup('Ausgangsinhalt', { onRestore });
    await s.autosave.start();
    expect(s.wert).toBe('Ausgangsinhalt');
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('stellt einen leeren gespeicherten String NICHT über befüllten Inhalt', async () => {
    const storage = createMemoryStorage();
    await storage.save('doc', '');
    const onRestore = vi.fn();
    const s = setup('Ausgangsinhalt', { storage, onRestore });
    await s.autosave.start();
    expect(s.wert).toBe('Ausgangsinhalt');
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('stellt NICHTS wieder her, wenn das Dokument seit der Erzeugung geändert wurde', async () => {
    // Der reale Fall: Der Host ruft direkt nach `new SupaMDE(...)` ein
    // `setValue()`. `start()` ist async und käme erst danach zum Zug — ohne
    // diese Prüfung überschriebe der Entwurf den frisch gesetzten Wert.
    const storage = createMemoryStorage();
    await storage.save('doc', 'Entwurf von gestern');
    const onRestore = vi.fn();
    const s = setup('Ausgangsinhalt', { storage, onRestore });

    // Host-Änderung VOR dem Auflösen von start().
    s.setzeVonAussen('Vom Host nachgeladen');
    await s.autosave.start();

    expect(s.wert).toBe('Vom Host nachgeladen');
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('speichert nach einer Host-Änderung ganz normal weiter', async () => {
    // Der unterdrückte Restore darf Autosave nicht lahmlegen — nur die
    // Wiederherstellung entfällt, das Speichern läuft.
    const storage = createMemoryStorage();
    await storage.save('doc', 'Entwurf von gestern');
    const s = setup('Ausgangsinhalt', { storage });
    s.setzeVonAussen('Vom Host nachgeladen');
    await s.autosave.start();

    expect(s.autosave.isActive()).toBe(true);
    s.tippe('Vom Host nachgeladen, dann getippt');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await storage.load('doc')).toBe('Vom Host nachgeladen, dann getippt');
  });
});

describe('createAutosave — clear und stop', () => {
  it('clear löscht den Eintrag', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(1000);
    await s.autosave.clear();
    expect(await s.storage.load('doc')).toBeNull();
  });

  it('clear stoppt den Timer — die laufende Änderung schreibt nicht zurück', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('x');
    await s.autosave.clear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await s.storage.load('doc')).toBeNull();
  });

  it('stop räumt den Timer ab, der gespeicherte Wert bleibt', async () => {
    const s = setup('');
    await s.autosave.start();
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(1000);
    s.tippe('xy');
    s.autosave.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await s.storage.load('doc')).toBe('x');
  });
});

describe('createAutosave — inaktive Fälle', () => {
  it('ist inaktiv bei enabled: false', async () => {
    const s = setup('', { enabled: false });
    await s.autosave.start();
    expect(s.autosave.isActive()).toBe(false);
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await s.storage.load('doc')).toBeNull();
  });

  it('warnt genau einmal bei fehlendem key und bleibt aus', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup('', { key: '' });
    await s.autosave.start();
    s.tippe('x');
    await vi.advanceTimersByTimeAsync(5000);
    s.tippe('y');
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.autosave.isActive()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('deaktiviert sich still, wenn der Speicher nicht verfügbar ist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kaputt = {
      load: () => null,
      save: () => {
        throw new Error('QuotaExceededError');
      },
      clear: () => {},
    };
    const s = setup('', { storage: kaputt });
    await s.autosave.start();
    expect(s.autosave.isActive()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warnt bei einem Wurf im laufenden Betrieb nur einmal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let probeVorbei = false;
    const kippt: SupaStorage = {
      load: () => (probeVorbei ? null : '1'),
      save: (_key, _value) => {
        if (probeVorbei) throw new Error('QuotaExceededError');
      },
      clear: () => {},
    };
    const s = setup('', { storage: kippt });
    await s.autosave.start();
    expect(s.autosave.isActive()).toBe(true);
    probeVorbei = true;

    s.tippe('x');
    await vi.advanceTimersByTimeAsync(1000);
    s.tippe('xy');
    await vi.advanceTimersByTimeAsync(1000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(s.autosave.isActive()).toBe(false);
  });
});

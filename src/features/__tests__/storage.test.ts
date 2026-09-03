import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLocalStorage, createMemoryStorage, isStorageAvailable } from '../storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('createMemoryStorage', () => {
  it('speichert und liest denselben Wert zurück', async () => {
    const s = createMemoryStorage();
    await s.save('doc', 'Hallo');
    expect(await s.load('doc')).toBe('Hallo');
  });

  it('liefert null für einen unbekannten Key', async () => {
    const s = createMemoryStorage();
    expect(await s.load('gibtsnicht')).toBeNull();
  });

  it('clear entfernt den Eintrag', async () => {
    const s = createMemoryStorage();
    await s.save('doc', 'Hallo');
    await s.clear('doc');
    expect(await s.load('doc')).toBeNull();
  });

  it('trennt verschiedene Keys', async () => {
    const s = createMemoryStorage();
    await s.save('a', 'eins');
    await s.save('b', 'zwei');
    expect(await s.load('a')).toBe('eins');
    expect(await s.load('b')).toBe('zwei');
  });
});

describe('createLocalStorage', () => {
  it('schreibt unter dem Prefix supamde:', async () => {
    const s = createLocalStorage();
    await s.save('doc', 'Hallo');
    expect(localStorage.getItem('supamde:doc')).toBe('Hallo');
  });

  it('liest den Wert zurück', async () => {
    const s = createLocalStorage();
    await s.save('doc', 'Hallo');
    expect(await s.load('doc')).toBe('Hallo');
  });

  it('clear entfernt den Eintrag samt Prefix', async () => {
    const s = createLocalStorage();
    await s.save('doc', 'Hallo');
    await s.clear('doc');
    expect(localStorage.getItem('supamde:doc')).toBeNull();
  });

  it('akzeptiert ein eigenes Prefix', async () => {
    const s = createLocalStorage('meins:');
    await s.save('doc', 'x');
    expect(localStorage.getItem('meins:doc')).toBe('x');
  });
});

describe('isStorageAvailable', () => {
  it('liefert true für einen funktionierenden Speicher', async () => {
    expect(await isStorageAvailable(createMemoryStorage())).toBe(true);
  });

  it('liefert false, wenn save wirft (Quota, Private Mode)', async () => {
    const werfend = {
      load: () => null,
      save: () => {
        throw new Error('QuotaExceededError');
      },
      clear: () => {},
    };
    expect(await isStorageAvailable(werfend)).toBe(false);
  });

  it('liefert false, wenn load wirft', async () => {
    const werfend = {
      load: () => {
        throw new Error('SecurityError');
      },
      save: () => {},
      clear: () => {},
    };
    expect(await isStorageAvailable(werfend)).toBe(false);
  });

  it('räumt die Probe wieder ab', async () => {
    const s = createLocalStorage();
    await isStorageAvailable(s);
    const übrig = Object.keys(localStorage).filter((k) => k.startsWith('supamde:'));
    expect(übrig).toEqual([]);
  });

  it('liefert false, wenn der echte localStorage bei setItem wirft (Quota)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(await isStorageAvailable(createLocalStorage())).toBe(false);
  });

  it('liefert false, wenn der echte localStorage bei getItem wirft (Private Mode)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError', 'SecurityError');
    });
    expect(await isStorageAvailable(createLocalStorage())).toBe(false);
  });
});

/**
 * Der Speicher-Vertrag des Autosave. Async-fähig, damit ein Server-Backend oder
 * IndexedDB ohne Zusatzschicht passt — die eingebaute localStorage-Variante ist
 * synchron, SupaMDE behandelt beide Fälle über `await` gleich.
 */
export interface SupaStorage {
  load(key: string): string | null | Promise<string | null>;
  save(key: string, value: string): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}

/** Default-Prefix im localStorage: Einträge liegen unter `supamde:<key>`. */
export const STORAGE_PREFIX = 'supamde:';

/** localStorage-Implementierung. Synchron; wirft bei Quota/Private Mode durch. */
export function createLocalStorage(prefix: string = STORAGE_PREFIX): SupaStorage {
  const full = (key: string): string => `${prefix}${key}`;
  return {
    load: (key) => localStorage.getItem(full(key)),
    save: (key, value) => {
      localStorage.setItem(full(key), value);
    },
    clear: (key) => {
      localStorage.removeItem(full(key));
    },
  };
}

/**
 * In-Memory-Speicher. Primär als Testdouble gedacht, aber auch als bewusste
 * Host-Wahl brauchbar ("nur für diese Sitzung merken").
 */
export function createMemoryStorage(): SupaStorage {
  const map = new Map<string, string>();
  return {
    load: (key) => map.get(key) ?? null,
    save: (key, value) => {
      map.set(key, value);
    },
    clear: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Probe-Schreibvorgang: schreibt einen Wegwerf-Eintrag, liest ihn zurück und
 * räumt ihn wieder ab. Fängt JEDEN Wurf — im Private Mode wirft schon der
 * Zugriff auf `localStorage`, nicht erst `setItem`.
 *
 * Wichtig: Die Verfügbarkeit ist nur die halbe Miete. Der spätere `save()` mit
 * echtem Inhalt läuft trotzdem in `try/catch` (siehe `autosave.ts`) — easyMDE
 * prüfte nur mit einem Ein-Byte-Probeschreiben und ließ die echte
 * Quota-Exception beim Speichern großer Inhalte ungefangen durchschlagen.
 */
export async function isStorageAvailable(storage: SupaStorage): Promise<boolean> {
  const probe = '__supamde_probe__';
  try {
    await storage.save(probe, '1');
    const wert = await storage.load(probe);
    await storage.clear(probe);
    return wert === '1';
  } catch {
    return false;
  }
}

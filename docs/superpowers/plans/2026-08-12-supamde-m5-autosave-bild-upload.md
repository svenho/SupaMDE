# SupaMDE M5 — Autosave & Bild-Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SupaMDE bekommt Autosave (Debounce, Restore, austauschbarer Speicher) und Bild-Upload (Drag & Drop, Paste, Dateiauswahl) mit positionsstabilen Platzhaltern.

**Architecture:** Vier neue Module in `src/features/`. `storage.ts` kapselt die einzige Außenweltberührung des Autosave hinter dem `SupaStorage`-Interface, `autosave.ts` enthält Debounce-/Restore-Logik als reine, gegen einen In-Memory-Speicher testbare Einheit. `upload-placeholder.ts` ist der einzige echte CM6-Anteil: ein `StateField`, das offene Platzhalter über `tr.changes` mitmappt — die Ersetzung nach dem Upload nutzt **ausschließlich** diese gemappten Positionen. `image-upload.ts` orchestriert Validierung → Platzhalter → `upload()` → Ersetzung. Die Fassade in `src/index.ts` verdrahtet beides dünn.

**Tech Stack:** TypeScript (strict, ESM-only), CodeMirror 6 (`@codemirror/state`, `@codemirror/view`), Vitest + jsdom mit Fake-Timers, lucide für Icons.

**Spec:** [2026-08-11-supamde-m5-features-design.md](../specs/2026-08-11-supamde-m5-features-design.md)

## Global Constraints

- **Sprache:** Alle Kommentare, Doc-Kommentare und Testbeschreibungen auf Deutsch. Bezeichner im Code auf Englisch (bestehende Konvention).
- **Keine easyMDE-Drop-in-Kompatibilität für M5.** Optionsnamen, Optionsstruktur und Methodensignaturen werden frei entworfen (Spec §1.1). Die in M1–M4 umgesetzte API bleibt **unverändert**.
- **Beide Features sind per Default aus.** `autosave.enabled` und `uploadImage.enabled` haben Default `false`. Ohne explizite Option ändert sich am bestehenden Verhalten nichts.
- **`DEFAULT_TOOLBAR` wird NICHT verändert.** Der Button `'upload-image'` ist nur verfügbar, wenn er in der `toolbar`-Option steht.
- **`DEFAULT_STATUS` wird NICHT verändert.** Das Statusbar-Item `'upload-image'` ist nur verfügbar, wenn es in der `status`-Option steht.
- **Kein HTTP-Client, kein Endpoint, kein CSRF, kein Response-Format, kein Upload-Timeout, kein `alert()`.** Die Grenze zur Außenwelt sind exakt `SupaStorage` und `upload()` (Spec §8).
- **Anzeige immer über `textContent`, nie `innerHTML`** (XSS-Fläche, Spec §3.5).
- **Options-Objekte werden nie mutiert.** `this.options` bleibt unberührt (Spec §3.5).
- **Testlauf:** `npm run test:run` (einmalig) bzw. `npx vitest run <pfad>` für eine Datei. `npm test` startet den Watch-Modus und blockiert — in Skripten nicht verwenden.
- **Vor jedem Commit:** `npm run lint` und `npm run typecheck` müssen grün sein.
- **Views in Tests immer abräumen** — `cleanup(view)` aus `src/__tests__/helpers.ts` oder `view.destroy()`. Bestehende Konvention in allen `__tests__`-Dateien.
- **Fake-Timer-Tests** immer mit `vi.useFakeTimers()` im `beforeEach` und `vi.useRealTimers()` im `afterEach` — sonst leckt der Fake-Timer in andere Testdateien.
- **Keine neuen npm-Pakete.** Alles wird mit den vorhandenen Dependencies gebaut.

## Drei Befunde aus der Bestandsaufnahme

Die Spec setzt Dinge voraus, die im Code so noch nicht funktionieren oder anders funktionieren als erwartet. Alle werden hier gelöst, nicht umgangen:

**1. Die Statusbar löscht gesetzte Werte bei jedem Update.**
[`src/ui/statusbar.ts:40-57`](../../../src/ui/statusbar.ts#L40-L57) — `builtinContent('autosave', state)` liefert `''`, und `update()` schreibt für **jedes** Built-in bei jedem Tastendruck `el.textContent = builtinContent(...)`. Ein per `setItem('autosave', 'Gespeichert: 14:03')` gesetzter Text wäre beim nächsten Tastendruck weg. Task 6 führt deshalb ein Set von *sticky* Built-ins ein: `'autosave'` und `'upload-image'` werden von `update()` nicht angefasst, ihr Inhalt kommt ausschließlich aus `setItem`.

**2. Die `mapPos`-`assoc`-Werte sind kontraintuitiv.**
Für einen Bereich, der an beiden Grenzen *dicht* bleiben soll, braucht `from` den
Wert `1` und `to` den Wert `-1` — nicht umgekehrt. Am realen CM6 verifiziert: Mit
`-1`/`+1` wächst der Platzhalter an beiden Enden, verschluckt davor und dahinter
getippten Text bei der Ersetzung und überlebt sogar ein `setValue()`. Der
Kommentar in Task 3 hält das fest, weil die falsche Variante sich beim Lesen
richtiger anfühlt.

**3. `buildExtensions()` sieht nur `ResolvedOptions`.**
[`src/editor/setup.ts:42-45`](../../../src/editor/setup.ts#L42-L45) — die Extension-Liste entsteht allein aus den normalisierten Optionen. Das Platzhalter-`StateField` und die Drop/Paste-Handler brauchen aber eine Verbindung zur SupaMDE-Instanz, die es beim `buildExtensions`-Aufruf noch gar nicht gibt. Task 9 löst das mit einem `extraExtensions`-Parameter an `editorFromTextArea` — additiv, ohne bestehende Signaturen zu brechen.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `src/features/storage.ts` | **Neu.** `SupaStorage`-Interface, `createLocalStorage(prefix)`, `createMemoryStorage()`, `isStorageAvailable()`. Die einzige Stelle, an der Autosave die Außenwelt berührt. |
| `src/features/autosave.ts` | **Neu.** `createAutosave(opts)`: Debounce, Restore, `clear()`, `stop()`. Kein DOM, keine EditorView — nimmt Callbacks entgegen. |
| `src/features/upload-placeholder.ts` | **Neu.** CM6-`StateField` mit `addPlaceholder`/`removePlaceholder`-Effects, `placeholderRange(state, id)`, `createIdSource()`. Der einzige echte CM6-Anteil. |
| `src/util/text-format.ts` | **Neu.** `formatText(template, values)` und `formatBytes(bytes)`. Generische Textwerkzeuge ohne Upload-Bezug — bewusst NICHT in `image-upload.ts`, sonst importierte ein künftiges Feature seine Textformatierung aus einem Upload-Modul (falsche Abhängigkeitsrichtung) oder dupliziert sie. |
| `src/features/image-upload.ts` | **Neu.** `UploadImageOptions`, `UploadError`, `UploadTexts`, `resolveUploadTexts`, `validateFile`, `createImageUploader(view, opts)` inkl. `destroy()`. |
| `src/features/upload-dom.ts` | **Neu.** DOM-nahe Ränder: `uploadDropPasteExtension(handler)` (drop/paste-Handler) und `openFilePicker(accept, onFiles)` (versteckter File-Input). Getrennt von `image-upload.ts`, damit dessen Logik ohne jsdom-Eventsimulation testbar bleibt. |
| `src/ui/statusbar.ts` | Modifizieren: `'upload-image'` zu `BUILTIN_NAMES`, Sticky-Set gegen Überschreiben durch `update()`. |
| `src/ui/icons.ts` | Modifizieren: Icon `'upload-image'`. |
| `src/ui/actions.ts` | Modifizieren: `SupaLike` um `uploadImages`/`openBrowseFileWindow` erweitern, Aktion `'upload-image'`. |
| `src/options.ts` | Modifizieren: `autosave?` und `uploadImage?` in `SupaMDEOptions`. |
| `src/editor/setup.ts` | Modifizieren: `extraExtensions`-Parameter an `editorFromTextArea`. |
| `src/editor/extensions.ts` | Modifizieren: `extraExtensions` in die Liste aufnehmen. |
| `src/index.ts` | Modifizieren: Autosave- und Upload-Verdrahtung, 4 neue API-Methoden, Cleanup in `toTextArea()` (Autosave-Timer UND Uploader-Timer). |
| `src/__tests__/helpers.ts` | Modifizieren: `makeResolved` bleibt unverändert (keine neuen `ResolvedOptions`-Felder), aber `fileOf()`-Helper für Upload-Tests ergänzen. |
| `README.md` | Modifizieren: zwei neue Abschnitte (**letzte Task**). |

**Reihenfolge-Logik:** Task 1 (Speicher) und Task 3 (Platzhalter-StateField) haben keine Abhängigkeiten. Task 2 (Autosave-Logik) baut auf Task 1. Task 4 (Textwerkzeuge) ist eigenständig und liefert Task 5 zu. Task 5 (Upload-Orchestrierung) baut auf Task 3 und 4. Task 6 (Statusbar) und Task 7 (Optionen/Icon) sind Verdrahtungsvorbereitung. Task 8 verdrahtet Autosave in der Fassade. Task 9 fasst die Toolbar-Aktion **und** die vollständige Upload-Verdrahtung zusammen. Task 10 dokumentiert.

**Warum Toolbar-Aktion und Upload-Verdrahtung in EINER Task (Task 9):** Die Erweiterung von `SupaLike` um `uploadImages`/`openBrowseFileWindow` bricht den `_supaLikeCheck` in [`src/index.ts:285`](../../../src/index.ts#L285), bis die Klasse beide Methoden hat. Getrennt aufgeteilt entstünde ein Commit mit rotem Typecheck — ein Verstoß gegen die Global Constraint „Vor jedem Commit müssen Lint und Typecheck grün sein". Die Regel für einen Commit auszusetzen entwertet sie; deshalb wird stattdessen der Schnitt verschoben. Task 9 ist dadurch die größte Task des Plans, bleibt aber in sich abgeschlossen und endet mit einem grünen Gesamtlauf. Task 7 behält, was für sich allein grün ist (Optionen, Icon).

---

## Task 1: `storage.ts` — das Speicher-Interface

**Files:**
- Create: `src/features/storage.ts`
- Test: `src/features/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: nichts (erste Task)
- Produces:
  ```typescript
  export interface SupaStorage {
    load(key: string): string | null | Promise<string | null>;
    save(key: string, value: string): void | Promise<void>;
    clear(key: string): void | Promise<void>;
  }
  export function createLocalStorage(prefix?: string): SupaStorage;
  export function createMemoryStorage(): SupaStorage;
  export function isStorageAvailable(storage: SupaStorage): Promise<boolean>;
  ```
  `createLocalStorage()` nutzt Default-Prefix `'supamde:'`. `isStorageAvailable` macht einen Probe-Schreibvorgang in `try/catch` und liefert `false` bei jedem Wurf.

- [ ] **Step 1: Testdatei anlegen**

Erstelle `src/features/__tests__/storage.test.ts`:

```typescript
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/features/__tests__/storage.test.ts`
Expected: FAIL — `Failed to resolve import "../storage"`.

- [ ] **Step 3: `storage.ts` implementieren**

Erstelle `src/features/storage.ts`:

```typescript
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
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/__tests__/storage.test.ts`
Expected: PASS — 14 Tests grün.

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/storage.ts src/features/__tests__/storage.test.ts
git commit -m "feat(storage): SupaStorage-Interface mit localStorage- und Memory-Implementierung"
```

---

## Task 2: `autosave.ts` — Debounce, Restore, Speicheranbindung

**Files:**
- Create: `src/features/autosave.ts`
- Test: `src/features/__tests__/autosave.test.ts`

**Interfaces:**
- Consumes: `SupaStorage`, `createLocalStorage`, `isStorageAvailable` aus `./storage`
- Produces:
  ```typescript
  export interface AutosaveOptions {
    enabled?: boolean;
    key: string;
    delay?: number;
    storage?: SupaStorage;
    onRestore?: (saved: string) => void;
  }
  export interface Autosave {
    /** Prüft Speicher-Verfügbarkeit und stellt ggf. einen Entwurf wieder her. */
    start(): Promise<void>;
    /** Setzt den Debounce-Timer neu. Bei jeder Doc-Änderung zu rufen. */
    schedule(): void;
    /** Stoppt den Timer UND löscht den Eintrag. */
    clear(): Promise<void>;
    /** Räumt nur den Timer ab; der gespeicherte Wert bleibt. */
    stop(): void;
    /** Ob Autosave aktiv ist (Speicher verfügbar, key gültig). */
    isActive(): boolean;
  }
  export function createAutosave(
    options: AutosaveOptions,
    hooks: {
      getValue(): string;
      setValue(value: string): void;
      onSaved(time: Date): void;
    },
  ): Autosave;
  ```
  `delay` Default `1000`. `storage` Default `createLocalStorage()`.

**Warum Hooks statt EditorView:** Die gesamte Debounce- und Restore-Logik ist damit ohne CM6 und ohne jsdom testbar. Die Fassade reicht in Task 8 die drei Funktionen durch.

**Der Ausgangswert wird bei der Erzeugung gemerkt.** `start()` ist async — zwischen `new SupaMDE(...)` und dem Moment, in dem der Speicher geantwortet hat, liegt mindestens ein Microtask. Ein Host, der direkt nach der Konstruktion `editor.setValue('…')` ruft (Formular vorbefüllen, Inhalt nachladen), hätte seinen Wert danach kommentarlos vom Entwurf überschrieben — ein Vergleich gegen `getValue()` zur Restore-Zeit sähe die Host-Änderung als „weicht ab" und damit als Grund zum Wiederherstellen. Deshalb merkt `createAutosave` den Wert bei der Erzeugung und stellt nur wieder her, wenn das Dokument seither **unberührt** ist. Ändert der Host es vorher, gewinnt er — er weiß mehr über seinen Fall als der Editor.

- [ ] **Step 1: Testdatei anlegen**

Erstelle `src/features/__tests__/autosave.test.ts`:

```typescript
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
    expect(s.onSaved.mock.calls[0][0]).toBeInstanceOf(Date);
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/features/__tests__/autosave.test.ts`
Expected: FAIL — `Failed to resolve import "../autosave"`.

- [ ] **Step 3: `autosave.ts` implementieren**

Erstelle `src/features/autosave.ts`:

```typescript
import { createLocalStorage, isStorageAvailable, type SupaStorage } from './storage';

/** Konfiguration des Autosave. */
export interface AutosaveOptions {
  /** Aktiviert Autosave. Default: false. */
  enabled?: boolean;
  /** Pflicht. Identifiziert das Dokument im Speicher. */
  key: string;
  /** Debounce nach der letzten Änderung, in ms. Default: 1000. */
  delay?: number;
  /** Eigener Speicher. Default: localStorage unter `supamde:<key>`. */
  storage?: SupaStorage;
  /** Wird gerufen, wenn beim Start ein Entwurf geladen wurde. */
  onRestore?: (saved: string) => void;
}

/** Die Hooks, über die Autosave das Dokument erreicht — ohne CM6-Abhängigkeit. */
export interface AutosaveHooks {
  getValue(): string;
  setValue(value: string): void;
  onSaved(time: Date): void;
}

/** Das Steuerungs-Handle über eine Autosave-Instanz. */
export interface Autosave {
  start(): Promise<void>;
  schedule(): void;
  clear(): Promise<void>;
  stop(): void;
  isActive(): boolean;
}

/** Default-Debounce in Millisekunden. */
export const DEFAULT_AUTOSAVE_DELAY = 1000;

export function createAutosave(options: AutosaveOptions, hooks: AutosaveHooks): Autosave {
  const enabled = options.enabled ?? false;
  const delay = options.delay ?? DEFAULT_AUTOSAVE_DELAY;
  const storage = options.storage ?? createLocalStorage();
  const key = options.key;

  /**
   * Der Dokumentinhalt zum Zeitpunkt der Erzeugung. Referenzpunkt für den
   * Restore: Nur wenn das Dokument seither UNBERÜHRT ist, darf ein Entwurf es
   * überschreiben. `start()` ist async — ein Host, der direkt nach der
   * Konstruktion `setValue()` ruft, wäre sonst um seinen Wert gebracht, weil ein
   * Vergleich gegen den dann-aktuellen Inhalt die Host-Änderung als "weicht vom
   * Entwurf ab" liest und damit als Grund zum Wiederherstellen.
   */
  const ausgangswert = hooks.getValue();

  let aktiv = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Nur EINE Warnung pro Instanz. easyMDE warnte bei jedem Tastendruck erneut —
   * bei vollem Speicher füllte das die Konsole schneller, als man lesen konnte.
   */
  let gewarnt = false;

  const warnEinmal = (nachricht: string): void => {
    if (gewarnt) return;
    gewarnt = true;
    console.warn(`SupaMDE: ${nachricht}`);
  };

  const stop = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const speichere = async (): Promise<void> => {
    if (!aktiv) return;
    const wert = hooks.getValue();
    try {
      // Leerer Inhalt löscht statt zu speichern — sonst legte sich beim nächsten
      // Start ein leerer Entwurf über einen befüllten Ausgangsinhalt.
      if (wert.trim() === '') {
        await storage.clear(key);
      } else {
        await storage.save(key, wert);
      }
      hooks.onSaved(new Date());
    } catch {
      // Die Verfügbarkeitsprobe hat nur ein Byte geschrieben; die echte Quota
      // schlägt erst bei großem Inhalt zu. Ab hier still abschalten statt bei
      // jedem Tastendruck erneut zu werfen.
      aktiv = false;
      stop();
      warnEinmal('Autosave-Speicher nicht beschreibbar — Autosave ist deaktiviert.');
    }
  };

  const start = async (): Promise<void> => {
    if (!enabled) return;
    if (!key) {
      warnEinmal('autosave.key ist erforderlich — Autosave bleibt aus.');
      return;
    }
    if (!(await isStorageAvailable(storage))) {
      warnEinmal('Autosave-Speicher nicht verfügbar — Autosave ist deaktiviert.');
      return;
    }
    aktiv = true;

    let gespeichert: string | null = null;
    try {
      gespeichert = await storage.load(key);
    } catch {
      aktiv = false;
      warnEinmal('Autosave-Speicher nicht lesbar — Autosave ist deaktiviert.');
      return;
    }

    const aktuell = hooks.getValue();

    // Hat der Host das Dokument seit der Erzeugung angefasst, gewinnt ER. Er
    // weiß mehr über seinen Fall (Inhalt nachgeladen, Formular vorbefüllt) als
    // der Editor, und ein stilles Überschreiben wäre der schlimmere Fehler als
    // ein nicht wiederhergestellter Entwurf. Der Entwurf bleibt im Speicher
    // erhalten und ist beim nächsten Öffnen wieder ein Kandidat.
    if (aktuell !== ausgangswert) return;

    // Der gespeicherte Stand gewinnt gegenüber dem Ausgangsinhalt — das IST der
    // Zweck des Features. Aber nur, wenn es überhaupt etwas anderes ist: Gleicht
    // der Stand dem Dokument, gibt es keinen Entwurf wiederherzustellen, und
    // `onRestore` würde den Host grundlos alarmieren.
    //
    // `trim()` in der Leerprüfung — dieselbe Definition von "leer" wie beim
    // Speichern. Sonst legte sich ein Entwurf aus reinem Whitespace über einen
    // befüllten Ausgangsinhalt, obwohl genau dieser Inhalt nie hätte
    // gespeichert werden können (dort löst er `clear()` aus).
    if (gespeichert && gespeichert.trim() !== '' && gespeichert !== aktuell) {
      hooks.setValue(gespeichert);
      options.onRestore?.(gespeichert);
    }
  };

  const schedule = (): void => {
    if (!aktiv) return;
    stop();
    timer = setTimeout(() => {
      timer = null;
      void speichere();
    }, delay);
  };

  /**
   * Löscht den Eintrag UND stoppt den Timer. Das Stoppen ist wesentlich: Ohne es
   * schriebe ein noch laufender Debounce den gerade gelöschten Eintrag sofort
   * zurück — genau der easyMDE-Fehler, wegen dem `clearAutosavedValue()` dort
   * wirkungslos schien.
   */
  const clear = async (): Promise<void> => {
    stop();
    try {
      await storage.clear(key);
    } catch {
      warnEinmal('Autosave-Eintrag konnte nicht gelöscht werden.');
    }
  };

  return { start, schedule, clear, stop, isActive: () => aktiv };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/__tests__/autosave.test.ts`
Expected: PASS — alle Tests der Datei grün (19 zum Zeitpunkt der Planerstellung; maßgeblich ist „keiner rot", nicht die Zahl).

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/autosave.ts src/features/__tests__/autosave.test.ts
git commit -m "feat(autosave): Debounce, Restore und Speicheranbindung als reine Logik"
```

---

## Task 3: `upload-placeholder.ts` — das positionsstabile StateField

**Files:**
- Create: `src/features/upload-placeholder.ts`
- Test: `src/features/__tests__/upload-placeholder.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks
- Produces:
  ```typescript
  export interface PlaceholderRange { from: number; to: number }
  export const addPlaceholder: StateEffectType<{ id: number; from: number; to: number }>;
  export const removePlaceholder: StateEffectType<number>;
  export const uploadPlaceholderField: StateField<Map<number, PlaceholderRange>>;
  export function placeholderRange(state: EditorState, id: number): PlaceholderRange | null;
  export function createIdSource(): () => number;
  ```
  **`createIdSource()` statt eines modul-globalen Zählers:** Ein `nextPlaceholderId()`
  mit `let zähler = 0` auf Modulebene macht das Modul zustandsbehaftet und Tests
  reihenfolgeabhängig — ein Test, der auf eine konkrete ID prüft, bricht, sobald
  eine andere Testdatei vorher lief. Die Factory kostet zwei Zeilen und gibt jedem
  Uploader seine eigene Sequenz. Eindeutigkeit ist ohnehin nur PRO View nötig: Die
  IDs sind Schlüssel in der Map EINES `uploadPlaceholderField`.

**Der Kern von M5.** Positionen werden **ausschließlich** aus diesem Feld gelesen, nie beim Einfügen gemerkt.

- [ ] **Step 1: Testdatei anlegen**

Erstelle `src/features/__tests__/upload-placeholder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  addPlaceholder,
  removePlaceholder,
  uploadPlaceholderField,
  placeholderRange,
  createIdSource,
} from '../upload-placeholder';

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [uploadPlaceholderField] });
}

describe('uploadPlaceholderField', () => {
  it('nimmt einen Platzhalter über addPlaceholder auf', () => {
    const state = stateOf('abc');
    const tr = state.update({ effects: addPlaceholder.of({ id: 1, from: 1, to: 2 }) });
    expect(placeholderRange(tr.state, 1)).toEqual({ from: 1, to: 2 });
  });

  it('liefert null für eine unbekannte ID', () => {
    expect(placeholderRange(stateOf('abc'), 99)).toBeNull();
  });

  it('mappt die Position mit, wenn weit davor Text eingefügt wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 0, insert: 'XXXXX' } }).state;
    expect(placeholderRange(s, 1)).toEqual({ from: 8, to: 12 });
    expect(s.doc.sliceString(8, 12)).toBe('[PH]');
  });

  it('bleibt dicht, wenn GENAU davor getippt wird', () => {
    // Der Bereich darf den neuen Text NICHT aufnehmen — sonst verschluckte ihn
    // die spätere Ersetzung durch das fertige Bild.
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 3, insert: 'XX' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PH]');
  });

  it('bleibt dicht, wenn GENAU dahinter getippt wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 7, insert: 'ZZ' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PH]');
  });

  it('nimmt Text auf, der MITTEN im Platzhalter landet', () => {
    // Innen getippter Text gehört zum Platzhalter und wird mit ersetzt — sonst
    // bliebe ein Bruchstück des Platzhaltertexts im Dokument stehen.
    const state = stateOf('[PH]');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 0, to: 4 }) }).state;
    s = s.update({ changes: { from: 2, insert: 'X' } }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe('[PXH]');
  });

  it('nimmt den Bereich in DERSELBEN Transaktion auf, die ihn einfügt', () => {
    // Genau das dispatcht image-upload.ts: changes + addPlaceholder zusammen.
    // Der Effect-Wert darf dabei NICHT mitgemappt werden.
    const state = stateOf('Text ');
    const ph = '![Uploading a.png…]()';
    const s = state.update({
      changes: { from: 5, to: 5, insert: ph },
      effects: addPlaceholder.of({ id: 1, from: 5, to: 5 + ph.length }),
    }).state;
    const r = placeholderRange(s, 1)!;
    expect(s.doc.sliceString(r.from, r.to)).toBe(ph);
  });

  it('entfernt den Eintrag, wenn der Bereich von Hand gelöscht wird', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 3, to: 7, insert: '' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('entfernt den Eintrag, wenn das ganze Dokument ersetzt wird (setValue)', () => {
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({ changes: { from: 0, to: s.doc.length, insert: 'ganz neu' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('entfernt den Eintrag über removePlaceholder', () => {
    const state = stateOf('abc');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 0, to: 3 }) }).state;
    s = s.update({ effects: removePlaceholder.of(1) }).state;
    expect(placeholderRange(s, 1)).toBeNull();
  });

  it('hält zwei Platzhalter unabhängig auseinander', () => {
    const state = stateOf('AAAA BBBB');
    let s = state.update({
      effects: [
        addPlaceholder.of({ id: 1, from: 0, to: 4 }),
        addPlaceholder.of({ id: 2, from: 5, to: 9 }),
      ],
    }).state;
    // Text VOR beiden einfügen: beide wandern um dieselbe Distanz.
    s = s.update({ changes: { from: 0, insert: '--' } }).state;
    expect(placeholderRange(s, 1)).toEqual({ from: 2, to: 6 });
    expect(placeholderRange(s, 2)).toEqual({ from: 7, to: 11 });
  });

  it('lässt den zweiten Platzhalter unberührt, wenn der erste gelöscht wird', () => {
    const state = stateOf('AAAA BBBB');
    let s = state.update({
      effects: [
        addPlaceholder.of({ id: 1, from: 0, to: 4 }),
        addPlaceholder.of({ id: 2, from: 5, to: 9 }),
      ],
    }).state;
    s = s.update({ changes: { from: 0, to: 4, insert: '' } }).state;
    expect(placeholderRange(s, 1)).toBeNull();
    expect(placeholderRange(s, 2)).toEqual({ from: 1, to: 5 });
  });

  it('überlebt eine Änderung nach dem Ersetzen des eigenen Bereichs nicht', () => {
    // Nach dem Ersatz durch das fertige Bild muss der Eintrag weg sein — sonst
    // würde ein zweites Ergebnis erneut an derselben Stelle schreiben.
    const state = stateOf('vor[PH]nach');
    let s = state.update({ effects: addPlaceholder.of({ id: 1, from: 3, to: 7 }) }).state;
    s = s.update({
      changes: { from: 3, to: 7, insert: '![a](u)' },
      effects: removePlaceholder.of(1),
    }).state;
    expect(placeholderRange(s, 1)).toBeNull();
    expect(s.doc.toString()).toBe('vor![a](u)nach');
  });
});

describe('createIdSource', () => {
  it('liefert bei jedem Aufruf eine neue ID', () => {
    const nächste = createIdSource();
    expect(new Set([nächste(), nächste(), nächste()]).size).toBe(3);
  });

  it('startet jede Quelle bei derselben Zahl', () => {
    // Genau das kann ein modul-globaler Zähler nicht: Der Test wäre von der
    // Reihenfolge aller vorherigen Aufrufe im Prozess abhängig.
    expect(createIdSource()()).toBe(createIdSource()());
  });

  it('zwei Quellen laufen unabhängig voneinander', () => {
    const a = createIdSource();
    const b = createIdSource();
    a();
    a();
    expect(b()).toBe(1);
    expect(a()).toBe(3);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/features/__tests__/upload-placeholder.test.ts`
Expected: FAIL — `Failed to resolve import "../upload-placeholder"`.

- [ ] **Step 3: `upload-placeholder.ts` implementieren**

Erstelle `src/features/upload-placeholder.ts`:

```typescript
import { StateEffect, StateField, type EditorState } from '@codemirror/state';

/** Der aktuelle Bereich eines offenen Platzhalters im Dokument. */
export interface PlaceholderRange {
  from: number;
  to: number;
}

/** Nimmt einen neuen Platzhalter unter `id` in die Verfolgung auf. */
export const addPlaceholder = StateEffect.define<{ id: number; from: number; to: number }>();

/** Nimmt den Platzhalter mit dieser `id` wieder heraus. */
export const removePlaceholder = StateEffect.define<number>();

/**
 * Hält die offenen Platzhalter und mappt sie bei JEDER Transaktion durch
 * `tr.changes`. Bewusst ein StateField und kein Instanzfeld mit gemerkten
 * Zahlen: Genau daran scheiterte easyMDE — dort wurde das fertige Bild
 * nachträglich am dann-aktuellen Cursor eingefügt, sodass es bei Weitertippen
 * an falscher Stelle landete.
 */
export const uploadPlaceholderField = StateField.define<Map<number, PlaceholderRange>>({
  create() {
    return new Map();
  },

  update(value, tr) {
    let next = value;

    if (tr.docChanged && next.size > 0) {
      const gemappt = new Map<number, PlaceholderRange>();
      for (const [id, range] of next) {
        // `assoc: +1` für `from`, `-1` für `to` — der Bereich SCHRUMPFT an
        // beiden Grenzen. Text, der genau davor oder genau dahinter eingefügt
        // wird, bleibt draußen; sonst verschluckte ihn die spätere Ersetzung
        // durch das fertige Bild. Am realen CM6 verifiziert: nur diese
        // Kombination hält beide Grenzen dicht (`-1`/`+1` tut das Gegenteil).
        const from = tr.changes.mapPos(range.from, 1);
        const to = tr.changes.mapPos(range.to, -1);
        // Auf Länge 0 zusammengefallen heißt: der Nutzer hat den Platzhalter
        // gelöscht (oder `setValue()` hat das Dokument ersetzt). Dann ist der
        // Eintrag hinfällig — das Ergebnis darf nirgendwo mehr landen.
        if (to > from) gemappt.set(id, { from, to });
      }
      next = gemappt;
    }

    for (const effect of tr.effects) {
      if (effect.is(addPlaceholder)) {
        const kopie = new Map(next);
        kopie.set(effect.value.id, { from: effect.value.from, to: effect.value.to });
        next = kopie;
      } else if (effect.is(removePlaceholder)) {
        if (next.has(effect.value)) {
          const kopie = new Map(next);
          kopie.delete(effect.value);
          next = kopie;
        }
      }
    }

    return next;
  },
});

/**
 * Der AKTUELLE Bereich eines Platzhalters, oder `null`, wenn er nicht mehr
 * existiert. Die einzige erlaubte Quelle für die Ersetzungsposition.
 */
export function placeholderRange(state: EditorState, id: number): PlaceholderRange | null {
  return state.field(uploadPlaceholderField, false)?.get(id) ?? null;
}

/**
 * Erzeugt eine unabhängige ID-Quelle. Bewusst eine Factory statt eines
 * modul-globalen Zählers: Der wäre gemeinsamer Zustand über alle Instanzen und
 * alle Testdateien hinweg und machte jeden Test auf eine konkrete ID von der
 * Ausführungsreihenfolge abhängig. Eindeutigkeit ist nur PRO View nötig — die
 * IDs sind Schlüssel in der Map genau eines `uploadPlaceholderField`.
 */
export function createIdSource(): () => number {
  let zähler = 0;
  return () => {
    zähler += 1;
    return zähler;
  };
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/__tests__/upload-placeholder.test.ts`
Expected: PASS — alle Tests der Datei grün.

Bleibt einer der beiden „bleibt dicht"-Tests rot, sind die `assoc`-Werte vertauscht: `from` braucht `1`, `to` braucht `-1`. Die intuitive Gegenrichtung (`-1`/`+1`) lässt den Bereich an beiden Grenzen wachsen und ist am realen CM6 als falsch verifiziert.

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/upload-placeholder.ts src/features/__tests__/upload-placeholder.test.ts
git commit -m "feat(upload): StateField für positionsstabile Upload-Platzhalter"
```

---

## Task 4: `text-format.ts` — Platzhalter und Größenangaben

**Files:**
- Create: `src/util/text-format.ts`
- Test: `src/util/__tests__/text-format.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  ```typescript
  export function formatText(template: string, values: Record<string, string>): string;
  export function formatBytes(bytes: number): string;
  ```

**Warum ein eigenes Modul statt in `image-upload.ts`:** Beide Funktionen haben
keinerlei Upload-Bezug — die eine ersetzt benannte Platzhalter in einem Template,
die andere macht aus einer Byte-Zahl eine lesbare Größe. In `image-upload.ts`
geparkt müsste ein künftiges Feature (eine Autosave-Meldung mit `{zeit}`, eine
Größenangabe irgendwo anders) seine Textformatierung aus einem Upload-Modul
importieren — eine Abhängigkeitsrichtung, die niemand erwartet — oder sie
duplizieren. Ein eigenes Modul verhindert beides, bevor es passiert.

- [ ] **Step 1: Testdatei anlegen**

Erstelle `src/util/__tests__/text-format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatText, formatBytes } from '../text-format';

describe('formatText', () => {
  it('ersetzt einen benannten Platzhalter', () => {
    expect(formatText('Lade {name} hoch…', { name: 'a.png' })).toBe('Lade a.png hoch…');
  });

  it('ersetzt ALLE Vorkommen desselben Platzhalters', () => {
    expect(formatText('{name} und {name}', { name: 'x' })).toBe('x und x');
  });

  it('lässt unbekannte Platzhalter unverändert stehen', () => {
    expect(formatText('{name} {unbekannt}', { name: 'x' })).toBe('x {unbekannt}');
  });

  it('kommt ohne Platzhalter aus', () => {
    expect(formatText('Nur Text', {})).toBe('Nur Text');
  });

  it('ersetzt mehrere verschiedene Platzhalter', () => {
    expect(formatText('{a} ist zu groß (max. {b}).', { a: 'x.png', b: '2 MB' })).toBe(
      'x.png ist zu groß (max. 2 MB).',
    );
  });

  it('behandelt einen Wert mit geschweiften Klammern als reinen Text', () => {
    // Kein zweiter Ersetzungsdurchlauf: Ein eingesetzter Wert darf nicht selbst
    // wieder als Template gelesen werden, sonst hinge das Ergebnis von der
    // Reihenfolge der Schlüssel ab.
    expect(formatText('{a}{b}', { a: '{b}', b: 'X' })).toBe('{b}X');
  });
});

describe('formatBytes', () => {
  it('formatiert Megabyte lesbar', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
  });

  it('formatiert Kilobyte lesbar', () => {
    expect(formatBytes(500 * 1024)).toBe('500 KB');
  });

  it('formatiert kleine Werte als Bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formatiert 0 als 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/util/__tests__/text-format.test.ts`
Expected: FAIL — `Failed to resolve import "../text-format"`.

- [ ] **Step 3: `text-format.ts` implementieren**

Erstelle `src/util/text-format.ts`:

```typescript
/**
 * Ersetzt ALLE Vorkommen von `{schlüssel}`. Benannte Platzhalter statt easyMDEs
 * `#image_name#`, und bewusst alle Vorkommen: ein Text darf `{name}` mehrfach
 * verwenden.
 *
 * Eingesetzte Werte werden NICHT erneut durchsucht — enthielte ein Wert selbst
 * `{…}`, hinge das Ergebnis sonst von der Schlüsselreihenfolge ab.
 */
export function formatText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (treffer, schlüssel: string) =>
    Object.prototype.hasOwnProperty.call(values, schlüssel) ? values[schlüssel] : treffer,
  );
}

/** Bytes als lesbare Größe — nur für die Anzeige, keine exakte Rechnung. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/util/__tests__/text-format.test.ts`
Expected: PASS — alle Tests grün.

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/util/text-format.ts src/util/__tests__/text-format.test.ts
git commit -m "feat(util): formatText und formatBytes als wiederverwendbare Textwerkzeuge"
```

---

## Task 5: `image-upload.ts` — Validierung, Texte und Orchestrierung

**Files:**
- Create: `src/features/image-upload.ts`
- Test: `src/features/__tests__/image-upload.test.ts`
- Modify: `src/__tests__/helpers.ts` (Helper `fileOf` ergänzen)

**Interfaces:**
- Consumes: `addPlaceholder`, `removePlaceholder`, `uploadPlaceholderField`, `placeholderRange`, `createIdSource` aus `./upload-placeholder`; `formatText`, `formatBytes` aus `../util/text-format`
- Produces:
  ```typescript
  export interface UploadTexts {
    placeholder: string;
    statusInit: string;
    statusUploading: string;
    statusDone: string;
    errorTooLarge: string;
    errorType: string;
    errorFailed: string;
  }
  export interface UploadError {
    kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
    file: File;
    cause?: unknown;
  }
  export interface UploadImageOptions {
    enabled?: boolean;
    upload: (file: File) => Promise<string>;
    maxSize?: number;
    accept?: string[];
    texts?: Partial<UploadTexts>;
    onError?: (error: UploadError) => void;
  }
  export interface ImageUploader {
    uploadFiles(files: FileList | File[]): void;
    accept(): string[];
    isActive(): boolean;
    /** Räumt den Rückfall-Timer ab. Beim Rückbau des Editors zu rufen. */
    destroy(): void;
  }
  export const DEFAULT_UPLOAD_MAX_SIZE: number;   // 2 * 1024 * 1024
  export const DEFAULT_UPLOAD_ACCEPT: string[];
  export const DEFAULT_UPLOAD_TEXTS: UploadTexts;
  export function resolveUploadTexts(texts?: Partial<UploadTexts>): UploadTexts;
  export function validateFile(
    file: File,
    opts: { maxSize: number; accept: string[] },
  ): UploadError['kind'] | null;
  export function createImageUploader(
    view: EditorView,
    options: UploadImageOptions,
    hooks: { setStatus(text: string): void },
  ): ImageUploader;
  ```

- [ ] **Step 1: `fileOf`-Helper ergänzen**

Hänge ans Ende von `src/__tests__/helpers.ts` an:

```typescript
/**
 * Baut ein `File` für Upload-Tests. jsdom kennt `File`, aber die Größe lässt
 * sich nur über den tatsächlichen Inhalt steuern — deshalb wird ein Puffer der
 * gewünschten Länge erzeugt statt `size` zu überschreiben.
 */
export function fileOf(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}
```

- [ ] **Step 2: Testdatei anlegen**

Erstelle `src/features/__tests__/image-upload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createImageUploader,
  resolveUploadTexts,
  validateFile,
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
  return {
    upload,
    löseAuf: (index: number, url: string) => auflöser[index](url),
    verwirf: (index: number, err: unknown) => verwerfer[index](err),
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
    d.löseAuf(0, 'https://cdn.test/a.png');
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
    d.löseAuf(0, 'u');
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
    d.löseAuf(0, 'u');
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
    d.verwirf(0, new Error('500'));
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
    d.verwirf(0, ursache);
    await vi.waitFor(() => expect(fehler).toHaveLength(1));
    expect(fehler[0].kind).toBe('upload-failed');
    expect(fehler[0].cause).toBe(ursache);
    expect(fehler[0].file.name).toBe('a.png');
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
    expect(fehler[0].kind).toBe('too-large');
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
    expect(fehler[0].kind).toBe('type-not-allowed');
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
    d.löseAuf(1, 'url-zwei');
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe('![Uploading erste.png…]()![zweite.png](url-zwei)'),
    );
    d.löseAuf(0, 'url-eins');
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
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect(fehler.map((f) => f.kind)).toEqual(['too-large', 'type-not-allowed']);
    d.löseAuf(0, 'u');
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
    d.löseAuf(0, 'https://cdn.test/a.png');
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
    d.löseAuf(0, 'u');
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
    d.löseAuf(0, 'u');
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
    d.verwirf(0, new Error('500'));
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
    d.löseAuf(0, 'u1');
    await vi.advanceTimersByTimeAsync(3000);
    // Der Einladungstext darf hier NICHT erscheinen — sonst sähe es aus, als
    // wäre nichts mehr im Gange, während b.png noch hochlädt.
    expect(setStatus).not.toHaveBeenCalledWith('Bild hierher ziehen oder einfügen');

    d.löseAuf(1, 'u2');
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
    d.löseAuf(0, 'u');
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
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/features/__tests__/image-upload.test.ts`
Expected: FAIL — `Failed to resolve import "../image-upload"`.

- [ ] **Step 4: `image-upload.ts` implementieren**

Erstelle `src/features/image-upload.ts`:

```typescript
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
  return `![${alt}](${url})`;
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

    options.upload(file).then(
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
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/features/__tests__/image-upload.test.ts`
Expected: PASS — alle Tests der Datei grün.

- [ ] **Step 6: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/features/image-upload.ts src/features/__tests__/image-upload.test.ts src/__tests__/helpers.ts
git commit -m "feat(upload): Validierung, Anzeigetexte und Upload-Orchestrierung"
```

---

## Task 6: Statusbar — sticky Built-ins und der `'upload-image'`-Slot

**Files:**
- Modify: `src/ui/statusbar.ts`
- Test: `src/ui/__tests__/statusbar.test.ts` (bestehende Datei erweitern)

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks
- Produces: `BUILTIN_NAMES` enthält zusätzlich `'upload-image'`; `setItem(name, content)` gesetzte Werte für `'autosave'` und `'upload-image'` überleben jedes `update()`.

**Warum:** `builtinContent('autosave', state)` liefert `''`, und `update()` schreibt es bei **jedem** Tastendruck ins DOM. Ohne diese Änderung wäre ein per `setItem` gesetzter Zeitstempel nach dem nächsten Tastendruck weg — die Spec-Anforderung „Statusbar nach jedem erfolgreichen Speichern" ließe sich nicht erfüllen.

**Zu wissen für Task 9 und Task 10:** `setItem` findet ein Item nur, wenn es
tatsächlich gerendert wurde ([`src/ui/statusbar.ts:99-102`](../../../src/ui/statusbar.ts#L99-L102)) —
also nur, wenn sein Name in der `status`-Option steht. Ein Host mit
`uploadImage: { enabled: true }`, Default-`status` und ohne `onError` sieht
deshalb **keine einzige** Rückmeldung: keine Fortschrittsmeldung, keine
Fehlermeldung. Das ist eine bewusste Folge der Konfiguration und kein Fehler,
aber es muss sichtbar sein. Task 9 setzt dafür eine einmalige Konsolenwarnung,
Task 10 dokumentiert es.

- [ ] **Step 1: Failing Tests ergänzen**

Hänge in `src/ui/__tests__/statusbar.test.ts` innerhalb des bestehenden `describe('createStatusbar', …)` an (vor dessen schließender Klammer):

```typescript
  it('upload-image-Slot rendert leer, bis er gesetzt wird', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe('');
  });

  it('setItem befüllt den upload-image-Slot', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.setItem('upload-image', 'Lade a.png hoch…');
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe(
      'Lade a.png hoch…',
    );
  });

  it('ein gesetzter autosave-Wert überlebt das nächste update()', () => {
    const sb = createStatusbar(['autosave', 'words'])!;
    sb.setItem('autosave', 'Gespeichert: 14:03');
    sb.update(stateOf('neuer Text'), full);
    expect(sb.dom.querySelector('.supamde-status-autosave')!.textContent).toBe(
      'Gespeichert: 14:03',
    );
    // Die nicht-sticky Items werden weiterhin normal aktualisiert.
    expect(sb.dom.querySelector('.supamde-status-words')!.textContent).toContain('2');
  });

  it('ein gesetzter upload-image-Wert überlebt das nächste update()', () => {
    const sb = createStatusbar(['upload-image'])!;
    sb.setItem('upload-image', 'a.png hochgeladen');
    sb.update(stateOf('x'), full);
    expect(sb.dom.querySelector('.supamde-status-upload-image')!.textContent).toBe(
      'a.png hochgeladen',
    );
  });

  it('setItem auf ein NICHT gerendertes Item tut nichts (kein Wurf)', () => {
    const sb = createStatusbar(['words'])!;
    expect(() => sb.setItem('autosave', 'x')).not.toThrow();
  });

  it('DEFAULT_STATUS enthält weder autosave noch upload-image', () => {
    expect(DEFAULT_STATUS).not.toContain('autosave');
    expect(DEFAULT_STATUS).not.toContain('upload-image');
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/ui/__tests__/statusbar.test.ts`
Expected: FAIL bei „ein gesetzter autosave-Wert überlebt das nächste update()" — erhalten `''`, erwartet `'Gespeichert: 14:03'`. Der `upload-image`-Slot ist zusätzlich noch gar kein Built-in.

- [ ] **Step 3: `statusbar.ts` anpassen**

Ersetze in `src/ui/statusbar.ts` die Zeile mit `BUILTIN_NAMES` durch:

```typescript
/** Built-in-Namen, die SupaMDE selbst befüllt. */
const BUILTIN_NAMES = new Set(['lines', 'words', 'cursor', 'autosave', 'upload-image']);

/**
 * Built-ins, deren Inhalt AUSSCHLIESSLICH über `setItem()` kommt. `update()`
 * lässt sie unberührt — sonst löschte der nächste Tastendruck den gerade
 * gesetzten Zeitstempel bzw. die Upload-Meldung wieder (`builtinContent`
 * liefert für beide `''`).
 */
const STICKY_NAMES = new Set(['autosave', 'upload-image']);
```

Ergänze im `switch` von `builtinContent` den `'upload-image'`-Fall neben `'autosave'`:

```typescript
    case 'autosave':
    case 'upload-image':
      // Werden nie hier berechnet, sondern nur über setItem() gesetzt (STICKY_NAMES).
      return '';
```

Und ändere die Built-in-Schleife in `update`:

```typescript
    for (const { name, el } of builtins) {
      if (STICKY_NAMES.has(name)) continue;
      el.textContent = builtinContent(name, state);
    }
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/ui/__tests__/statusbar.test.ts`
Expected: PASS — alle Tests grün, auch die bestehenden acht.

- [ ] **Step 5: Lint und Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/ui/statusbar.ts src/ui/__tests__/statusbar.test.ts
git commit -m "feat(statusbar): upload-image-Slot und sticky Built-ins für autosave/upload-image"
```

---

## Task 7: Optionen und Icon

**Files:**
- Modify: `src/options.ts`
- Modify: `src/ui/icons.ts`
- Test: `src/__tests__/options.test.ts`, `src/ui/__tests__/icons.test.ts` (bestehende Dateien erweitern)

**Interfaces:**
- Consumes: `AutosaveOptions` aus `./features/autosave`, `UploadImageOptions` aus `./features/image-upload`
- Produces:
  ```typescript
  // src/options.ts — SupaMDEOptions zusätzlich:
  autosave?: AutosaveOptions;
  uploadImage?: UploadImageOptions;

  // src/ui/icons.ts — ICONS zusätzlich:
  'upload-image': ImageUp;
  ```
  `ResolvedOptions` bleibt **unverändert** — beide Features werden von der Fassade verdrahtet, nicht von `buildExtensions` aus den normalisierten Optionen.

**Was hier bewusst NICHT passiert:** Die Toolbar-Aktion `'upload-image'` und die
`SupaLike`-Erweiterung um `uploadImages`/`openBrowseFileWindow` gehören zu
**Task 9**. Grund: Sobald `SupaLike` die zwei Methoden verlangt, schlägt der
`_supaLikeCheck` in [`src/index.ts:285`](../../../src/index.ts#L285) fehl, bis die
Klasse sie hat — und die bekommt sie erst mit der Upload-Verdrahtung. Hier
getrennt entstünde ein Commit mit rotem Typecheck, was die Global Constraint
verletzt. Diese Task bleibt deshalb auf das beschränkt, was für sich allein
grün ist.

- [ ] **Step 1: Failing Tests ergänzen**

In `src/__tests__/options.test.ts` am Dateiende ein neues `describe` anhängen (`SupaMDEOptions` ist dort bereits als `import type` vorhanden — nichts am Kopf ändern):

```typescript
describe('M5-Optionen', () => {
  it('resolveOptions lässt autosave und uploadImage unberührt', () => {
    const options: SupaMDEOptions = {
      autosave: { enabled: true, key: 'doc' },
      uploadImage: { enabled: true, upload: async () => 'u' },
    };
    const resolved = resolveOptions(options);
    // ResolvedOptions bekommt bewusst KEINE M5-Felder — die Verdrahtung läuft
    // in der Fassade, nicht über buildExtensions.
    expect('autosave' in resolved).toBe(false);
    expect('uploadImage' in resolved).toBe(false);
  });

  it('mutiert das übergebene Options-Objekt nicht', () => {
    const options: SupaMDEOptions = { autosave: { enabled: true, key: 'doc' } };
    const kopie = JSON.stringify(options.autosave);
    resolveOptions(options);
    expect(JSON.stringify(options.autosave)).toBe(kopie);
  });
});
```

In `src/ui/__tests__/icons.test.ts` ein neues `describe` am Dateiende anhängen (analog zum vorhandenen `describe('Icon editor-mode', …)`):

```typescript
describe('Icon upload-image', () => {
  it('ist als Built-in-Icon bekannt', () => {
    expect(hasIcon('upload-image')).toBe(true);
  });

  it('rendert ein SVG', () => {
    expect(renderIcon('upload-image').tagName.toLowerCase()).toBe('svg');
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/__tests__/options.test.ts src/ui/__tests__/icons.test.ts`
Expected: FAIL — `hasIcon('upload-image')` ist `false`.

- [ ] **Step 3: `options.ts` erweitern**

Ergänze in `src/options.ts` die Imports:

```typescript
import type { AutosaveOptions } from './features/autosave';
import type { UploadImageOptions } from './features/image-upload';
```

Und in `SupaMDEOptions` vor der schließenden Klammer:

```typescript
  /**
   * Autosave (M5). Der Inhalt überlebt Absturz, Schließen und Reload.
   * Per Default aus; `key` ist bei `enabled: true` Pflicht.
   */
  autosave?: AutosaveOptions;
  /**
   * Bild-Upload (M5). Drag & Drop, Einfügen aus der Zwischenablage und
   * Dateiauswahl. Per Default aus; `upload` ist Pflicht.
   */
  uploadImage?: UploadImageOptions;
```

`ResolvedOptions` und `resolveOptions` bleiben **unverändert**.

- [ ] **Step 4: `icons.ts` erweitern**

Ergänze in `src/ui/icons.ts` den Import (alphabetisch in der bestehenden Liste):

```typescript
  ImageUp,
```

Und im `ICONS`-Record:

```typescript
  'upload-image': ImageUp,
```

Sollte `ImageUp` in der installierten lucide-Version nicht existieren, verwende `Upload` als Ersatz — der Test prüft nur, dass ein SVG entsteht. Verifiziere mit:
`node -e "import('lucide').then(m => console.log('ImageUp' in m, 'Upload' in m))"`

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/__tests__/options.test.ts src/ui/__tests__/icons.test.ts`
Expected: PASS.

- [ ] **Step 6: Gesamtlauf, Lint und Typecheck**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: **alle drei grün.** Diese Task berührt `SupaLike` nicht und lässt daher
keinen Typecheck-Fehler zurück.

- [ ] **Step 7: Commit**

```bash
git add src/options.ts src/ui/icons.ts \
  src/__tests__/options.test.ts src/ui/__tests__/icons.test.ts
git commit -m "feat(options): M5-Optionen und upload-image-Icon"
```

---

## Task 8: Autosave in der Fassade verdrahten

**Files:**
- Modify: `src/index.ts`
- Test: `src/__tests__/autosave-integration.test.ts` (neu)

**Interfaces:**
- Consumes: `createAutosave`, `type Autosave` aus `./features/autosave`; `SupaStorage` aus `./features/storage`
- Produces:
  ```typescript
  // Auf der SupaMDE-Klasse:
  clearAutosavedValue(): Promise<void>;
  isAutosaveActive(): boolean;
  // Re-Exports aus src/index.ts:
  export type { SupaStorage } from './features/storage';
  export type { AutosaveOptions } from './features/autosave';
  ```

- [ ] **Step 1: Testdatei anlegen**

Erstelle `src/__tests__/autosave-integration.test.ts`:

```typescript
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/__tests__/autosave-integration.test.ts`
Expected: FAIL — `editor.isAutosaveActive is not a function`.

- [ ] **Step 3: `index.ts` um Autosave erweitern**

Ergänze die Imports in `src/index.ts`:

```typescript
import { createAutosave, type Autosave } from './features/autosave';
```

Ergänze die Typ-Re-Exports bei den bestehenden `export type`-Zeilen:

```typescript
export type { SupaStorage } from './features/storage';
export type { AutosaveOptions } from './features/autosave';
```

Ergänze das Instanzfeld bei den anderen `private readonly`-Feldern:

```typescript
  /**
   * Autosave dieser Instanz. Immer erzeugt, aber nur aktiv, wenn die Option es
   * verlangt UND der Speicher trägt — `isActive()` ist die Wahrheit, nicht die
   * Option.
   */
  private readonly autosave: Autosave;
```

Erweitere den `sink` im Konstruktor um den Autosave-Anstoß:

```typescript
    const sink = {
      onUpdate: (u: { state: EditorState; docChanged: boolean; selectionSet: boolean }): void => {
        this.toolbar?.update(u.state);
        this.statusbar?.update(u.state, { docChanged: u.docChanged, selectionSet: u.selectionSet });
        this.preview?.update(u.state);
        // Nur bei echter Dokumentänderung — eine Cursorbewegung ist kein Grund
        // zu speichern und würde den Debounce sinnlos verlängern.
        if (u.docChanged) this.autosave.schedule();
      },
    };
```

Baue den Autosave **nach** `this.statusbar = createStatusbar(...)` auf — er schreibt in die Statusbar:

```typescript
    // NACH der Statusbar: onSaved schreibt in sie hinein. Die Instanz wird immer
    // erzeugt (der sink referenziert sie), bleibt ohne autosave-Option aber
    // inaktiv — `start()` verlässt sich bei fehlendem `enabled` sofort wieder.
    //
    // `createAutosave` liest hier den Ausgangswert des Dokuments und merkt ihn
    // als Referenzpunkt für den Restore. Diese Zeile muss deshalb NACH dem
    // View-Aufbau stehen (sonst gäbe es kein Dokument zu lesen) und VOR jeder
    // Gelegenheit, bei der der Host `setValue()` rufen könnte — beides ist im
    // Konstruktor gegeben.
    this.autosave = createAutosave(options.autosave ?? { enabled: false, key: '' }, {
      getValue: () => this.getValue(),
      setValue: (v) => this.setValue(v),
      onSaved: (time) => {
        const zeit = new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(time);
        // Instanz-eigene Statusbar statt easyMDEs globalem
        // getElementById('autosaved') — zwei Editoren auf einer Seite störten
        // sich dort gegenseitig. `setItem` schreibt textContent, kein innerHTML.
        this.statusbar?.setItem('autosave', `Gespeichert: ${zeit}`);
      },
    });
```

Am **Ende** des Konstruktors, nach dem initialen Statusbar-Update:

```typescript
    // Async und bewusst nicht awaited — ein Konstruktor kann nicht warten. Ein
    // eventueller Restore landet als normale Transaktion im Dokument, sobald
    // der Speicher geantwortet hat.
    void this.autosave.start();
```

Ergänze die beiden API-Methoden vor `toTextArea()`:

```typescript
  /**
   * Löscht den gespeicherten Entwurf UND stoppt den laufenden Debounce-Timer.
   * Nach erfolgreichem Speichern im eigenen Backend zu rufen — sonst holt der
   * Editor beim nächsten Öffnen den alten Entwurf zurück.
   */
  async clearAutosavedValue(): Promise<void> {
    await this.autosave.clear();
    this.statusbar?.setItem('autosave', '');
  }

  /** Ob Autosave aktiv ist (aktiviert, `key` gültig, Speicher verfügbar). */
  isAutosaveActive(): boolean {
    return this.autosave.isActive();
  }
```

Ergänze in `toTextArea()` als **erste** Zeile des Rückbaus:

```typescript
    // Nur den Timer abräumen: Der gespeicherte Wert bleibt erhalten — Rückbau
    // des Editors ist kein Signal, den Entwurf zu verwerfen.
    this.autosave.stop();
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/__tests__/autosave-integration.test.ts`
Expected: PASS — alle Tests der Datei grün.

Bleibt „stellt einen gespeicherten Entwurf wieder her" rot, prüfe, ob `void this.autosave.start()` wirklich am Konstruktor-Ende steht — vor dem Statusbar-Aufbau gerufen, liefe `onSaved` gegen eine noch nicht existierende Statusbar.

Bleibt „ein setValue direkt nach der Konstruktion gewinnt" rot, fehlt der
Ausgangswert-Vergleich in `autosave.ts` (Task 2) oder `createAutosave` wird
im Konstruktor an einer Stelle gerufen, an der es noch kein Dokument zu lesen gibt.

- [ ] **Step 5: Gesamtlauf, Lint und Typecheck**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: **alle drei grün.** Diese Task berührt `SupaLike` nicht.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/autosave-integration.test.ts
git commit -m "feat(autosave): Verdrahtung in der Fassade inkl. Statusbar und API"
```

---

## Task 9: Toolbar-Aktion, Upload-Ränder und Verdrahtung in der Fassade

**Files:**
- Create: `src/features/upload-dom.ts`
- Test: `src/features/__tests__/upload-dom.test.ts`
- Modify: `src/ui/actions.ts`
- Test: `src/ui/__tests__/actions.test.ts` (bestehende Datei erweitern)
- Modify: `src/editor/setup.ts`
- Modify: `src/editor/extensions.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/upload-integration.test.ts` (neu)

**Die größte Task des Plans — und das mit Absicht.** `SupaLike` um
`uploadImages`/`openBrowseFileWindow` zu erweitern bricht den `_supaLikeCheck` in
[`src/index.ts:285`](../../../src/index.ts#L285), bis die `SupaMDE`-Klasse beide
Methoden hat. Beides gehört deshalb in denselben Commit, sonst entstünde ein
Zwischenstand mit rotem Typecheck. Die Task ist in sich abgeschlossen und endet
mit einem grünen Gesamtlauf.

**Interfaces:**
- Consumes: `createImageUploader`, `type ImageUploader`, `type UploadImageOptions` aus `./features/image-upload`; `uploadPlaceholderField` aus `./features/upload-placeholder`
- Produces:
  ```typescript
  // src/features/upload-dom.ts
  export function imageFilesFrom(data: DataTransfer | null): File[];
  export function uploadDropPasteExtension(onFiles: (files: File[]) => void): Extension;
  export function openFilePicker(accept: string[], onFiles: (files: File[]) => void): void;

  // src/ui/actions.ts — SupaLike zusätzlich:
  uploadImages(files: FileList | File[]): void;
  openBrowseFileWindow(): void;
  // BUILTIN_ACTIONS['upload-image']: kind 'view', run → openBrowseFileWindow()

  // src/editor/setup.ts — neue Signatur (additiv, dritter Parameter optional):
  export function editorFromTextArea(
    options: SupaMDEOptions,
    sink?: UpdateSink,
    extraExtensions?: Extension[],
  ): EditorHandle;

  // src/editor/extensions.ts — neue Signatur (additiv):
  export function buildExtensions(
    resolved: ResolvedOptions,
    sink?: UpdateSink,
    extraExtensions?: Extension[],
  ): Extension[];

  // Auf der SupaMDE-Klasse:
  uploadImages(files: FileList | File[]): void;
  openBrowseFileWindow(): void;
  // Re-Exports:
  export type { UploadImageOptions, UploadError, UploadTexts } from './features/image-upload';
  ```

**Das Henne-Ei-Problem:** Die Extensions brauchen einen Handler, der auf den Uploader zeigt — den es beim `buildExtensions`-Aufruf noch nicht gibt (er braucht die `view`). Gelöst über eine Indirektion: Die Extension ruft eine Closure, die zur Aufrufzeit auf das dann gesetzte Instanzfeld zugreift.

**Reihenfolge innerhalb der Task:** Erst `actions.ts` (Steps 1–2, der Typecheck
ist ab hier bis Step 12 rot — deshalb wird zwischendurch nicht committet), dann
`upload-dom.ts` (Steps 3–6), dann die Verdrahtung (Steps 7–11). Der Commit in
Step 13 erfolgt erst, wenn alles grün ist.

- [ ] **Step 1: `actions.ts` erweitern und Tests ergänzen**

Ergänze in `src/ui/actions.ts` das `SupaLike`-Interface um zwei Methoden:

```typescript
export interface SupaLike {
  toggleSideBySide(): void;
  toggleFullScreen(): void;
  isSideBySideActive(): boolean;
  isFullscreenActive(): boolean;
  togglePreviewFullScreen(): void;
  isPreviewFullScreenActive(): boolean;
  toggleEditorMode(): void;
  getEditorMode(): EditorMode;
  /** Startet den Upload für die übergebenen Dateien (M5). */
  uploadImages(files: FileList | File[]): void;
  /** Öffnet die Dateiauswahl (M5). */
  openBrowseFileWindow(): void;
}
```

Und im `BUILTIN_ACTIONS`-Record nach `'editor-mode'`:

```typescript
  'upload-image': {
    kind: 'view',
    run: (editor) => editor.openBrowseFileWindow(),
    // Bewusst OHNE `active`: Bild hochladen ist eine Handlung, kein Zustand —
    // ein Aktiv-Zustand hätte nichts anzuzeigen.
    icon: 'upload-image',
    title: 'Bild hochladen',
  },
```

**Nicht anfassen:** `isSupaLike()` in [`src/ui/toolbar.ts:37-46`](../../../src/ui/toolbar.ts#L37-L46) prüft bewusst nur die vier alten Methoden. Sie um die neuen zu erweitern, ließe Host-Objekte durch die Prüfung fallen, die nur die alten implementieren — genau der Grund, aus dem der Kommentar dort steht. Der `'upload-image'`-Button hat kein `active`, braucht die Prüfung also ohnehin nicht.

Erweitere die bestehende Importzeile in `src/ui/__tests__/actions.test.ts` um die beiden Typen (`hasIcon` und `vi` sind dort bereits importiert):

```typescript
import { BUILTIN_ACTIONS, getAction, type ToolbarAction, type SupaLike } from '../actions';
```

Und hänge am Dateiende ein neues `describe` an:

```typescript
describe('BUILTIN_ACTIONS — upload-image', () => {
  it('kennt die Aktion upload-image', () => {
    const action = getAction('upload-image');
    expect(action).toBeDefined();
    expect(action!.kind).toBe('view');
    expect(action!.icon).toBe('upload-image');
  });

  it('upload-image ruft openBrowseFileWindow auf der Instanz', () => {
    const action = getAction('upload-image')!;
    expect(action.kind).toBe('view');
    const openBrowseFileWindow = vi.fn();
    // Nur die von dieser Aktion genutzte Methode wird gebraucht.
    (action as Extract<ToolbarAction, { kind: 'view' }>).run({
      openBrowseFileWindow,
    } as unknown as SupaLike);
    expect(openBrowseFileWindow).toHaveBeenCalledTimes(1);
  });

  it('upload-image hat keinen Aktiv-Zustand', () => {
    const action = getAction('upload-image')!;
    expect((action as Extract<ToolbarAction, { kind: 'view' }>).active).toBeUndefined();
  });

  it('das Icon des Buttons ist bekannt', () => {
    expect(hasIcon(getAction('upload-image')!.icon)).toBe(true);
  });
});
```

- [ ] **Step 2: actions-Tests laufen lassen**

Run: `npx vitest run src/ui/__tests__/actions.test.ts`
Expected: PASS.

Der Typecheck ist ab jetzt **erwartbar rot** (`_supaLikeCheck` in `src/index.ts`)
und wird es bis Step 11 bleiben. Deshalb wird hier **nicht** committet — der
Commit dieser Task kommt erst in Step 13, wenn alles grün ist.

- [ ] **Step 3: Testdatei für `upload-dom.ts` anlegen**

Erstelle `src/features/__tests__/upload-dom.test.ts`:

```typescript
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
    expect(onFiles.mock.calls[0][0][0].name).toBe('a.png');
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
```

- [ ] **Step 4: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/features/__tests__/upload-dom.test.ts`
Expected: FAIL — `Failed to resolve import "../upload-dom"`.

- [ ] **Step 5: `upload-dom.ts` implementieren**

Erstelle `src/features/upload-dom.ts`:

```typescript
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * Die Bilddateien aus einem DataTransfer. Nicht-Bilder werden hier bereits
 * ausgesiebt: Ein Drop mit einem PDF darf NICHT als Bild-Upload gelten und soll
 * ungestört den Standardweg gehen.
 */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = data.files;
  if (!files || files.length === 0) return [];
  return Array.from(files).filter((f) => f.type.startsWith('image/'));
}

/**
 * Drop- und Paste-Handler. Greift NUR ein, wenn Bilddateien im Spiel sind —
 * reiner Text-Drop und Text-Paste laufen unverändert durch den CM6-Standardweg.
 */
export function uploadDropPasteExtension(onFiles: (files: File[]) => void): Extension {
  return EditorView.domEventHandlers({
    drop(event) {
      const files = imageFilesFrom(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      onFiles(files);
      return true;
    },
    paste(event) {
      const files = imageFilesFrom(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      onFiles(files);
      return true;
    },
  });
}

/**
 * Öffnet die Dateiauswahl über einen bei Bedarf erzeugten, versteckten Input.
 *
 * Bewusst NICHT in der Toolbar geparkt: So funktioniert `openBrowseFileWindow()`
 * auch bei `toolbar: false` — bei easyMDE warf derselbe Aufruf ohne Toolbar
 * einen Fehler, weil der Input am Toolbar-DOM hing.
 */
export function openFilePicker(accept: string[], onFiles: (files: File[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = accept.join(',');
  input.style.display = 'none';

  const aufräumen = (): void => {
    input.remove();
  };

  input.addEventListener('change', () => {
    const files = input.files ? Array.from(input.files) : [];
    aufräumen();
    if (files.length > 0) onFiles(files);
  });

  // Bricht der Nutzer den Systemdialog ab, feuert `change` NICHT — ohne diesen
  // Listener bliebe der Input für immer im Body hängen und sammelte sich bei
  // jedem weiteren Klick auf den Toolbar-Button an. `cancel` ist in Firefox erst
  // ab 109 und in Safari erst ab 16.4 verfügbar; wo es fehlt, bleibt genau ein
  // leerer, versteckter Input pro Abbruch liegen — unschön, aber folgenlos, und
  // die Alternative (ein `focus`-Handler auf `window` mit Zeitfenster-Heuristik)
  // wäre für den Gewinn zu viel Maschinerie.
  input.addEventListener('cancel', aufräumen);

  document.body.appendChild(input);
  input.click();
}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/__tests__/upload-dom.test.ts`
Expected: PASS — alle Tests der Datei grün.

- [ ] **Step 7: `extensions.ts` und `setup.ts` um `extraExtensions` erweitern**

In `src/editor/extensions.ts` die Signatur ändern und am Ende einhängen:

```typescript
export function buildExtensions(
  resolved: ResolvedOptions,
  sink?: UpdateSink,
  extraExtensions?: Extension[],
): Extension[] {
```

Direkt vor `return extensions;`:

```typescript
  // Von der Fassade eingeschleuste Extensions (M5: Platzhalter-StateField,
  // Drop/Paste-Handler). Bewusst ZULETZT: Sie sollen die Basis ergänzen, nicht
  // ihr vorgreifen.
  if (extraExtensions) {
    extensions.push(...extraExtensions);
  }
```

In `src/editor/setup.ts` die Signatur ändern und durchreichen:

```typescript
export function editorFromTextArea(
  options: SupaMDEOptions,
  sink?: UpdateSink,
  extraExtensions?: Extension[],
): EditorHandle {
```

Ergänze dort den Typ-Import:

```typescript
import type { Extension } from '@codemirror/state';
```

Und im View-Konstruktor:

```typescript
  const view = new EditorView({
    doc,
    extensions: buildExtensions(resolved, sink, extraExtensions),
  });
```

Beide Parameter sind optional — bestehende Aufrufe und Tests bleiben gültig.

- [ ] **Step 8: Integrationstest für den Upload anlegen**

Erstelle `src/__tests__/upload-integration.test.ts`:

```typescript
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
    expect(warn.mock.calls[0][0]).toContain('upload-image');
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
```

- [ ] **Step 9: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run src/__tests__/upload-integration.test.ts`
Expected: FAIL — `editor.uploadImages is not a function`.

- [ ] **Step 10: `index.ts` um den Upload erweitern**

Ergänze die Imports:

```typescript
import {
  createImageUploader,
  resolveUploadTexts,
  type ImageUploader,
  type UploadImageOptions,
} from './features/image-upload';
import { uploadPlaceholderField } from './features/upload-placeholder';
import { uploadDropPasteExtension, openFilePicker } from './features/upload-dom';
```

Ergänze die Typ-Re-Exports:

```typescript
export type { UploadImageOptions, UploadError, UploadTexts } from './features/image-upload';
```

Ergänze das Instanzfeld:

```typescript
  /**
   * Der Uploader dieser Instanz. Wird NACH der View erzeugt (er braucht sie),
   * die Drop/Paste-Extension zeigt daher über eine Closure auf dieses Feld statt
   * direkt auf den Uploader.
   */
  private uploader: ImageUploader | null = null;
```

Ersetze im Konstruktor den `editorFromTextArea`-Aufruf durch:

```typescript
    // Die Extension wird VOR dem Uploader gebaut — sie kann ihn also nicht
    // direkt referenzieren. Die Closure löst das: Sie liest `this.uploader`
    // erst beim Drop/Paste, wenn das Feld längst gesetzt ist.
    const uploadAktiv = options.uploadImage?.enabled === true;
    const uploadExtensions = uploadAktiv
      ? [
          uploadPlaceholderField,
          uploadDropPasteExtension((files) => this.uploader?.uploadFiles(files)),
        ]
      : [];

    this.handle = editorFromTextArea(options, sink, uploadExtensions);
    this.codemirror = this.handle.view;
```

Ersetze die Toolbar-Erzeugung, damit der Button bei deaktiviertem Upload gar nicht erst erscheint. Ersetze im Konstruktor diese Zeile:

```typescript
    this.toolbar = createToolbar(this.codemirror, options.toolbar, this);
```

durch:

```typescript
    // Spec §4.2: Der Button wird NUR bei aktiviertem Bild-Upload gerendert. Ein
    // Button, dessen Klick folgenlos bleibt, ist schlimmer als gar keiner.
    // Gefiltert wird hier statt in `resolveToolbar`, weil nur die Fassade die
    // `uploadImage`-Option kennt — und ohne Warnung, denn der Name IST gültig.
    // `filter` liefert eine neue Liste; die übergebene Option bleibt unberührt.
    const toolbarOption =
      !uploadAktiv && Array.isArray(options.toolbar)
        ? options.toolbar.filter((eintrag) => eintrag !== 'upload-image')
        : options.toolbar;

    this.toolbar = createToolbar(this.codemirror, toolbarOption, this);
```

Erzeuge den Uploader **nach** `this.statusbar = createStatusbar(options.status)` (er schreibt in die Statusbar) — direkt neben der Autosave-Erzeugung aus Task 8:

```typescript
    // Nur bei aktivierter Option: ohne `upload`-Funktion gibt es nichts zu tun,
    // und `uploadImages()` soll dann folgenlos bleiben.
    if (uploadAktiv && options.uploadImage) {
      this.uploader = createImageUploader(this.codemirror, options.uploadImage, {
        setStatus: (text) => this.statusbar?.setItem('upload-image', text),
      });

      // `setItem` findet ein Item nur, wenn es tatsächlich gerendert wurde —
      // also nur, wenn sein Name in der `status`-Option steht (siehe
      // ui/statusbar.ts). Fehlt es UND fehlt `onError`, verschwinden sämtliche
      // Rückmeldungen des Uploads spurlos: kein Fortschritt, keine Fehler. Das
      // ist eine gültige Konfiguration (ein Host kann das bewusst wollen), aber
      // fast immer ein Versehen. Genau EINE Warnung — der Editor läuft weiter.
      const statusZeigtUpload =
        Array.isArray(options.status) && options.status.includes('upload-image');
      if (!statusZeigtUpload && !options.uploadImage.onError) {
        console.warn(
          'SupaMDE: uploadImage ist aktiviert, aber weder das Statusbar-Item ' +
            "'upload-image' (status-Option) noch uploadImage.onError ist gesetzt — " +
            'Fortschritt und Fehler des Uploads bleiben unsichtbar.',
        );
      }

      // Der Slot zeigt von Anfang an den Einladungstext, nicht erst nach dem
      // ersten Upload — sonst bliebe er beim frisch geöffneten Editor leer.
      this.statusbar?.setItem('upload-image', resolveUploadTexts(options.uploadImage.texts).statusInit);
    }
```

Ergänze dafür `resolveUploadTexts` im Import aus `./features/image-upload`.

Ergänze die beiden API-Methoden vor `toTextArea()`:

```typescript
  /**
   * Startet den Upload für die übergebenen Dateien. Jede Datei wird einzeln
   * validiert; ungültige werden über `onError` gemeldet, ohne die gültigen
   * aufzuhalten. Ohne aktivierten Bild-Upload folgenlos.
   */
  uploadImages(files: FileList | File[]): void {
    this.uploader?.uploadFiles(files);
  }

  /**
   * Öffnet die Dateiauswahl. Der Input wird bei Bedarf erzeugt und nicht in der
   * Toolbar geparkt — funktioniert deshalb auch bei `toolbar: false`.
   */
  openBrowseFileWindow(): void {
    if (!this.uploader) return;
    openFilePicker(this.uploader.accept(), (files) => this.uploader?.uploadFiles(files));
  }
```

Ergänze in `toTextArea()` neben dem `this.autosave.stop()` aus Task 8:

```typescript
    // Wie beim Autosave nur die Zeitgeber: Der Rückfall-Timer der Statusanzeige
    // liefe sonst nach dem Rückbau weiter und schriebe gegen eine zerstörte
    // Statusbar. Laufende Uploads bleiben unangetastet — ihre Promise gehört dem
    // Host, und ihr Ergebnis findet über den verschwundenen Platzhalter ohnehin
    // kein Ziel mehr.
    this.uploader?.destroy();
```

Der `_supaLikeCheck` am Dateiende ist damit wieder erfüllt.

- [ ] **Step 11: Tests laufen lassen**

Run: `npx vitest run src/__tests__/upload-integration.test.ts`
Expected: PASS — alle Tests der Datei grün.

- [ ] **Step 12: Vollständige Verifikation**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: **alle drei grün**. Der ab Step 1 erwartete `_supaLikeCheck`-Fehler ist
jetzt behoben — läuft der Typecheck nicht durch, fehlt eine der beiden neuen
`SupaLike`-Methoden auf der Klasse.

- [ ] **Step 13: Build prüfen**

Run: `npm run build`
Expected: Build ohne Fehler, `dist/index.d.ts` enthält `uploadImages` und `clearAutosavedValue`.

Prüfen mit: `grep -c 'uploadImages\|clearAutosavedValue' dist/index.d.ts` — erwartet: mindestens 2.

- [ ] **Step 14: Commit**

```bash
git add src/features/upload-dom.ts src/features/__tests__/upload-dom.test.ts \
  src/ui/actions.ts src/ui/__tests__/actions.test.ts \
  src/editor/setup.ts src/editor/extensions.ts src/index.ts \
  src/__tests__/upload-integration.test.ts
git commit -m "feat(upload): Toolbar-Aktion, Drop/Paste/Dateiauswahl und Fassaden-Verdrahtung"
```

---

## Task 10: README aktualisieren

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: die tatsächlich implementierten Signaturen aus allen vorherigen Tasks
- Produces: nichts (Dokumentation)

**Teil der Definition of Done, nicht Nacharbeit** (Spec §7). Da M5 die Backend-Anbindung bewusst zum Host verlagert, schuldet SupaMDE eine Anleitung, die das trägt.

- [ ] **Step 1: Signaturen gegen den Code prüfen**

Bevor irgendein Beispiel geschrieben wird, die tatsächlichen Signaturen ansehen:

Run: `grep -n 'clearAutosavedValue\|isAutosaveActive\|uploadImages\|openBrowseFileWindow' src/index.ts`
Run: `grep -n 'export interface\|export const DEFAULT' src/features/autosave.ts src/features/storage.ts src/features/image-upload.ts`

Jedes Beispiel im README muss zu dieser Ausgabe passen. Eine Doku, die an der API vorbeigeht, ist schlimmer als keine.

- [ ] **Step 2: Abschnitt `## Autosave (M5)` einfügen**

Einzufügen **nach** dem Abschnitt `## Editor-Modus (Live-Vorschau)` und **vor** `## API (M1)`:

````markdown
## Autosave (M5)

Autosave sichert den Inhalt in einem austauschbaren Speicher — der Entwurf
überlebt Absturz, versehentliches Schließen und Reload. Per Default **aus**.

Das Minimum sind zwei Zeilen:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'artikel-42' },
});
```

Mit Statusanzeige und Hinweis bei wiederhergestelltem Entwurf:

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: {
    enabled: true,
    key: 'artikel-42',
    delay: 1000,
    onRestore: (entwurf) => {
      hinweisAnzeigen(`Ein ungespeicherter Entwurf wurde wiederhergestellt (${entwurf.length} Zeichen).`);
    },
  },
  status: ['lines', 'words', 'cursor', 'autosave'],
});
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Aktiviert Autosave. |
| `key` | `string` | — | **Pflicht.** Identifiziert das Dokument im Speicher. |
| `delay` | `number` | `1000` | Debounce nach der letzten Änderung, in ms. |
| `storage` | `SupaStorage` | localStorage | Eigener Speicher (siehe unten). |
| `onRestore` | `(saved: string) => void` | — | Wird gerufen, wenn beim Start ein Entwurf geladen wurde. |

**Den `key` sorgfältig wählen.** Er ist die einzige Unterscheidung zwischen zwei
Dokumenten. Zwei Editoren mit demselben `key` überschreiben sich gegenseitig —
in der Praxis also die Dokument-ID mitnehmen, nicht `'editor'`:

```js
autosave: { enabled: true, key: `artikel-${artikelId}` }
```

Im localStorage landet der Eintrag unter `supamde:<key>`.

**Wann wiederhergestellt wird.** Beim Start liest SupaMDE den gespeicherten
Stand. Ist er nicht leer **und** weicht er vom aktuellen Dokument ab, gewinnt er
gegenüber dem Inhalt der Textarea und `onRestore` wird gerufen. Stimmen beide
überein, passiert nichts — es gibt keinen Entwurf wiederherzustellen, wenn er
dem Ausgangsinhalt gleicht.

**Ein `setValue()` direkt nach der Konstruktion gewinnt.** Das Lesen des
Speichers ist asynchron; zwischen `new SupaMDE(...)` und dem Wiederherstellen
liegt mindestens ein Tick. Wer in dieser Zeit selbst Inhalt setzt — Formular
vorbefüllen, Inhalt nachladen — behält ihn: SupaMDE stellt nur wieder her, wenn
das Dokument seit der Konstruktion unberührt ist. Der Entwurf bleibt gespeichert
und ist beim nächsten Öffnen wieder ein Kandidat.

```js
const editor = new SupaMDE({ element: el, autosave: { enabled: true, key: 'artikel-42' } });
// Gewinnt gegen einen gespeicherten Entwurf — der Host weiß mehr über seinen Fall.
editor.value(await inhaltLaden());
```

SupaMDE zeigt dafür **kein eigenes UI**: `onRestore` gibt dem Host die
Möglichkeit, selbst eine Notiz einzublenden, mit „Verwerfen"-Schaltfläche oder
ohne.

**`clearAutosavedValue()` nach dem echten Speichern rufen.** Das ist der Punkt,
den man leicht übersieht: Nach erfolgreichem Speichern im eigenen Backend ist
der lokale Entwurf hinfällig. Wird er nicht gelöscht, holt der Editor beim
nächsten Öffnen den alten Stand zurück und überschreibt damit die frisch
gespeicherte Fassung.

```js
async function speichern() {
  await fetch('/api/artikel/42', {
    method: 'PUT',
    body: JSON.stringify({ inhalt: editor.value() }),
  });
  // Erst NACH dem erfolgreichen Speichern — sonst ist der Entwurf weg,
  // obwohl der Server ihn nie bekommen hat.
  await editor.clearAutosavedValue();
}
```

`clearAutosavedValue()` stoppt zusätzlich den laufenden Debounce-Timer. Ohne das
schriebe die nächste Änderung den gerade gelöschten Eintrag sofort zurück.

**Statusbar.** Das Item `'autosave'` zeigt nach jedem Speichern
`Gespeichert: HH:MM` in der Locale der Umgebung. Es gehört **nicht** zu
`DEFAULT_STATUS` — wer es will, nimmt es in die `status`-Option auf (siehe
Beispiel oben).

**Eigener Speicher.** Der `SupaStorage`-Vertrag ist absichtlich schmal und
async-fähig, damit ein Server-Backend oder IndexedDB ohne Zusatzschicht passt:

```ts
interface SupaStorage {
  load(key: string): string | null | Promise<string | null>;
  save(key: string, value: string): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}
```

Ein Entwurfs-Endpunkt am eigenen Backend, in voller Länge:

```js
const serverStorage = {
  async load(key) {
    const res = await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Entwurf laden fehlgeschlagen: ${res.status}`);
    const daten = await res.json();
    return daten.inhalt;
  },
  async save(key, value) {
    const res = await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inhalt: value }),
    });
    if (!res.ok) throw new Error(`Entwurf speichern fehlgeschlagen: ${res.status}`);
  },
  async clear(key) {
    await fetch(`/api/entwuerfe/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },
};

new SupaMDE({
  element: document.querySelector('#editor'),
  autosave: { enabled: true, key: 'artikel-42', storage: serverStorage },
});
```

**Wenn der Speicher nicht trägt** — Quota erschöpft, Private Mode, Server nicht
erreichbar — warnt SupaMDE **einmal** auf der Konsole und schaltet Autosave still
ab. Nicht bei jedem Tastendruck erneut. `isAutosaveActive()` liefert dann `false`.

**Kein Konfliktauflösen.** Der gespeicherte Stand gewinnt gegenüber dem
Ausgangsinhalt; einen Abgleich mit einem parallel geänderten Server-Stand nimmt
SupaMDE nicht vor. `onRestore` ist die Stelle, an der der Host das selbst
entscheiden kann.

**Beim Rückbau.** `toTextArea()` räumt den laufenden Timer ab, lässt den
gespeicherten Wert aber stehen — den Editor zu schließen ist kein Signal, den
Entwurf zu verwerfen.

| Methode | Beschreibung |
|---|---|
| `clearAutosavedValue()` | Stoppt den Timer **und** löscht den Eintrag. `Promise<void>`. |
| `isAutosaveActive()` | Ob Autosave aktiv ist (aktiviert, `key` gültig, Speicher verfügbar). |
````

- [ ] **Step 3: Abschnitt `## Bild-Upload (M5)` einfügen**

Direkt **nach** dem Autosave-Abschnitt:

````markdown
## Bild-Upload (M5)

Bilder landen per Drag & Drop, Einfügen aus der Zwischenablage oder Dateiauswahl
im Dokument. Per Default **aus**.

### Wie es funktioniert

1. **Validierung** — Größe gegen `maxSize`, MIME-Typ gegen `accept`. Wird eine
   Datei abgelehnt, passiert im Dokument **nichts**: nur Statusbar und `onError`.
2. **Platzhalter** — `![Uploading foo.png…]()` wird an der Cursorposition
   eingefügt und ab da im Dokument mitverfolgt. Tippt man davor weiter, wandert
   er mit.
3. **`upload(file)`** — deine Funktion lädt hoch und liefert die URL.
4. **Ersetzung** — der Platzhalter wird an seiner *aktuellen* Position durch
   `![foo.png](url)` ersetzt, nicht an der ursprünglichen.

Zwischen Schritt 2 und 4 kann beliebig weitergetippt werden; das Bild landet
trotzdem an der richtigen Stelle. Löscht man den Platzhalter von Hand oder
ersetzt `setValue()` das Dokument, wird **nichts** eingefügt — ein Bild, das in
ein inzwischen fremdes Dokument hineinspringt, wäre schlimmer als ein verlorener
Upload.

### Der `upload`-Vertrag

```ts
upload: (file: File) => Promise<string>
```

Datei rein, URL raus, **wirft bei Fehler**. Das ist die gesamte Schnittstelle zur
Außenwelt. SupaMDE bringt **keinen** HTTP-Client, kein festes Response-Format,
keine CSRF-Optionen und keine Endpoint-Option mit: Auth, Fehlerformate und
Upload-Flows (direkt, presigned, SDK) unterscheiden sich pro Projekt so stark,
dass jede eingebaute Variante für die Mehrheit falsch wäre.

```js
const editor = new SupaMDE({
  element: document.querySelector('#editor'),
  uploadImage: {
    enabled: true,
    upload: async (file) => {
      const daten = new FormData();
      daten.append('datei', file);
      const res = await fetch('/api/bilder', { method: 'POST', body: daten });
      if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
      const { url } = await res.json();
      return url;
    },
  },
  toolbar: ['bold', 'italic', '|', 'image', 'upload-image'],
  status: ['lines', 'words', 'cursor', 'upload-image'],
});
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Aktiviert den Bild-Upload. |
| `upload` | `(file: File) => Promise<string>` | — | **Pflicht.** Lädt hoch, liefert die URL, wirft bei Fehler. |
| `maxSize` | `number` | `2097152` (2 MB) | Maximale Dateigröße in Bytes. |
| `accept` | `string[]` | PNG, JPEG, GIF, WebP, AVIF, SVG | Erlaubte MIME-Typen. |
| `texts` | `Partial<UploadTexts>` | — | Überschreibt einzelne Anzeigetexte. |
| `onError` | `(error: UploadError) => void` | — | Wird bei jedem Fehler gerufen. |

**Toolbar-Button und Statusbar-Item** heißen beide `'upload-image'` und gehören
**nicht** zu den Defaults — wer sie will, nimmt sie in die jeweilige Option auf
(siehe Beispiel oben). Der Button öffnet die Dateiauswahl. `openBrowseFileWindow()`
funktioniert auch bei `toolbar: false`, weil der Datei-Input bei Bedarf erzeugt
und nicht in der Toolbar geparkt wird.

> **Ohne Statusbar-Item und ohne `onError` bleibt der Upload stumm.** Die
> Rückmeldungen gehen ausschließlich an das Statusbar-Item `'upload-image'` und
> an `onError`. Fehlen beide, laufen Uploads unsichtbar — auch Fehler. SupaMDE
> warnt in dem Fall einmal auf der Konsole. Mindestens eines von beiden gehört
> in die Konfiguration:
>
> ```js
> status: ['lines', 'words', 'cursor', 'upload-image'],  // sichtbarer Fortschritt
> // oder/und
> uploadImage: { enabled: true, upload: meinUpload, onError: zeigeToast },
> ```

**Mehrere Dateien** laufen parallel, jede mit eigenem Platzhalter. Die Zuordnung
bleibt korrekt, auch wenn der zweite Upload vor dem ersten fertig wird. Enthält
eine Auswahl gültige und ungültige Dateien, werden die gültigen hochgeladen und
die ungültigen einzeln gemeldet.

**Nicht-Bild-Dateien** werden abgewiesen (`type-not-allowed`), nicht als Link
eingefügt. Das Feature heißt Bild-Upload.

### Backend-Beispiele

**1. `fetch` gegen einen eigenen Endpunkt** — der Standardfall, mit CSRF-Header
und ausgewertetem Fehlerstatus:

```js
upload: async (file) => {
  const daten = new FormData();
  daten.append('datei', file);

  const res = await fetch('/api/bilder', {
    method: 'POST',
    body: daten,
    credentials: 'same-origin',
    headers: {
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
    },
  });

  if (!res.ok) {
    // Der Fehlertext des Servers ist oft die nützlichste Information —
    // er landet über onError beim Host.
    const text = await res.text().catch(() => '');
    throw new Error(`Upload fehlgeschlagen (${res.status}): ${text}`);
  }

  const { url } = await res.json();
  return url;
}
```

**2. Presigned Upload (S3 oder kompatibel)** — Signatur beim eigenen Backend
holen, direkt zum Storage hochladen, öffentliche URL zurückgeben:

```js
upload: async (file) => {
  // Schritt 1: Das eigene Backend signiert den Upload. Nur hier ist Auth nötig.
  const signRes = await fetch('/api/uploads/signieren', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  });
  if (!signRes.ok) throw new Error(`Signatur fehlgeschlagen: ${signRes.status}`);
  const { uploadUrl, publicUrl } = await signRes.json();

  // Schritt 2: direkt zum Storage — die Datei berührt das eigene Backend nie.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!putRes.ok) throw new Error(`Storage-Upload fehlgeschlagen: ${putRes.status}`);

  return publicUrl;
}
```

**3. Supabase Storage** — in wenigen Zeilen:

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

upload: async (file) => {
  const pfad = `bilder/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('medien').upload(pfad, file, {
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('medien').getPublicUrl(pfad);
  return data.publicUrl;
}
```

### Was der Endpunkt leisten muss

Die Client-Validierung ist **Komfort, keine Sicherheit** — sie lässt sich mit
zwei Zeilen in der Konsole umgehen. Der Endpunkt muss selbst prüfen:

- **Größe serverseitig begrenzen**, unabhängig von `maxSize`.
- **Typ serverseitig prüfen**, und zwar am Inhalt (Magic Bytes), nicht am
  vom Client geschickten `Content-Type`.
- **Dateinamen nicht ungeprüft übernehmen.** `../../etc/passwd` ist ein
  gültiger Dateiname. Am besten einen eigenen Namen vergeben und den
  Originalnamen nur als Metadatum speichern.
- **SVG mit Vorsicht.** SVG kann Skripte enthalten. Wer es zulässt, sollte es
  serverseitig bereinigen oder von einer separaten Domain ausliefern. Wer es
  nicht braucht, nimmt `'image/svg+xml'` aus der `accept`-Liste.
- **Sinnvolle Statuscodes** zurückgeben: `413` für zu groß, `415` für falschen
  Typ, `401`/`403` für fehlende Berechtigung. Der Fehlertext landet über
  `onError` beim Host und kann dort angezeigt werden.

### Fehlerbehandlung

Fehler werden **strukturiert** gemeldet, nicht vorformatiert — der Host kann
selbst darstellen und übersetzen:

```ts
interface UploadError {
  kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
  file: File;
  /** Der ursprüngliche Fehler aus upload(), bei kind === 'upload-failed'. */
  cause?: unknown;
}
```

```js
uploadImage: {
  enabled: true,
  upload: meinUpload,
  onError: (fehler) => {
    switch (fehler.kind) {
      case 'too-large':
        toast.fehler(`${fehler.file.name} ist größer als 2 MB.`);
        break;
      case 'type-not-allowed':
        toast.fehler(`${fehler.file.name}: nur PNG, JPEG, GIF, WebP, AVIF und SVG.`);
        break;
      case 'upload-failed':
        toast.fehler('Der Upload ist fehlgeschlagen. Bitte erneut versuchen.');
        console.error(fehler.cause);
        break;
    }
  },
}
```

**Kein `alert()`.** SupaMDE reißt bei einem Upload-Fehler keinen blockierenden
Browser-Dialog auf. Default ist die Statusbar-Meldung; wer mehr will, nutzt
`onError`.

**Timeouts gehören in deine `upload`-Funktion.** Ein `upload()`, das nie
auflöst, lässt den Platzhalter stehen. Das ist Absicht: SupaMDE kennt deine
Latenzen nicht, du schon.

```js
upload: async (file) => {
  const abbruch = new AbortController();
  const timer = setTimeout(() => abbruch.abort(), 30_000);
  try {
    const daten = new FormData();
    daten.append('datei', file);
    const res = await fetch('/api/bilder', {
      method: 'POST',
      body: daten,
      signal: abbruch.signal,
    });
    if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
    return (await res.json()).url;
  } finally {
    clearTimeout(timer);
  }
}
```

### Anzeigetexte anpassen

Platzhalter sind benannt und stehen in geschweiften Klammern; **alle** Vorkommen
werden ersetzt.

```js
uploadImage: {
  enabled: true,
  upload: meinUpload,
  texts: {
    placeholder: '![Uploading {name}…]()',
    statusInit: 'Bild hierher ziehen oder einfügen',
    statusUploading: 'Lade {name} hoch…',
    statusDone: '{name} hochgeladen',
    errorTooLarge: '{name} ist zu groß (max. {maxSize}).',
    errorType: '{name} ist kein unterstütztes Bildformat.',
    errorFailed: 'Upload von {name} fehlgeschlagen.',
  },
}
```

Nach Erfolg fällt die Statusanzeige nach etwa 2 s auf `statusInit` zurück, nach
einem Fehler nach etwa 6 s. Laufen mehrere Uploads gleichzeitig, erfolgt der
Rückfall erst, wenn kein Upload mehr offen ist.

### Nicht enthalten

- **Kein Fortschritt in Prozent** — die Promise-API liefert keine
  Fortschritts-Events.
- **Keine Bildvorschau im Editor** — gehört in die Live-Preview-Ausbaustufe,
  nicht in ein Upload-Feature.
- **Keine Bildbearbeitung** (Verkleinern, Zuschneiden, Konvertieren). Wer das
  braucht, macht es in seiner `upload`-Funktion, bevor sie hochlädt.

| Methode | Beschreibung |
|---|---|
| `uploadImages(files)` | Startet den Upload für `FileList` oder `File[]`. |
| `openBrowseFileWindow()` | Öffnet die Dateiauswahl. |
````

- [ ] **Step 4: API-Tabelle ergänzen**

In der Tabelle unter `## API (M1)` vier Zeilen am Ende anhängen:

```markdown
| `clearAutosavedValue()`         | Entwurf löschen und Timer stoppen (M5).                  |
| `isAutosaveActive()`            | `true` wenn Autosave aktiv (M5).                         |
| `uploadImages(files)`           | Upload für `FileList`/`File[]` starten (M5).             |
| `openBrowseFileWindow()`        | Dateiauswahl öffnen (M5).                                |
```

- [ ] **Step 5: Built-in-Listen ergänzen**

Prüfe die Abschnitte `## Toolbar & Statusbar (M3)` und `## Optionen (Kern-Set, M1)`:

Run: `grep -n "'editor-mode'\|autosave\|Built-in" README.md`

- Ergänze in der Liste der Built-in-Toolbar-Namen `'upload-image'` mit dem
  Hinweis „nur bei aktiviertem Bild-Upload sinnvoll; nicht im Default".
- Ergänze in der Liste der Built-in-Statusbar-Namen `'upload-image'` neben dem
  bereits genannten `'autosave'`; beide sind nicht Teil von `DEFAULT_STATUS`.
- Ergänze in der Optionstabelle des Kern-Sets zwei Zeilen mit Verweis auf die
  neuen Abschnitte:

```markdown
| `autosave`     | `AutosaveOptions`    | —       | Autosave, siehe [Autosave (M5)](#autosave-m5). |
| `uploadImage`  | `UploadImageOptions` | —       | Bild-Upload, siehe [Bild-Upload (M5)](#bild-upload-m5). |
```

- [ ] **Step 6: Beispiele gegen die echte API gegenprüfen**

Jedes Codebeispiel muss zur Implementierung passen. Prüfe im Einzelnen:

- Optionsnamen: `enabled`, `key`, `delay`, `storage`, `onRestore`, `upload`,
  `maxSize`, `accept`, `texts`, `onError`
- Methodennamen: `clearAutosavedValue`, `isAutosaveActive`, `uploadImages`,
  `openBrowseFileWindow`
- `UploadError.kind`-Werte: `'too-large'`, `'type-not-allowed'`, `'upload-failed'`
- Die Namen der `UploadTexts`-Felder gegen `DEFAULT_UPLOAD_TEXTS` in
  `src/features/image-upload.ts`
- Die `SupaStorage`-Methodennamen gegen `src/features/storage.ts`

Run: `grep -n "placeholder:\|statusInit:\|statusUploading:\|statusDone:\|errorTooLarge:\|errorType:\|errorFailed:" src/features/image-upload.ts README.md`
Expected: die Feldnamen aus dem README stimmen mit denen aus `DEFAULT_UPLOAD_TEXTS` überein.

- [ ] **Step 7: Formatierung prüfen**

Run: `npx prettier --check README.md`
Falls Abweichungen: `npx prettier --write README.md`

- [ ] **Step 8: Vollständige Schlussverifikation**

Run: `npm run test:run && npm run lint && npm run typecheck && npm run build`
Expected: alle vier grün.

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs(readme): Autosave- und Bild-Upload-Abschnitte für M5"
```

---

## Abschluss

Nach Task 10 ist M5 vollständig. Zur Kontrolle gegen die Spec:

| Spec-Abschnitt | Umgesetzt in |
|---|---|
| §2 Modulschnitt (4 Module) | Tasks 1, 2, 3, 5 (+ `upload-dom.ts` als fünftes in Task 9, `util/text-format.ts` als sechstes in Task 4) |
| §3.1 Autosave-Optionen | Task 2 (Interface), Task 7 (in `SupaMDEOptions`) |
| §3.2 `SupaStorage` | Task 1 |
| §3.3 Ablauf (Restore, Debounce, leerer Inhalt, Statusbar, `toTextArea`) | Task 2, Task 6, Task 8 |
| §3.4 `clearAutosavedValue`, `isAutosaveActive` | Task 8 |
| §3.5 Abweichungen von easyMDE | Tasks 2, 6, 8 (jeweils im Code kommentiert) |
| §4.1 Upload-Optionen | Task 5 (Interface), Task 7 (in `SupaMDEOptions`) |
| §4.2 Auslöser (Drop, Paste, Button) | Task 9 (`upload-dom.ts` + Aktion) |
| §4.2 Button nur bei `enabled` | Task 9 (Filterung in der Fassade + Test) |
| §4.3 Platzhalter-Mechanik | Task 3 (StateField), Task 5 (Orchestrierung) |
| §4.4 Anzeigetexte, Statusbar-Item | Task 4 (`formatText`), Task 5 (Texte), Task 6 (Item) |
| §4.5 `uploadImages`, `openBrowseFileWindow` | Task 9 |
| §5.1 `UploadError` | Task 5 |
| §5.2 Kein `alert()` | Task 5 (nur Statusbar + `onError`) |
| §5.3 Speicher-Fehler, einmalige Warnung | Task 2 |
| §6 Teststrategie | Tasks 1–9, jeweils Step 1 |
| §7 Dokumentation | Task 10 |
| §8 YAGNI-Grenzen | überall: nichts davon wird gebaut |

**Über die Spec hinaus** — aus der Planprüfung hervorgegangen, jeweils mit Test:

| Ergänzung | Warum | Task |
|---|---|---|
| Restore respektiert ein Host-`setValue()` nach der Konstruktion | `start()` ist async; ohne Referenz auf den Ausgangswert überschriebe der Entwurf nachgeladenen Inhalt | Task 2, Test in Task 8 |
| `ImageUploader.destroy()`, gerufen aus `toTextArea()` | Der Rückfall-Timer der Statusanzeige lief sonst nach dem Rückbau weiter | Task 5, Verdrahtung in Task 9 |
| `formatText`/`formatBytes` in `util/text-format.ts` | Generische Textwerkzeuge ohne Upload-Bezug — in `image-upload.ts` erzwängen sie eine falsche Abhängigkeitsrichtung | Task 4 |
| `createIdSource()` statt modul-globalem Zähler | Geteilter Modulzustand macht Tests reihenfolgeabhängig | Task 3 |
| `openFilePicker` räumt auch bei Abbruch auf (`cancel`) | Ohne das bliebe pro Abbruch ein versteckter Input im Body zurück | Task 9 |
| Warnung bei aktivem Upload ohne Statusbar-Item und ohne `onError` | Sonst laufen Uploads inklusive Fehler vollständig unsichtbar | Task 9 |
| Toolbar-Filter-Test prüft den Fall, in dem der Filter greift | Der ursprüngliche Test lief am riskanten Fall vorbei | Task 9 |

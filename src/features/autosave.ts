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

    let gespeichert: string | null;
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

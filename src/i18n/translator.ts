import type { Locale, LocaleTexts, PluralText, PluralTextKey, SimpleTextKey } from './types';
import { en } from './en';
import { formatText } from '../util/text-format';

/** Liefert die UI-Texte einer Instanz. Einmal pro Instanz erzeugt, danach unveränderlich. */
export interface Translator {
  /** Effektiver Locale-Code (nach Gültigkeitsprüfung). */
  readonly code: string;
  /** Einfacher Text mit Platzhaltern. */
  t(key: SimpleTextKey, params?: Record<string, string>): string;
  /** Pluralform zu `count`; setzt `{count}` und weitere Platzhalter ein. */
  plural(key: PluralTextKey, count: number, params?: Record<string, string>): string;
  /** Uhrzeit HH:MM im Format des Locale-Codes. */
  formatTime(date: Date): string;
}

const FALLBACK_CODE = 'en';
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/**
 * Prüft, ob `value` als Wert für einen Schlüssel taugt, dessen en-Wert `reference`
 * ist: ein String für einfache Texte, ein Objekt mit String-`other` für
 * Pluraltexte. Alles andere (undefined, Zahlen, String statt PluralText, …) kommt
 * nur aus JavaScript oder Casts — es fällt still auf die nächste Ebene zurück,
 * statt `undefined` ins UI zu schreiben.
 */
function isUsable(reference: string | PluralText, value: unknown): boolean {
  if (typeof reference === 'string') return typeof value === 'string';
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PluralText>).other === 'string'
  );
}

/**
 * Führt die Ebenen zu EINEM vollständigen Textobjekt zusammen; spätere Ebenen
 * haben Vorrang. Iteriert über die en-Schlüssel — unbekannte Schlüssel in
 * `texts` fallen dadurch von selbst heraus. Mutiert keine Eingabe.
 */
function mergeTexts(layers: Array<Partial<LocaleTexts> | undefined>): LocaleTexts {
  const merged: Record<string, string | PluralText> = { ...en.texts };
  for (const layer of layers) {
    if (typeof layer !== 'object' || layer === null) continue;
    for (const key of Object.keys(en.texts) as (keyof LocaleTexts)[]) {
      const value: unknown = layer[key];
      if (isUsable(en.texts[key], value)) merged[key] = value as string | PluralText;
    }
  }
  return merged as unknown as LocaleTexts;
}

/**
 * Erzeugt Pluralregeln und Zeitformat EINMAL — `plural()` läuft bei jeder
 * Dokumentänderung. Bei ungültigem Code (Intl wirft `RangeError`) genau eine
 * Warnung und Rückfall auf `'en'`: wie bei `resolveEditorMode` darf eine
 * Fehlkonfiguration den Editor nicht am Starten hindern.
 */
function createIntl(code: unknown): {
  code: string;
  rules: Intl.PluralRules;
  time: Intl.DateTimeFormat;
} {
  if (typeof code === 'string') {
    try {
      return {
        code,
        rules: new Intl.PluralRules(code),
        time: new Intl.DateTimeFormat(code, TIME_FORMAT),
      };
    } catch {
      // fällt auf den Rückfall unten durch
    }
  }
  console.warn(
    `SupaMDE: invalid locale code "${String(code)}" — using "${FALLBACK_CODE}" for plural rules and time format.`,
  );
  return {
    code: FALLBACK_CODE,
    rules: new Intl.PluralRules(FALLBACK_CODE),
    time: new Intl.DateTimeFormat(FALLBACK_CODE, TIME_FORMAT),
  };
}

/**
 * Baut den Translator einer Instanz. Rangfolge pro Schlüssel:
 * `texts` → `locale.texts` → `en.texts`.
 */
export function createTranslator(locale?: Locale, texts?: Partial<LocaleTexts>): Translator {
  const merged = mergeTexts([locale?.texts, texts]);
  const intl = createIntl(locale == null ? FALLBACK_CODE : locale.code);
  // Für Laufzeitzugriffe mit Schlüsseln, die der Typ nicht kennt (Toolbar-Cast).
  const lookup = merged as unknown as Record<string, unknown>;

  return {
    code: intl.code,
    t(key, params = {}) {
      const text = lookup[key];
      return typeof text === 'string' ? formatText(text, params) : key;
    },
    plural(key, count, params = {}) {
      const entry = merged[key];
      const candidate: unknown = entry[intl.rules.select(count)];
      // Nur ein String taugt als Form: `isUsable` prüft bei Pluraltexten nur `other`,
      // eine Zahl oder ein Objekt als Einzelform käme sonst bis `formatText`.
      const form = typeof candidate === 'string' ? candidate : entry.other;
      // `count` zuletzt: der Zählwert ist maßgeblich, auch wenn `params` ihn enthält.
      return formatText(form, { ...params, count: String(count) });
    },
    formatTime(date) {
      return intl.time.format(date);
    },
  };
}

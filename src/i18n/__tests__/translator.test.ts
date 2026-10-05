import { describe, it, expect, vi, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createTranslator } from '../translator';
import { translatorFacet } from '../facet';
import { en } from '../en';
import { de } from '../de';
import type { Locale, LocaleTexts, SimpleTextKey } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

/** 14:05 Uhr Ortszeit — Formatierung nutzt dieselbe Zeitzone, das Ergebnis ist stabil. */
const vierzehnNullFünf = new Date(2026, 0, 1, 14, 5);

describe('createTranslator — Rangfolge texts → locale → en', () => {
  it('ohne Argumente gilt en', () => {
    const t = createTranslator();
    expect(t.code).toBe('en');
    expect(t.t('toolbar.bold')).toBe('Bold');
  });

  it('locale ersetzt en', () => {
    expect(createTranslator(de).t('toolbar.bold')).toBe('Fett');
  });

  it('texts hat Vorrang vor locale, der Rest kommt aus locale', () => {
    const t = createTranslator(de, { 'toolbar.bold': 'Fettdruck' });
    expect(t.t('toolbar.bold')).toBe('Fettdruck');
    expect(t.t('toolbar.italic')).toBe('Kursiv');
  });

  it('texts ohne locale überschreibt en', () => {
    const t = createTranslator(undefined, { 'toolbar.bold': 'Strong' });
    expect(t.t('toolbar.bold')).toBe('Strong');
    expect(t.t('toolbar.italic')).toBe('Italic');
  });

  it('fehlende Schlüssel einer unvollständigen Locale fallen still auf en zurück', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fr = { code: 'fr', texts: { 'toolbar.bold': 'Gras' } } as unknown as Locale;
    const t = createTranslator(fr);
    expect(t.t('toolbar.bold')).toBe('Gras');
    expect(t.t('toolbar.italic')).toBe('Italic');
    expect(t.plural('status.lines', 2)).toBe('2 lines');
    expect(warn).not.toHaveBeenCalled();
  });

  it('übersteht eine Locale ganz ohne texts', () => {
    const fr = { code: 'fr' } as unknown as Locale;
    expect(createTranslator(fr).t('toolbar.bold')).toBe('Bold');
  });

  it('ignoriert undefined, unbekannte Schlüssel und Werte vom falschen Typ', () => {
    const texts = {
      'toolbar.bold': undefined,
      'toolbar.gibt-es-nicht': 'x',
      'toolbar.italic': 42,
      'status.lines': 'kein Objekt',
      'status.words': { one: 'ohne other' },
    } as unknown as Partial<LocaleTexts>;
    const t = createTranslator(de, texts);
    expect(t.t('toolbar.bold')).toBe('Fett');
    expect(t.t('toolbar.italic')).toBe('Kursiv');
    expect(t.plural('status.lines', 2)).toBe('2 Zeilen');
    expect(t.plural('status.words', 1)).toBe('1 Wort');
  });

  it('liefert bei einem zur Laufzeit unbekannten Schlüssel den Schlüssel selbst', () => {
    expect(createTranslator().t('toolbar.gibt-es-nicht' as SimpleTextKey)).toBe(
      'toolbar.gibt-es-nicht',
    );
  });

  it('mutiert weder locale noch texts', () => {
    const texts = { 'toolbar.bold': 'X' };
    const vorher = JSON.stringify(de);
    createTranslator(de, texts);
    expect(JSON.stringify(de)).toBe(vorher);
    expect(texts).toEqual({ 'toolbar.bold': 'X' });
  });
});

describe('createTranslator — Platzhalter', () => {
  it('t setzt Platzhalter ein', () => {
    expect(createTranslator().t('upload.statusUploading', { name: 'a.png' })).toBe(
      'Uploading a.png…',
    );
  });

  it('Platzhalter ohne Wert bleiben als Text stehen', () => {
    expect(createTranslator().t('upload.statusUploading')).toBe('Uploading {name}…');
  });

  it('plural setzt {count} und weitere Platzhalter ein', () => {
    const t = createTranslator(undefined, {
      'status.lines': { one: '{count} line in {file}', other: '{count} lines in {file}' },
    });
    expect(t.plural('status.lines', 3, { file: 'a.md' })).toBe('3 lines in a.md');
  });
});

describe('createTranslator — Pluralformen', () => {
  it('en: 1 → one, 2 und 0 → other', () => {
    const t = createTranslator();
    expect(t.plural('status.lines', 1)).toBe('1 line');
    expect(t.plural('status.lines', 2)).toBe('2 lines');
    expect(t.plural('status.lines', 0)).toBe('0 lines');
  });

  it('de: 1 → one, 2 → other', () => {
    const t = createTranslator(de);
    expect(t.plural('status.words', 1)).toBe('1 Wort');
    expect(t.plural('status.words', 2)).toBe('2 Wörter');
  });

  it('pl: 2 → few, 5 → many', () => {
    const pl: Locale = {
      code: 'pl',
      texts: {
        ...en.texts,
        'status.lines': {
          one: '{count} linia',
          few: '{count} linie',
          many: '{count} linii',
          other: '{count} (other)',
        },
      },
    };
    const t = createTranslator(pl);
    expect(t.plural('status.lines', 1)).toBe('1 linia');
    expect(t.plural('status.lines', 2)).toBe('2 linie');
    expect(t.plural('status.lines', 5)).toBe('5 linii');
  });

  it('eine fehlende Form fällt auf other zurück', () => {
    const pl: Locale = {
      code: 'pl',
      texts: { ...en.texts, 'status.lines': { one: '{count} linia', other: '{count} linii' } },
    };
    expect(createTranslator(pl).plural('status.lines', 2)).toBe('2 linii');
  });
});

describe('createTranslator — ungültiger code', () => {
  it('warnt genau einmal und nutzt en für Plural und Uhrzeit, die Texte bleiben', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kaputt: Locale = { code: 'not a locale!', texts: de.texts };
    const t = createTranslator(kaputt);
    expect(t.code).toBe('en');
    expect(t.plural('status.lines', 1)).toBe('1 Zeile');
    expect(t.plural('status.lines', 2)).toBe('2 Zeilen');
    expect(t.formatTime(vierzehnNullFünf)).toMatch(/^02:05\sPM$/);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('not a locale!');
    expect(warn.mock.calls[0]![0]).toMatch(/^SupaMDE: /);
  });

  it('warnt auch bei fehlendem code', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ohneCode = { texts: de.texts } as unknown as Locale;
    expect(createTranslator(ohneCode).code).toBe('en');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warnt nicht ohne locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createTranslator();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('createTranslator — formatTime', () => {
  it('en: 12-Stunden-Format', () => {
    expect(createTranslator().formatTime(vierzehnNullFünf)).toMatch(/^02:05\sPM$/);
  });

  it('de: 24-Stunden-Format', () => {
    expect(createTranslator(de).formatTime(vierzehnNullFünf)).toBe('14:05');
  });
});

describe('translatorFacet', () => {
  it('liefert ohne Provider den englischen Default', () => {
    const state = EditorState.create();
    expect(state.facet(translatorFacet).t('toolbar.bold')).toBe('Bold');
  });

  it('liefert den übergebenen Translator', () => {
    const t = createTranslator(de);
    const state = EditorState.create({ extensions: translatorFacet.of(t) });
    expect(state.facet(translatorFacet)).toBe(t);
  });
});

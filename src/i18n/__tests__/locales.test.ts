import { describe, it, expect } from 'vitest';
import { en } from '../en';
import { de } from '../de';
import type { LocaleTexts, PluralText } from '../types';
import { BUILTIN_ACTIONS } from '../../ui/actions';

/** Die Platzhalternamen eines Textes, sortiert und ohne Dubletten. */
function platzhalter(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
}

/** Alle Einzeltexte eines Werts — bei einem PluralText jede vorhandene Form. */
function formen(value: string | PluralText): string[] {
  return typeof value === 'string'
    ? [value]
    : Object.values(value).filter((v): v is string => typeof v === 'string');
}

const schlüssel = Object.keys(en.texts) as (keyof LocaleTexts)[];

describe('mitgelieferte Locales', () => {
  it('haben die Codes en und de', () => {
    expect(en.code).toBe('en');
    expect(de.code).toBe('de');
  });

  it('de hat exakt die Schlüssel von en', () => {
    expect(Object.keys(de.texts).sort()).toEqual(Object.keys(en.texts).sort());
  });

  it('Plural-Schlüssel sind in beiden Locales ein PluralText mit other', () => {
    for (const key of schlüssel) {
      const enWert = en.texts[key];
      const deWert = de.texts[key];
      if (typeof enWert === 'string') {
        expect(typeof deWert, key).toBe('string');
      } else {
        expect(typeof enWert.other, key).toBe('string');
        expect(typeof (deWert as PluralText).other, key).toBe('string');
      }
    }
  });

  it('status.lines und status.words sind Plural-Schlüssel', () => {
    expect(typeof en.texts['status.lines']).toBe('object');
    expect(typeof en.texts['status.words']).toBe('object');
  });

  it('jede Form eines de-Texts nutzt dieselben Platzhalter wie en', () => {
    for (const key of schlüssel) {
      const erwartet = platzhalter(formen(en.texts[key]).join(' '));
      for (const form of formen(de.texts[key])) {
        expect(platzhalter(form), `${key}: ${form}`).toEqual(erwartet);
      }
    }
  });

  it('jede Built-in-Aktion hat einen toolbar-Schlüssel und jeder toolbar-Schlüssel eine Aktion', () => {
    const ausTexten = Object.keys(en.texts)
      .filter((k) => k.startsWith('toolbar.'))
      .map((k) => k.slice('toolbar.'.length))
      .sort();
    expect(ausTexten).toEqual(Object.keys(BUILTIN_ACTIONS).sort());
  });
});

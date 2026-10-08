import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SupaMDE from '../../index';
import { en } from '../en';
import type { Locale } from '../types';
import fr from './fixtures/fr.json';

// Zuweisung an `Locale`: der Typecheck beweist, dass ein JSON-Import (alle Werte
// als `string`, Pluraltexte als Objekt) strukturell eine vollständige Locale ist.
const frLocale: Locale = fr;

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Locale aus einer JSON-Datei', () => {
  it('hat exakt die Schlüssel von en — die Datei dient als Vorlage und darf nicht veralten', () => {
    expect(Object.keys(frLocale.texts).sort()).toEqual(Object.keys(en.texts).sort());
  });

  it('hat einen Code', () => {
    expect(frLocale.code).toBe('fr');
  });

  it('steuert Toolbar, Pluralform und Uhrzeit eines Editors', () => {
    const editor = new SupaMDE({
      element: textarea,
      toolbar: ['bold'],
      locale: frLocale,
    });
    expect(document.querySelector<HTMLButtonElement>('button[data-action="bold"]')!.title).toMatch(
      /^Gras \(/,
    );
    expect(document.querySelector('.supamde-status-lines')!.textContent).toBe('1 ligne');
    editor.setValue('a\nb');
    expect(document.querySelector('.supamde-status-lines')!.textContent).toBe('2 lignes');
    editor.toTextArea();
  });
});

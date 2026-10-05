import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SupaMDE, { en, de, type SupaMDEOptions } from '../index';
import { translatorFacet } from '../i18n/facet';
import { createMemoryStorage } from '../features/storage';

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('i18n: Exporte', () => {
  it('exportiert die mitgelieferten Locales en und de', () => {
    expect(en.code).toBe('en');
    expect(de.code).toBe('de');
  });
});

describe('i18n: Translator im Editor-State', () => {
  it('ohne locale ist er englisch', () => {
    const editor = new SupaMDE({ element: textarea });
    expect(editor.codemirror.state.facet(translatorFacet).code).toBe('en');
    editor.toTextArea();
  });

  it('mit locale: de ist er deutsch und berücksichtigt texts', () => {
    const editor = new SupaMDE({
      element: textarea,
      locale: de,
      texts: { 'table.column': 'Feld {n}' },
    });
    const t = editor.codemirror.state.facet(translatorFacet);
    expect(t.code).toBe('de');
    expect(t.t('table.column', { n: '1' })).toBe('Feld 1');
    editor.toTextArea();
  });
});

describe('i18n: Autosave-Status', () => {
  function vierzehnNullFünf(): Date {
    return new Date(2026, 0, 1, 14, 5);
  }

  /** Speichert einmal um 14:05 Uhr und liefert den Text des Autosave-Slots. */
  async function gespeicherterStatus(extra: Partial<SupaMDEOptions>): Promise<string | null> {
    vi.useFakeTimers();
    vi.setSystemTime(vierzehnNullFünf());
    const editor = new SupaMDE({
      element: textarea,
      status: ['autosave'],
      autosave: { enabled: true, key: 'doc', storage: createMemoryStorage() },
      ...extra,
    });
    await vi.advanceTimersByTimeAsync(0); // start() ist async
    editor.setValue('x');
    await vi.advanceTimersByTimeAsync(1000);
    const text = document.querySelector('.supamde-status-autosave')!.textContent;
    editor.toTextArea();
    return text;
  }

  it('ist per Default englisch mit 12-Stunden-Uhrzeit', async () => {
    expect(await gespeicherterStatus({})).toMatch(/^Saved: 02:05\sPM$/);
  });

  it('ist mit locale: de deutsch mit 24-Stunden-Uhrzeit', async () => {
    expect(await gespeicherterStatus({ locale: de })).toBe('Gespeichert: 14:05');
  });

  it('nimmt status.autosaved aus texts', async () => {
    expect(
      await gespeicherterStatus({
        locale: de,
        texts: { 'status.autosaved': 'Gesichert um {time}' },
      }),
    ).toBe('Gesichert um 14:05');
  });
});

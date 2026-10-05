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

describe('i18n: Toolbar', () => {
  function boldButton(extra: Partial<SupaMDEOptions> = {}): {
    editor: SupaMDE;
    btn: HTMLButtonElement;
  } {
    const editor = new SupaMDE({ element: textarea, toolbar: ['bold'], ...extra });
    const btn = document.querySelector<HTMLButtonElement>('button[data-action="bold"]')!;
    return { editor, btn };
  }

  it('Tooltip und aria-label sind per Default englisch', () => {
    const { editor, btn } = boldButton();
    expect(btn.title).toMatch(/^Bold \(/);
    expect(btn.getAttribute('aria-label')).toBe(btn.title);
    editor.toTextArea();
  });

  it('sind mit locale: de deutsch', () => {
    const { editor, btn } = boldButton({ locale: de });
    expect(btn.title).toMatch(/^Fett \(/);
    expect(btn.getAttribute('aria-label')).toBe(btn.title);
    editor.toTextArea();
  });

  it('ein einzelner Titel lässt sich über texts überschreiben', () => {
    const { editor, btn } = boldButton({ locale: de, texts: { 'toolbar.bold': 'Fettdruck' } });
    expect(btn.title).toMatch(/^Fettdruck \(/);
    editor.toTextArea();
  });
});

describe('i18n: Statusbar', () => {
  it('ist per Default englisch', () => {
    const editor = new SupaMDE({ element: textarea });
    expect(document.querySelector('.supamde-status-lines')!.textContent).toBe('1 line');
    expect(document.querySelector('.supamde-status-words')!.textContent).toBe('0 words');
    editor.toTextArea();
  });

  it('ist mit locale: de deutsch und folgt der Pluralregel', () => {
    const editor = new SupaMDE({ element: textarea, locale: de });
    expect(document.querySelector('.supamde-status-lines')!.textContent).toBe('1 Zeile');
    editor.setValue('ein\nzwei');
    expect(document.querySelector('.supamde-status-lines')!.textContent).toBe('2 Zeilen');
    expect(document.querySelector('.supamde-status-words')!.textContent).toBe('2 Wörter');
    editor.toTextArea();
  });
});

describe('i18n: Tabellenvorlage und mehrere Instanzen', () => {
  it('jede Instanz auf einer Seite behält ihre eigene Sprache', () => {
    const zweite = document.createElement('textarea');
    document.body.appendChild(zweite);
    const englisch = new SupaMDE({ element: textarea, toolbar: ['table'] });
    const deutsch = new SupaMDE({ element: zweite, toolbar: ['table'], locale: de });
    const [btnEn, btnDe] = document.querySelectorAll<HTMLButtonElement>(
      'button[data-action="table"]',
    );

    btnEn!.click();
    btnDe!.click();

    expect(englisch.getValue()).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n');
    expect(deutsch.getValue()).toBe('| Spalte 1 | Spalte 2 |\n| --- | --- |\n|  |  |\n');
    expect(btnEn!.title).toBe('Table');
    expect(btnDe!.title).toBe('Tabelle');
    englisch.toTextArea();
    deutsch.toTextArea();
  });
});

describe('i18n: Bild-Upload', () => {
  const upload = async (): Promise<string> => 'https://cdn.test/a.png';

  function einladungstext(extra: Partial<SupaMDEOptions> = {}): string | null {
    const editor = new SupaMDE({
      element: textarea,
      status: ['upload-image'],
      uploadImage: { enabled: true, upload },
      ...extra,
    });
    const text = document.querySelector('.supamde-status-upload-image')!.textContent;
    editor.toTextArea();
    return text;
  }

  it('ist per Default englisch', () => {
    expect(einladungstext()).toBe('Drag an image here or paste it');
  });

  it('ist mit locale: de deutsch', () => {
    expect(einladungstext({ locale: de })).toBe('Bild hierher ziehen oder einfügen');
  });

  it('nimmt upload.*-Schlüssel aus texts', () => {
    expect(einladungstext({ texts: { 'upload.statusInit': 'Drop images here' } })).toBe(
      'Drop images here',
    );
  });

  it('Statusmeldungen eines Uploads folgen der Locale', async () => {
    const editor = new SupaMDE({
      element: textarea,
      status: ['upload-image'],
      locale: de,
      uploadImage: { enabled: true, upload },
    });
    const slot = document.querySelector('.supamde-status-upload-image')!;
    editor.uploadImages([new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })]);
    expect(slot.textContent).toBe('Lade a.png hoch…');
    await vi.waitFor(() => expect(slot.textContent).toBe('a.png hochgeladen'));
    editor.toTextArea();
  });

  it('uploadImage.texts gibt es nicht mehr', () => {
    const editor = new SupaMDE({
      element: textarea,
      status: ['upload-image'],
      uploadImage: {
        enabled: true,
        upload,
        // @ts-expect-error — ersatzlos entfernt, stattdessen `texts` mit upload.*-Schlüsseln
        texts: { statusInit: 'alt' },
      },
    });
    expect(document.querySelector('.supamde-status-upload-image')!.textContent).toBe(
      'Drag an image here or paste it',
    );
    editor.toTextArea();
  });
});

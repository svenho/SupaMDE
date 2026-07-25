import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../options';
import type { SupaMDEOptions } from '../options';

describe('resolveOptions', () => {
  it('setzt Defaults bei leeren Optionen', () => {
    const r = resolveOptions({});
    expect(r).toEqual({
      lineWrapping: true,
      placeholder: null,
      autofocus: false,
      tabSize: 2,
      indentUnit: 2,
    });
  });

  it('übernimmt gesetzte User-Werte', () => {
    const r = resolveOptions({
      lineWrapping: false,
      placeholder: 'Tippe hier …',
      autofocus: true,
      tabSize: 4,
      indentUnit: 4,
    });
    expect(r.lineWrapping).toBe(false);
    expect(r.placeholder).toBe('Tippe hier …');
    expect(r.autofocus).toBe(true);
    expect(r.tabSize).toBe(4);
    expect(r.indentUnit).toBe(4);
  });

  it('ignoriert `element` in ResolvedOptions (kein Extension-Belang)', () => {
    const el = document.createElement('textarea');
    const r = resolveOptions({ element: el });
    expect(r).not.toHaveProperty('element');
  });

  it('resolveOptions ignoriert Preview-/Render-Optionen (sie leben in renderOptionsFrom)', () => {
    // Diese Felder werden NICHT in resolveOptions normalisiert (siehe Doku dort) —
    // hier nur der Nachweis, dass sie unschädlich durchgereicht werden können.
    const r = resolveOptions({
      previewRender: (text) => text,
      previewClass: 'x',
      renderingConfig: { singleLineBreaks: false },
      syncSideBySidePreviewScroll: false,
      onToggleFullScreen: () => {},
    });
    expect(r).not.toHaveProperty('previewRender');
    expect(r).not.toHaveProperty('renderingConfig');
  });
});

describe('SupaMDEOptions (Typ-Erweiterung, M4)', () => {
  it('die neuen Preview-/Fullscreen-Felder sind optional (rein typseitiger Nachweis)', () => {
    // Kompiliert nur, wenn alle Felder existieren und optional sind — kein Laufzeit-Assert nötig.
    const opts: SupaMDEOptions = {};
    expect(opts).toEqual({});

    const full: SupaMDEOptions = {
      previewRender: (text) => text,
      previewClass: ['a', 'b'],
      renderingConfig: { singleLineBreaks: true },
      syncSideBySidePreviewScroll: true,
      onToggleFullScreen: (active) => {
        expect(typeof active).toBe('boolean');
      },
    };
    expect(full.previewClass).toEqual(['a', 'b']);
  });
});

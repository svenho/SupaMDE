import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../options';

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
});

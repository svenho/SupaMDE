import { describe, it, expect } from 'vitest';
import SupaMDE, { SupaMDE as NamedSupaMDE, VERSION } from '../index';

describe('SupaMDE (Skelett)', () => {
  it('exportiert dieselbe Klasse als Default- und benannten Export', () => {
    expect(SupaMDE).toBe(NamedSupaMDE);
  });

  it('lässt sich ohne Optionen instanziieren', () => {
    const editor = new SupaMDE();
    expect(editor).toBeInstanceOf(SupaMDE);
    expect(editor.options).toEqual({});
  });

  it('übernimmt übergebene Optionen', () => {
    const el = document.createElement('textarea');
    const editor = new SupaMDE({ element: el });
    expect(editor.options.element).toBe(el);
  });

  it('stellt die Version als statische Eigenschaft bereit', () => {
    expect(SupaMDE.version).toBe(VERSION);
  });
});

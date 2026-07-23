import { describe, it, expect, vi } from 'vitest';
import { resolveToolbar, DEFAULT_TOOLBAR } from '../toolbar-config';

describe('resolveToolbar', () => {
  it('liefert null bei false', () => {
    expect(resolveToolbar(false)).toBeNull();
  });

  it('nutzt die Default-Toolbar bei undefined', () => {
    const items = resolveToolbar(undefined);
    expect(items).not.toBeNull();
    // Default enthält bold als Built-in
    expect(items!.some((i) => i.kind === 'builtin' && i.name === 'bold')).toBe(true);
  });

  it('löst Separatoren auf', () => {
    const items = resolveToolbar(['bold', '|', 'italic']);
    expect(items!.map((i) => i.kind)).toEqual(['builtin', 'separator', 'builtin']);
  });

  it('löst Custom-Buttons auf', () => {
    const action = vi.fn();
    const items = resolveToolbar([{ name: 'foo', action, className: 'fa fa-star', title: 'Foo' }]);
    expect(items).toHaveLength(1);
    expect(items![0]).toMatchObject({ kind: 'custom' });
  });

  it('überspringt unbekannte Built-in-Strings mit Warnung', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = resolveToolbar(['bold', 'gibt-es-nicht', 'italic']);
    expect(items!.filter((i) => i.kind === 'builtin')).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('DEFAULT_TOOLBAR enthält keine M4-Aktionen (preview/side-by-side/fullscreen)', () => {
    for (const forbidden of ['preview', 'side-by-side', 'fullscreen']) {
      expect(DEFAULT_TOOLBAR).not.toContain(forbidden);
    }
  });
});

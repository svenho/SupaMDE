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

  it('DEFAULT_TOOLBAR enthält preview-fullscreen, aber keine separate preview-Aktion', () => {
    expect(DEFAULT_TOOLBAR).toContain('preview-fullscreen');
    expect(DEFAULT_TOOLBAR).not.toContain('preview');
  });
});

describe('DEFAULT_TOOLBAR: kombinierter Vorschau-Vollbild-Button', () => {
  it('enthält preview-fullscreen statt der beiden Einzel-Buttons', () => {
    expect(DEFAULT_TOOLBAR).toContain('preview-fullscreen');
    expect(DEFAULT_TOOLBAR).not.toContain('side-by-side');
    // Kein Widerspruch zur Zeile darüber: toContain vergleicht Array-Elemente
    // exakt, nicht als Teilstring. 'preview-fullscreen' !== 'fullscreen', der
    // Kombi-Button darf also bleiben — ausgeschlossen wird nur der Einzel-Button.
    expect(DEFAULT_TOOLBAR).not.toContain('fullscreen');
  });

  it('die Einzel-Buttons bleiben explizit konfigurierbar', () => {
    const resolved = resolveToolbar(['side-by-side', 'fullscreen']);
    expect(resolved).toHaveLength(2);
    expect(resolved?.[0]).toMatchObject({ kind: 'builtin', name: 'side-by-side' });
    expect(resolved?.[1]).toMatchObject({ kind: 'builtin', name: 'fullscreen' });
  });

  it('der Default löst vollständig auf (keine unbekannten Namen)', () => {
    const resolved = resolveToolbar(undefined);
    expect(resolved).not.toBeNull();
    expect(resolved).toHaveLength(DEFAULT_TOOLBAR.length);
  });
});

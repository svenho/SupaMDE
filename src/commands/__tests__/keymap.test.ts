import { describe, it, expect } from 'vitest';
import { supaKeymap } from '../keymap';

describe('supaKeymap', () => {
  it('enthält die zentralen easyMDE-Default-Shortcuts', () => {
    const keys = supaKeymap.map((b) => b.key ?? b.mac ?? '');
    expect(keys).toContain('Mod-b');
    expect(keys).toContain('Mod-i');
    expect(keys).toContain('Mod-k');
    expect(keys).toContain("Mod-'");
  });

  it('bindet die Sternchen-Liste auf Shift-Alt-Mod-l (separat von Mod-l)', () => {
    const star = supaKeymap.find((b) => b.key === 'Shift-Alt-Mod-l');
    const dash = supaKeymap.find((b) => b.key === 'Mod-l');
    expect(star).toBeDefined();
    expect(dash).toBeDefined();
    expect(typeof star?.run).toBe('function');
    // Zwei verschiedene Commands (Spiegelstrich vs. Sternchen).
    expect(star?.run).not.toBe(dash?.run);
  });

  it('bietet ein layout-unabhängiges Zweitkürzel für Blockzitat (DE-Mac-Tastatur)', () => {
    const primary = supaKeymap.find((b) => b.key === "Mod-'");
    const secondary = supaKeymap.find((b) => b.key === 'Ctrl-Alt-q');
    expect(primary).toBeDefined();
    expect(secondary).toBeDefined();
    // Beide Kürzel lösen denselben quote-Command aus.
    expect(secondary?.run).toBe(primary?.run);
  });

  it('bindet Enter an die Listen-Fortsetzung', () => {
    const enter = supaKeymap.find((b) => b.key === 'Enter');
    expect(enter).toBeDefined();
    expect(typeof enter?.run).toBe('function');
  });

  it('jede Bindung hat eine run-Funktion', () => {
    for (const b of supaKeymap) {
      expect(typeof b.run).toBe('function');
    }
  });
});

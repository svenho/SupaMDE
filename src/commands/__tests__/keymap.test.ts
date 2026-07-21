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

import { describe, it, expect } from 'vitest';
import { supaKeymap } from '../keymap';
import { BUILTIN_ACTIONS } from '../../ui/actions';

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

  it('leitet Kürzel aus BUILTIN_ACTIONS ab (dieselbe Command-Instanz, z.B. bold)', () => {
    const boldBinding = supaKeymap.find((b) => b.key === 'Mod-b');
    expect(boldBinding).toBeDefined();
    expect(boldBinding?.run).toBe(BUILTIN_ACTIONS['bold']?.command);
  });

  it('enthält undo/redo NICHT (Bindung erfolgt via CM6 historyKeymap)', () => {
    const keys = supaKeymap.map((b) => b.key ?? b.mac ?? '');
    expect(keys).not.toContain('Mod-z');
    expect(keys).not.toContain('Mod-y');
  });

  it('hat keine unbeabsichtigten doppelten Key-Bindungen (außer bewusst quote)', () => {
    const keys = supaKeymap.map((b) => b.key ?? b.mac ?? '');
    const counts = new Map<string, number>();
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
    expect(duplicates).toEqual([]);
  });

  it('alle abgeleiteten key-Werte sind strings (auch bei künftigen Objekt-Kürzeln robust)', () => {
    for (const b of supaKeymap) {
      expect(typeof b.key).toBe('string');
    }
  });
});

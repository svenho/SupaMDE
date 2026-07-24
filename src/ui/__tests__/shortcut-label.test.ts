import { describe, it, expect } from 'vitest';
import { formatShortcut } from '../shortcut-label';

describe('formatShortcut', () => {
  describe('macOS', () => {
    it("'Mod-b' → '⌘B'", () => {
      expect(formatShortcut('Mod-b', true)).toBe('⌘B');
    });

    it("'Shift-Mod-h' → '⌘⇧H'", () => {
      expect(formatShortcut('Shift-Mod-h', true)).toBe('⌘⇧H');
    });

    it("'Mod-Alt-c' → '⌘⌥C'", () => {
      expect(formatShortcut('Mod-Alt-c', true)).toBe('⌘⌥C');
    });

    it("\"Mod-'\" → \"⌘'\"", () => {
      expect(formatShortcut("Mod-'", true)).toBe("⌘'");
    });

    it("'Ctrl-Alt-1' → '⌃⌥1'", () => {
      expect(formatShortcut('Ctrl-Alt-1', true)).toBe('⌃⌥1');
    });
  });

  describe('non-macOS', () => {
    it("'Mod-b' → 'Ctrl+B'", () => {
      expect(formatShortcut('Mod-b', false)).toBe('Ctrl+B');
    });

    it("'Shift-Mod-h' → 'Ctrl+Shift+H'", () => {
      expect(formatShortcut('Shift-Mod-h', false)).toBe('Ctrl+Shift+H');
    });

    it("'Mod-Alt-c' → 'Ctrl+Alt+C'", () => {
      expect(formatShortcut('Mod-Alt-c', false)).toBe('Ctrl+Alt+C');
    });

    it("\"Mod-'\" → \"Ctrl+'\"", () => {
      expect(formatShortcut("Mod-'", false)).toBe("Ctrl+'");
    });

    it("'Ctrl-Alt-1' → 'Ctrl+Alt+1'", () => {
      expect(formatShortcut('Ctrl-Alt-1', false)).toBe('Ctrl+Alt+1');
    });
  });

  describe('Plattformerkennung (Fallback)', () => {
    it('formatShortcut(shortcut) mit Plattformerkennung funktioniert', () => {
      // Testen, dass die Funktion auch ohne isMac-Parameter aufgerufen werden kann
      const result = formatShortcut('Mod-b');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Ergebnis hängt von der aktuellen Plattform ab
      expect(['⌘B', 'Ctrl+B']).toContain(result);
    });
  });

  describe('plattformabhängiges Kürzel-Objekt ({ default, mac })', () => {
    it("{ default: 'Mod-y', mac: 'Mod-Shift-z' } auf Mac → '⌘⇧Z'", () => {
      expect(formatShortcut({ default: 'Mod-y', mac: 'Mod-Shift-z' }, true)).toBe('⌘⇧Z');
    });

    it("{ default: 'Mod-y', mac: 'Mod-Shift-z' } auf non-Mac → 'Ctrl+Y'", () => {
      expect(formatShortcut({ default: 'Mod-y', mac: 'Mod-Shift-z' }, false)).toBe('Ctrl+Y');
    });
  });
});

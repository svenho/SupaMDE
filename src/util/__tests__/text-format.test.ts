import { describe, it, expect } from 'vitest';
import { formatText, formatBytes } from '../text-format';

describe('formatText', () => {
  it('ersetzt einen benannten Platzhalter', () => {
    expect(formatText('Lade {name} hoch…', { name: 'a.png' })).toBe('Lade a.png hoch…');
  });

  it('ersetzt ALLE Vorkommen desselben Platzhalters', () => {
    expect(formatText('{name} und {name}', { name: 'x' })).toBe('x und x');
  });

  it('lässt unbekannte Platzhalter unverändert stehen', () => {
    expect(formatText('{name} {unbekannt}', { name: 'x' })).toBe('x {unbekannt}');
  });

  it('kommt ohne Platzhalter aus', () => {
    expect(formatText('Nur Text', {})).toBe('Nur Text');
  });

  it('ersetzt mehrere verschiedene Platzhalter', () => {
    expect(formatText('{a} ist zu groß (max. {b}).', { a: 'x.png', b: '2 MB' })).toBe(
      'x.png ist zu groß (max. 2 MB).',
    );
  });

  it('behandelt einen Wert mit geschweiften Klammern als reinen Text', () => {
    // Kein zweiter Ersetzungsdurchlauf: Ein eingesetzter Wert darf nicht selbst
    // wieder als Template gelesen werden, sonst hinge das Ergebnis von der
    // Reihenfolge der Schlüssel ab.
    expect(formatText('{a}{b}', { a: '{b}', b: 'X' })).toBe('{b}X');
  });
});

describe('formatBytes', () => {
  it('formatiert Megabyte lesbar', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
  });

  it('formatiert Kilobyte lesbar', () => {
    expect(formatBytes(500 * 1024)).toBe('500 KB');
  });

  it('formatiert kleine Werte als Bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formatiert 0 als 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});

import { describe, it, expect } from 'vitest';
import { wordCount } from '../word-count';

describe('wordCount', () => {
  it('zählt einfache Wörter', () => {
    expect(wordCount('hallo welt')).toBe(2);
  });

  it('liefert 0 für leeren Text', () => {
    expect(wordCount('')).toBe(0);
  });

  it('liefert 0 für reinen Whitespace', () => {
    expect(wordCount('   \n\t  ')).toBe(0);
  });

  it('kollabiert mehrfachen Whitespace', () => {
    expect(wordCount('ein   zwei\n\ndrei\tvier')).toBe(4);
  });

  it('zählt Unicode-Wörter', () => {
    expect(wordCount('Grüße über Ätna')).toBe(3);
  });

  it('ignoriert führenden/abschließenden Whitespace', () => {
    expect(wordCount('  hallo  ')).toBe(1);
  });
});

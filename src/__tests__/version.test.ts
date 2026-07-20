import { describe, it, expect } from 'vitest';
import { VERSION } from '../version';

describe('VERSION', () => {
  it('ist ein nicht-leerer String im semver-Format', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

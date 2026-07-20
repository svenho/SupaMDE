import { describe, it, expect } from 'vitest';
import { supaTheme } from '../theme';

describe('supaTheme', () => {
  it('ist definiert und als Extension nutzbar', () => {
    expect(supaTheme).toBeDefined();
  });
});

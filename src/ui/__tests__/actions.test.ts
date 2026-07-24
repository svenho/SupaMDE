import { describe, it, expect } from 'vitest';
import { BUILTIN_ACTIONS, getAction } from '../actions';
import { hasIcon } from '../icons';

describe('BUILTIN_ACTIONS registry', () => {
  it('getAction liefert eine Action für bekannte Built-ins', () => {
    const bold = getAction('bold');
    expect(bold).toBeDefined();
    expect(typeof bold?.command).toBe('function');
    expect(bold?.title.length).toBeGreaterThan(0);
  });

  it('getAction liefert undefined für Unbekanntes', () => {
    expect(getAction('gibt-es-nicht')).toBeUndefined();
  });

  it('jede registrierte Action hat ein bekanntes Icon', () => {
    for (const [name, action] of Object.entries(BUILTIN_ACTIONS)) {
      expect(hasIcon(action.icon), `${name} → ${action.icon}`).toBe(true);
    }
  });

  it('Toggle-Aktionen haben eine query, Einfüge-Aktionen nicht', () => {
    expect(getAction('bold')?.query).toBeTypeOf('function');
    expect(getAction('link')?.query).toBeUndefined();
    expect(getAction('table')?.query).toBeUndefined();
    expect(getAction('undo')?.query).toBeUndefined();
  });

  it('registriert die absoluten Überschriften heading-1..6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(getAction(`heading-${i}`), `heading-${i}`).toBeDefined();
    }
  });
});

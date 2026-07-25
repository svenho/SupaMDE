import { describe, it, expect, vi } from 'vitest';
import { BUILTIN_ACTIONS, getAction } from '../actions';
import { hasIcon } from '../icons';

/** Liefert die Action nur, wenn sie vom `command`-Zweig der Union ist. */
function asCmd(name: string) {
  const action = getAction(name);
  return action?.kind === 'command' ? action : undefined;
}

describe('BUILTIN_ACTIONS registry', () => {
  it('getAction liefert eine Action für bekannte Built-ins', () => {
    const bold = getAction('bold');
    expect(bold).toBeDefined();
    expect(bold?.kind).toBe('command');
    if (bold?.kind === 'command') {
      expect(typeof bold.command).toBe('function');
    }
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
    expect(asCmd('bold')?.query).toBeTypeOf('function');
    expect(asCmd('link')?.query).toBeUndefined();
    expect(asCmd('table')?.query).toBeUndefined();
    expect(asCmd('undo')?.query).toBeUndefined();
  });

  it('registriert die absoluten Überschriften heading-1..6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(getAction(`heading-${i}`), `heading-${i}`).toBeDefined();
    }
  });
});

describe('view-Aktionen (side-by-side, fullscreen)', () => {
  it('side-by-side ist eine view-Aktion und ruft toggleSideBySide', () => {
    const action = getAction('side-by-side');
    expect(action?.kind).toBe('view');
    const editor = {
      toggleSideBySide: vi.fn(),
      toggleFullScreen: vi.fn(),
      isSideBySideActive: () => false,
      isFullscreenActive: () => false,
    };
    if (action?.kind === 'view') action.run(editor);
    expect(editor.toggleSideBySide).toHaveBeenCalled();
  });

  it('fullscreen.active spiegelt isFullscreenActive', () => {
    const action = getAction('fullscreen');
    const editor = {
      toggleSideBySide: vi.fn(),
      toggleFullScreen: vi.fn(),
      isSideBySideActive: () => false,
      isFullscreenActive: () => true,
    };
    if (action?.kind === 'view') expect(action.active?.(editor)).toBe(true);
  });
});

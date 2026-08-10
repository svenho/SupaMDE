export interface FullscreenOptions {
  onToggleFullScreen?: (active: boolean) => void;
}

export interface Fullscreen {
  toggle(): void;
  /** Schaltet gezielt auf `next`. Idempotent — gleicher Wert ändert nichts. */
  set(next: boolean): void;
  isActive(): boolean;
  destroy(): void;
}

/**
 * Fullscreen-Toggle: reines CSS über die Klasse `supamde-fullscreen` auf dem
 * Container. Sperrt zusätzlich body-Scroll und lässt Escape den Modus
 * verlassen. Unabhängig von Side-by-Side (keine Zwangskopplung).
 */
export function createFullscreen(container: HTMLElement, opts: FullscreenOptions = {}): Fullscreen {
  let active = false;
  let savedOverflow = '';

  const set = (next: boolean): void => {
    if (next === active) return;
    active = next;
    container.classList.toggle('supamde-fullscreen', active);
    if (active) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = savedOverflow;
    }
    opts.onToggleFullScreen?.(active);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && active) set(false);
  };
  container.addEventListener('keydown', onKeydown);

  return {
    toggle: () => set(!active),
    set,
    isActive: () => active,
    destroy: () => {
      container.removeEventListener('keydown', onKeydown);
      if (active) set(false);
    },
  };
}

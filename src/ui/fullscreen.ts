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
 * Modulweiter Zustand für die body-Scroll-Sperre. Bewusst nicht instanz-lokal:
 * Mehrere Editoren teilen sich einen `document.body`. Würde jede Instanz ihren
 * eigenen Snapshot halten, sicherte die zweite Instanz den bereits gesperrten
 * Wert `'hidden'` als vermeintlichen Ausgangszustand — und schriebe ihn beim
 * Verlassen zurück. Der body bliebe dauerhaft gesperrt.
 *
 * Nur der Übergang 0 → 1 sichert und sperrt, nur 1 → 0 stellt wieder her.
 */
let fullscreenCount = 0;
let savedBodyOverflow = '';

/**
 * Fullscreen-Toggle: reines CSS über die Klasse `supamde-fullscreen` auf dem
 * Container. Sperrt zusätzlich body-Scroll und lässt Escape den Modus
 * verlassen. Unabhängig von Side-by-Side (keine Zwangskopplung).
 */
export function createFullscreen(container: HTMLElement, opts: FullscreenOptions = {}): Fullscreen {
  let active = false;

  const set = (next: boolean): void => {
    if (next === active) return;
    active = next;
    container.classList.toggle('supamde-fullscreen', active);
    if (active) {
      // Erst die Instanz, die die Sperre auslöst, sichert den Ausgangswert.
      if (fullscreenCount === 0) savedBodyOverflow = document.body.style.overflow;
      fullscreenCount += 1;
      document.body.style.overflow = 'hidden';
    } else {
      fullscreenCount = Math.max(0, fullscreenCount - 1);
      // Erst wenn keine Instanz mehr im Vollbild ist, kehrt der Ausgangswert zurück.
      if (fullscreenCount === 0) document.body.style.overflow = savedBodyOverflow;
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

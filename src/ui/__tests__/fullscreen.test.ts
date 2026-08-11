import { describe, it, expect, vi } from 'vitest';
import { createFullscreen } from '../fullscreen';

function container(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'supamde-container';
  document.body.appendChild(el);
  return el;
}

describe('createFullscreen', () => {
  it('toggelt die Klasse supamde-fullscreen und isActive()', () => {
    const el = container();
    const fs = createFullscreen(el);
    expect(fs.isActive()).toBe(false);
    fs.toggle();
    expect(fs.isActive()).toBe(true);
    expect(el.classList.contains('supamde-fullscreen')).toBe(true);
    fs.toggle();
    expect(el.classList.contains('supamde-fullscreen')).toBe(false);
    fs.destroy();
  });

  it('sperrt/entsperrt body-overflow', () => {
    const el = container();
    document.body.style.overflow = 'auto';
    const fs = createFullscreen(el);
    fs.toggle();
    expect(document.body.style.overflow).toBe('hidden');
    fs.toggle();
    expect(document.body.style.overflow).toBe('auto');
    fs.destroy();
  });

  it('ruft onToggleFullScreen mit dem neuen Zustand', () => {
    const el = container();
    const cb = vi.fn();
    const fs = createFullscreen(el, { onToggleFullScreen: cb });
    fs.toggle();
    expect(cb).toHaveBeenCalledWith(true);
    fs.toggle();
    expect(cb).toHaveBeenCalledWith(false);
    fs.destroy();
  });

  it('Escape verlässt Fullscreen', () => {
    const el = container();
    const fs = createFullscreen(el);
    fs.toggle();
    expect(fs.isActive()).toBe(true);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fs.isActive()).toBe(false);
    fs.destroy();
  });

  it('set() schaltet gezielt und ist idempotent', () => {
    const el = container();
    const cb = vi.fn();
    const fs = createFullscreen(el, { onToggleFullScreen: cb });

    fs.set(true);
    expect(fs.isActive()).toBe(true);
    expect(el.classList.contains('supamde-fullscreen')).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);

    // Zweiter Aufruf mit demselben Wert: kein Zustandswechsel, kein Callback.
    fs.set(true);
    expect(fs.isActive()).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);

    fs.set(false);
    expect(fs.isActive()).toBe(false);
    expect(cb).toHaveBeenCalledTimes(2);
    fs.set(false);
    expect(cb).toHaveBeenCalledTimes(2);

    fs.destroy();
  });

  it('stellt body-overflow bei zwei parallelen Instanzen korrekt wieder her', () => {
    document.body.style.overflow = 'scroll';
    const a = createFullscreen(container());
    const b = createFullscreen(container());

    a.set(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Zweite Instanz ins Vollbild: darf den bereits gesperrten Wert NICHT als
    // vermeintlichen Ausgangszustand sichern.
    b.set(true);
    expect(document.body.style.overflow).toBe('hidden');

    // Erste Instanz verlässt das Vollbild, zweite ist noch aktiv: bleibt gesperrt.
    a.set(false);
    expect(document.body.style.overflow).toBe('hidden');

    // Letzte Instanz verlässt das Vollbild: echter Ausgangswert kehrt zurück.
    b.set(false);
    expect(document.body.style.overflow).toBe('scroll');

    a.destroy();
    b.destroy();
    document.body.style.overflow = '';
  });

  it('stellt body-overflow auch bei destroy() aus dem Vollbild wieder her', () => {
    document.body.style.overflow = 'scroll';
    const a = createFullscreen(container());
    const b = createFullscreen(container());

    a.set(true);
    b.set(true);
    a.destroy();
    expect(document.body.style.overflow).toBe('hidden');

    b.destroy();
    expect(document.body.style.overflow).toBe('scroll');

    document.body.style.overflow = '';
  });
});

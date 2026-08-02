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
});

import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createSideBySide } from '../preview';

function viewWith(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({ state: EditorState.create({ doc }), parent });
}

describe('createSideBySide', () => {
  it('ist initial inaktiv und rendert erst bei toggle()', () => {
    const view = viewWith('# Hallo');
    const panel = createSideBySide(view, { render: (t) => `<rendered>${t}</rendered>` });
    expect(panel.isActive()).toBe(false);
    panel.toggle();
    expect(panel.isActive()).toBe(true);
    expect(panel.dom.innerHTML).toContain('# Hallo');
    view.destroy();
  });

  it('update() re-rendert nur bei aktivem Panel', () => {
    const view = viewWith('a');
    const panel = createSideBySide(view, { render: (t) => `R:${t}` });
    panel.update(EditorState.create({ doc: 'b' })); // inaktiv → No-op
    expect(panel.dom.innerHTML).toBe('');
    panel.toggle();
    panel.update(EditorState.create({ doc: 'c' }));
    expect(panel.dom.innerHTML).toBe('R:c');
    view.destroy();
  });

  it('previewClass wird auf das Panel gesetzt', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, previewClass: ['prose', 'foo'] });
    expect(panel.dom.classList.contains('prose')).toBe(true);
    expect(panel.dom.classList.contains('foo')).toBe(true);
    view.destroy();
  });

  it('destroy() entfernt das Panel aus dem DOM', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t });
    panel.toggle();
    panel.destroy();
    expect(panel.dom.isConnected).toBe(false);
    view.destroy();
  });

  it('Scroll-Sync: bidirektionaler Scroll funktioniert (mit gestubbten Scroll-Maßen)', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, syncScroll: true });
    panel.toggle();

    // jsdom setzt scrollHeight/clientHeight auf 0, daher per defineProperty stubben.
    Object.defineProperty(view.scrollDOM, 'scrollHeight', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(view.scrollDOM, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(panel.dom, 'scrollHeight', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(panel.dom, 'clientHeight', {
      value: 100,
      configurable: true,
    });

    // Editor bei 50% scrollen (scrollTop = 50 von 100 scrollbaren).
    view.scrollDOM.scrollTop = 50;
    view.scrollDOM.dispatchEvent(new Event('scroll'));

    // Preview sollte auch bei ~50% sein (scrollTop = 50 von 100 scrollbaren).
    expect(panel.dom.scrollTop).toBe(50);

    view.destroy();
  });

  it('syncScroll: false registriert keine Scroll-Handler', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, syncScroll: false });
    panel.toggle();

    // Scroll im Editor dispatchen.
    view.scrollDOM.scrollTop = 50;
    view.scrollDOM.dispatchEvent(new Event('scroll'));

    // Panel sollte NICHT gesyncronisiert werden (noch auf 0).
    expect(panel.dom.scrollTop).toBe(0);

    view.destroy();
  });

  it('Scroll-Sync-Guard: Guard-Reset funktioniert, nächster Gegen-Scroll propagiert', () => {
    // Mock requestAnimationFrame: Callbacks in einer Queue sammeln und dann flushen.
    // Dies simuliert einen echten Browser: rAF deferred den Reset bis zum nächsten Frame.
    const rafCallbacks: FrameRequestCallback[] = [];
    const mockRaf = (cb: FrameRequestCallback): number => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
    vi.stubGlobal('requestAnimationFrame', mockRaf);

    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, syncScroll: true });
    panel.toggle();

    // Scroll-Maße stubben.
    Object.defineProperty(view.scrollDOM, 'scrollHeight', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(view.scrollDOM, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(panel.dom, 'scrollHeight', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(panel.dom, 'clientHeight', {
      value: 100,
      configurable: true,
    });

    // 1. Editor-Scroll: Panel wird synced.
    view.scrollDOM.scrollTop = 50;
    view.scrollDOM.dispatchEvent(new Event('scroll'));
    expect(panel.dom.scrollTop).toBe(50);

    // 2. Guard-Resets flushen (rAF deferred, aber wir flushen jetzt).
    rafCallbacks.forEach((cb) => cb(0));
    rafCallbacks.length = 0;

    // 3. Nach Guard-Reset: Panel-User-Scroll sollte funktionieren (nicht verschluckt).
    panel.dom.scrollTop = 75;
    panel.dom.dispatchEvent(new Event('scroll'));

    // Editor sollte auf ~75% sein (Gegen-Scroll propagiert, Guard freigegeben).
    expect(view.scrollDOM.scrollTop).toBe(75);

    view.destroy();
    vi.restoreAllMocks();
  });

  it('set() schaltet gezielt und ist idempotent', () => {
    const view = viewWith('# Titel');
    const render = vi.fn((text: string) => `<p>${text}</p>`);
    const sbs = createSideBySide(view, { render });

    sbs.set(true);
    expect(sbs.isActive()).toBe(true);
    expect(sbs.dom.style.display).toBe('');
    expect(render).toHaveBeenCalledTimes(1);

    // Zweiter Aufruf mit demselben Wert: kein erneutes Rendern.
    sbs.set(true);
    expect(sbs.isActive()).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);

    sbs.set(false);
    expect(sbs.isActive()).toBe(false);
    expect(sbs.dom.style.display).toBe('none');
    sbs.set(false);
    expect(sbs.isActive()).toBe(false);

    sbs.destroy();
    view.destroy();
  });
});

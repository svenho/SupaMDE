import { describe, it, expect, afterEach, vi } from 'vitest';
import { viewWith, cleanup } from '../../__tests__/helpers';
import { linkHoverCursorExtension, LINK_HOVER_CLASS } from '../link-hover-cursor';

/** View mit Markdown-Setup und der Klickhand-Extension. */
function hoverView(doc: string) {
  return viewWith(doc, [linkHoverCursorExtension]);
}

/** Feuert ein mousemove-Event mit gegebenen Koordinaten auf dem contentDOM. */
function moveMouse(view: ReturnType<typeof hoverView>, x: number, y: number): void {
  view.contentDOM.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }),
  );
}

describe('linkHoverCursorExtension — Klickhand bei Modifier+Hover über Link', () => {
  let view: ReturnType<typeof hoverView> | null = null;

  afterEach(() => {
    if (view) {
      cleanup(view);
      view = null;
    }
    // Sicherheitsnetz: falls ein Test vorzeitig abbricht, keine hängenden
    // window/document-Listener in nachfolgende Tests durchsickern lassen.
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
  });

  it('setzt die Klasse NICHT, solange kein Modifier gedrückt ist', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;
    moveMouse(view, 10, 10);
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(false);
  });

  it('setzt die Klasse bei mousemove, wenn Ctrl gedrückt ist und ein Link unter dem Zeiger liegt', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    moveMouse(view, 10, 10);

    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(true);
  });

  it('setzt die Klasse bei mousemove, wenn Meta (Cmd) gedrückt ist', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }));
    moveMouse(view, 10, 10);

    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(true);
  });

  it('setzt die Klasse NICHT, wenn der Modifier gedrückt ist, aber kein Link unter dem Zeiger liegt', () => {
    view = hoverView('Nur Text ohne Link');
    view.posAtCoords = () => 4;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    moveMouse(view, 10, 10);

    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(false);
  });

  it('setzt die Klasse SOFORT bei keydown, ohne dass sich die Maus bewegt (letzte bekannte Position)', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;

    // Erst die Mausposition bekannt machen (ohne Modifier — Klasse bleibt aus) …
    moveMouse(view, 10, 10);
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(false);

    // … dann den Modifier drücken, OHNE die Maus zu bewegen: Klasse muss sofort erscheinen.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(true);
  });

  it('entfernt die Klasse SOFORT bei keyup, ohne dass sich die Maus bewegt', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    moveMouse(view, 10, 10);
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(false);
  });

  it('entfernt die Klasse bei window-blur, auch ohne vorheriges keyup (Fenster-Wechsel)', () => {
    view = hoverView('[Text](https://example.com)');
    view.posAtCoords = () => 2;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
    moveMouse(view, 10, 10);
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(view.contentDOM.classList.contains(LINK_HOVER_CLASS)).toBe(false);
  });

  it('entfernt am Ende von destroy() alle window-Listener (kein Leak)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    view = hoverView('[Text](https://example.com)');
    const addedTypes = addSpy.mock.calls.map((call) => call[0]);

    cleanup(view);
    view = null; // afterEach soll nicht nochmal cleanup() aufrufen

    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
    for (const type of new Set(addedTypes)) {
      expect(removedTypes).toContain(type);
    }

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

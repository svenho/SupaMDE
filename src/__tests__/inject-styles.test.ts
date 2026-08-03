import { describe, it, expect, beforeEach } from 'vitest';
import SupaMDE from '../index';
import { injectStyles } from '../ui/inject-styles';

/** Alle von SupaMDE gesetzten Style-Tags — die Testbasis muss pro Fall leer sein. */
function styleTags(): NodeListOf<HTMLStyleElement> {
  return document.head.querySelectorAll<HTMLStyleElement>('style[data-supamde-styles]');
}

function attachedTextarea(): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  document.body.appendChild(ta);
  return ta;
}

describe('injectStyles', () => {
  beforeEach(() => {
    styleTags().forEach((tag) => tag.remove());
  });

  it('setzt ein <style>-Tag mit den Toolbar-Regeln in den Head', () => {
    injectStyles();
    const tags = styleTags();
    expect(tags).toHaveLength(1);
    // Stichprobe je Quelldatei: alle vier CSS-Imports müssen im Tag landen.
    expect(tags[0]!.textContent).toContain('.supamde-toolbar');
    expect(tags[0]!.textContent).toContain('.supamde-statusbar');
    expect(tags[0]!.textContent).toContain('.supamde-preview-side');
    expect(tags[0]!.textContent).toContain('.supamde-fullscreen');
  });

  it('ist idempotent — mehrfache Aufrufe erzeugen nur EIN Tag', () => {
    injectStyles();
    injectStyles();
    injectStyles();
    expect(styleTags()).toHaveLength(1);
  });

  it('setzt das Tag als erstes Kind, damit Host-Styles bei gleicher Spezifität gewinnen', () => {
    const hostStyle = document.createElement('style');
    document.head.appendChild(hostStyle);
    injectStyles();
    expect(document.head.firstChild).toBe(styleTags()[0]);
    hostStyle.remove();
  });
});

describe('SupaMDE — Option injectStyles', () => {
  beforeEach(() => {
    styleTags().forEach((tag) => tag.remove());
  });

  it('injiziert die Styles standardmässig beim Erzeugen des Editors', () => {
    const editor = new SupaMDE({ element: attachedTextarea() });
    expect(styleTags()).toHaveLength(1);
    editor.toTextArea();
  });

  it('injiziert NICHT, wenn injectStyles: false gesetzt ist', () => {
    const editor = new SupaMDE({ element: attachedTextarea(), injectStyles: false });
    expect(styleTags()).toHaveLength(0);
    editor.toTextArea();
  });

  it('mehrere Instanzen teilen sich EIN Style-Tag', () => {
    const a = new SupaMDE({ element: attachedTextarea() });
    const b = new SupaMDE({ element: attachedTextarea() });
    expect(styleTags()).toHaveLength(1);
    a.toTextArea();
    b.toTextArea();
  });
});

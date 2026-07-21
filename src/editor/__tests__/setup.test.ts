import { describe, it, expect } from 'vitest';
import { editorFromTextArea } from '../setup';

function makeTextarea(value = '', attach = true): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.value = value;
  if (attach) document.body.appendChild(ta);
  return ta;
}

describe('editorFromTextArea', () => {
  it('wirft bei fehlendem element', () => {
    expect(() => editorFromTextArea({})).toThrow(/element/i);
  });

  it('wirft bei nicht-Textarea-element', () => {
    const div = document.createElement('div');
    expect(() => editorFromTextArea({ element: div })).toThrow(/textarea/i);
  });

  it('initialisiert das Doc aus dem Textarea-Wert', () => {
    const ta = makeTextarea('# Hallo');
    const h = editorFromTextArea({ element: ta });
    expect(h.view.state.doc.toString()).toBe('# Hallo');
    h.toTextArea();
  });

  it('initialValue überschreibt den Textarea-Wert', () => {
    const ta = makeTextarea('aus Textarea');
    const h = editorFromTextArea({ element: ta, initialValue: 'aus initialValue' });
    expect(h.view.state.doc.toString()).toBe('aus initialValue');
    h.toTextArea();
  });

  it('fügt view.dom vor der Textarea ein und versteckt die Textarea', () => {
    const ta = makeTextarea('x');
    const h = editorFromTextArea({ element: ta });
    expect(h.view.dom.parentNode).toBe(ta.parentNode);
    expect(ta.previousSibling).toBe(h.view.dom);
    expect(ta.style.display).toBe('none');
    h.toTextArea();
  });

  it('toTextArea entfernt view.dom, stellt Textarea her und schreibt den Wert zurück', () => {
    const ta = makeTextarea('start');
    const h = editorFromTextArea({ element: ta });
    h.view.dispatch({ changes: { from: 0, to: h.view.state.doc.length, insert: 'geändert' } });
    const returned = h.toTextArea();
    expect(returned).toBe(ta);
    expect(ta.value).toBe('geändert');
    expect(ta.style.display).not.toBe('none');
    expect(document.body.contains(h.view.dom)).toBe(false);
  });

  it('forceSync und Form-Submit schreiben den Doc-Wert in die Textarea', () => {
    const form = document.createElement('form');
    const ta = makeTextarea('a', false);
    form.appendChild(ta);
    document.body.appendChild(form);

    const h = editorFromTextArea({ element: ta });
    h.view.dispatch({ changes: { from: 0, to: h.view.state.doc.length, insert: 'b' } });

    // submit abbrechen, um Navigation in jsdom zu vermeiden
    form.addEventListener('submit', (e) => e.preventDefault());
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(ta.value).toBe('b');

    h.toTextArea();
    form.remove();
  });
});

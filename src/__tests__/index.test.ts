import { describe, it, expect } from 'vitest';
import SupaMDE, { SupaMDE as NamedSupaMDE, VERSION } from '../index';

describe('SupaMDE (Skelett)', () => {
  it('exportiert dieselbe Klasse als Default- und benannten Export', () => {
    expect(SupaMDE).toBe(NamedSupaMDE);
  });

  it('stellt die Version als statische Eigenschaft bereit', () => {
    expect(SupaMDE.version).toBe(VERSION);
  });
});

describe('SupaMDE (Editor-API, M1)', () => {
  function attachedTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('baut einen Editor aus der Textarea und liest den Wert', () => {
    const ta = attachedTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });
    expect(editor.value()).toBe('# Titel');
    expect(editor.getValue()).toBe('# Titel');
    editor.toTextArea();
  });

  it('setValue und value(val) ersetzen den Doc-Inhalt (äquivalent)', () => {
    const ta = attachedTextarea('alt');
    const editor = new SupaMDE({ element: ta });
    editor.setValue('neu');
    expect(editor.getValue()).toBe('neu');
    editor.value('via value');
    expect(editor.value()).toBe('via value');
    editor.toTextArea();
  });

  it('Roundtrip für Mehrzeiler und Leerstring', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });
    editor.setValue('Zeile 1\nZeile 2\n');
    expect(editor.getValue()).toBe('Zeile 1\nZeile 2\n');
    editor.setValue('');
    expect(editor.getValue()).toBe('');
    editor.toTextArea();
  });

  it('exponiert die EditorView als `codemirror`', () => {
    const ta = attachedTextarea('x');
    const editor = new SupaMDE({ element: ta });
    expect(editor.codemirror).toBe(editor.codemirror); // stabil
    expect(typeof editor.codemirror.state.doc.toString()).toBe('string');
    editor.toTextArea();
  });

  it('wirft bei fehlendem element', () => {
    expect(() => new SupaMDE({})).toThrow(/element/i);
  });
});

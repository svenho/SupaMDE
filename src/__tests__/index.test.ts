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

describe('SupaMDE (Toolbar/Statusbar-Integration, M3)', () => {
  function makeTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('baut Container mit Toolbar und Statusbar', () => {
    const ta = makeTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });
    const container = ta.previousSibling as HTMLElement;
    // Container liegt vor der (versteckten) Textarea
    expect(container.classList.contains('supamde-container')).toBe(true);
    expect(container.querySelector('.supamde-toolbar')).not.toBeNull();
    expect(container.querySelector('.supamde-statusbar')).not.toBeNull();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    editor.toTextArea();
  });

  it('respektiert toolbar:false und status:false', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta, toolbar: false, status: false });
    const container = ta.previousSibling as HTMLElement;
    expect(container.querySelector('.supamde-toolbar')).toBeNull();
    expect(container.querySelector('.supamde-statusbar')).toBeNull();
    editor.toTextArea();
  });

  it('Statusbar zeigt initial die Wortzahl', () => {
    const ta = makeTextarea('ein zwei drei');
    const editor = new SupaMDE({ element: ta });
    const words = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-words')!;
    expect(words.textContent).toContain('3');
    editor.toTextArea();
  });

  it('updateStatusBar überschreibt ein Item', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta, status: ['autosave'] });
    editor.updateStatusBar('autosave', 'gespeichert');
    const el = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-autosave')!;
    expect(el.textContent).toBe('gespeichert');
    editor.toTextArea();
  });

  it('toTextArea räumt den Container ab', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta });
    editor.toTextArea();
    expect(document.querySelector('.supamde-container')).toBeNull();
    expect(ta.style.display).not.toBe('none');
  });
});

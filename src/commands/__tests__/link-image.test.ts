import { describe, it, expect, vi } from 'vitest';
import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { insertLink, insertImage, drawLink, drawImage } from '../link-image';
import { translatorFacet } from '../../i18n/facet';
import { createTranslator } from '../../i18n/translator';
import { de } from '../../i18n/de';

function viewWith(
  doc: string,
  anchor = 0,
  head = anchor,
  extensions: Extension[] = [],
): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions,
  });
  return new EditorView({ state });
}

describe('insertLink', () => {
  it('nutzt die Selektion als Linktext (AC-K1)', () => {
    const view = viewWith('Text', 0, 4);
    expect(insertLink('http://x')(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('[Text](http://x)');
    view.destroy();
  });

  it('nutzt das text-Argument ohne Selektion (AC-K2)', () => {
    const view = viewWith('', 0);
    expect(insertLink('http://x', 'Text')(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('[Text](http://x)');
    view.destroy();
  });

  it('ist ein No-op bei leerer URL und gibt false zurück (AC-K4)', () => {
    const view = viewWith('abc', 0, 3);
    expect(insertLink('')(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('abc');
    view.destroy();
  });
});

describe('insertImage (AC-K3)', () => {
  it('erzeugt ![alt](url)', () => {
    const view = viewWith('', 0);
    insertImage('http://x', 'alt')(view);
    expect(view.state.doc.toString()).toBe('![alt](http://x)');
    view.destroy();
  });

  it('ist ein No-op bei leerer URL und gibt false zurück', () => {
    const view = viewWith('x', 0, 1);
    expect(insertImage('')(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('x');
    view.destroy();
  });
});

describe('drawLink (Wrapper)', () => {
  it('fragt via prompt und fügt den Link ein', () => {
    const view = viewWith('Text', 0, 4);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue('http://y');
    expect(drawLink(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('[Text](http://y)');
    stub.mockRestore();
    view.destroy();
  });

  it('bricht ab, wenn prompt null liefert', () => {
    const view = viewWith('Text', 0, 4);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(drawLink(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('Text');
    stub.mockRestore();
    view.destroy();
  });
});

describe('drawImage (Wrapper)', () => {
  it('fragt via prompt und fügt das Bild ein', () => {
    const view = viewWith('alt', 0, 3);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue('http://pic.png');
    expect(drawImage(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('![alt](http://pic.png)');
    stub.mockRestore();
    view.destroy();
  });

  it('bricht ab, wenn prompt null liefert', () => {
    const view = viewWith('alt', 0, 3);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(drawImage(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('alt');
    stub.mockRestore();
    view.destroy();
  });
});

describe('Prompt-Texte (i18n)', () => {
  it('drawLink fragt ohne Translator englisch', () => {
    const view = viewWith('Text', 0, 4);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    drawLink(view);
    expect(stub).toHaveBeenCalledWith('Link URL:', 'https://');
    stub.mockRestore();
    view.destroy();
  });

  it('drawImage fragt ohne Translator englisch', () => {
    const view = viewWith('alt', 0, 3);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    drawImage(view);
    expect(stub).toHaveBeenCalledWith('Image URL:', 'https://');
    stub.mockRestore();
    view.destroy();
  });

  it('beide Prompts folgen dem Translator im State', () => {
    const view = viewWith('x', 0, 1, [translatorFacet.of(createTranslator(de))]);
    const stub = vi.spyOn(window, 'prompt').mockReturnValue(null);
    drawLink(view);
    drawImage(view);
    expect(stub).toHaveBeenNthCalledWith(1, 'Link-URL:', 'https://');
    expect(stub).toHaveBeenNthCalledWith(2, 'Bild-URL:', 'https://');
    stub.mockRestore();
    view.destroy();
  });
});

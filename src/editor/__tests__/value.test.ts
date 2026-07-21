import { describe, it, expect } from 'vitest';
import { EditorView } from '@codemirror/view';
import { readValue, writeValue } from '../value';

function viewWith(doc: string): EditorView {
  return new EditorView({ doc });
}

describe('readValue / writeValue', () => {
  it('readValue liefert den aktuellen Doc-Inhalt', () => {
    const view = viewWith('# Titel');
    expect(readValue(view)).toBe('# Titel');
    view.destroy();
  });

  it('writeValue ersetzt den gesamten Doc-Inhalt', () => {
    const view = viewWith('alt');
    writeValue(view, 'neu');
    expect(readValue(view)).toBe('neu');
    view.destroy();
  });

  it('Roundtrip für Mehrzeiler und Leerstring', () => {
    const view = viewWith('start');
    writeValue(view, 'Zeile 1\nZeile 2\n');
    expect(readValue(view)).toBe('Zeile 1\nZeile 2\n');
    writeValue(view, '');
    expect(readValue(view)).toBe('');
    view.destroy();
  });
});

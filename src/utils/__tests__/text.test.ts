import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { selectedLineRange, toggleLinePrefix, wrapSelection, mapSelectedLines } from '../text';
import { stripLinePrefix, dedentWidth } from '../../commands/prefixes';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('selectedLineRange', () => {
  it('umfasst die volle Zeile bei Cursor in der Zeilenmitte', () => {
    const view = viewWith('abc\ndef', 5); // in "def"
    const r = selectedLineRange(view.state);
    expect(view.state.sliceDoc(r.from, r.to)).toBe('def');
    view.destroy();
  });

  it('umfasst mehrere Zeilen bei mehrzeiliger Selektion', () => {
    const view = viewWith('a\nb\nc', 0, 3); // "a\nb"
    const r = selectedLineRange(view.state);
    expect(view.state.sliceDoc(r.from, r.to)).toBe('a\nb');
    view.destroy();
  });
});

describe('mapSelectedLines', () => {
  it('wendet build auf jede berührte Zeile an und dispatcht die Änderungen', () => {
    const view = viewWith('a\nb\nc', 0, 3);
    const changed = mapSelectedLines(view, (line) => ({ from: line.from, to: line.from, insert: '+' }));
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('+a\n+b\nc');
    view.destroy();
  });

  it('liefert false und dispatcht nichts, wenn build überall null liefert', () => {
    const view = viewWith('a\nb', 0, 3);
    const changed = mapSelectedLines(view, () => null);
    expect(changed).toBe(false);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('toggleLinePrefix', () => {
  it('fügt das Präfix jeder Zeile hinzu', () => {
    const view = viewWith('a\nb', 0, 3);
    const changed = toggleLinePrefix(view, '> ');
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('> a\n> b');
    view.destroy();
  });

  it('entfernt das Präfix, wenn alle Zeilen es tragen', () => {
    const view = viewWith('> a\n> b', 0, 7);
    toggleLinePrefix(view, '> ');
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('wrapSelection', () => {
  it('umschließt die Selektion mit Markern', () => {
    const view = viewWith('abc', 0, 3);
    const changed = wrapSelection(view, '**', '**');
    expect(changed).toBe(true);
    expect(view.state.doc.toString()).toBe('**abc**');
    view.destroy();
  });

  it('fügt bei leerer Selektion ein Marker-Paar ein und setzt den Cursor dazwischen', () => {
    const view = viewWith('', 0);
    wrapSelection(view, '**', '**');
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
    view.destroy();
  });
});

describe('stripLinePrefix', () => {
  it('erkennt Checkliste vor dem allgemeinen Aufzählungsstrich', () => {
    expect(stripLinePrefix('- [ ] Aufgabe')).toEqual({ indent: '', prefix: '- [ ] ', rest: 'Aufgabe' });
  });

  it('erkennt eingerückte Präfixe und liefert die Einrückung separat', () => {
    expect(stripLinePrefix('  - Punkt')).toEqual({ indent: '  ', prefix: '- ', rest: 'Punkt' });
    expect(stripLinePrefix('\t1. Punkt')).toEqual({ indent: '\t', prefix: '1. ', rest: 'Punkt' });
    expect(stripLinePrefix('    - [x] Aufgabe')).toEqual({
      indent: '    ',
      prefix: '- [x] ',
      rest: 'Aufgabe',
    });
  });

  it('lässt reine Whitespace-Zeilen ohne Präfix null', () => {
    expect(stripLinePrefix('   ')).toBeNull();
  });

  it('erkennt Heading, Quote und geordnete Liste', () => {
    expect(stripLinePrefix('## Titel')?.prefix).toBe('## ');
    expect(stripLinePrefix('> zitat')?.prefix).toBe('> ');
    expect(stripLinePrefix('3. Punkt')?.prefix).toBe('3. ');
  });

  it('erkennt beide ungeordneten Bullet-Marker ("* " und Bestands-"- ")', () => {
    expect(stripLinePrefix('* Punkt')?.prefix).toBe('* ');
    expect(stripLinePrefix('- Punkt')?.prefix).toBe('- ');
  });

  it('liefert null ohne bekanntes Präfix', () => {
    expect(stripLinePrefix('Klartext')).toBeNull();
  });
});

describe('dedentWidth', () => {
  it('zählt bis zu unit-viele führende Leerzeichen', () => {
    expect(dedentWidth('    - Punkt', 2)).toBe(2);
    expect(dedentWidth(' a', 2)).toBe(1);
  });

  it('liefert 0 ohne führenden Whitespace', () => {
    expect(dedentWidth('- Punkt', 2)).toBe(0);
  });

  it('zählt ein führendes Tab-Zeichen als eine volle Stufe', () => {
    expect(dedentWidth('\ta', 2)).toBe(1);
  });
});

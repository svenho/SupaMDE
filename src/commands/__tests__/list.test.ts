import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { unorderedList, unorderedListStar, orderedList, checkList, continueList } from '../list';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('unorderedList — Spiegelstrich "- " (AC-L1, Default)', () => {
  it('setzt und entfernt "- "', () => {
    const view = viewWith('a\nb', 0, 3);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- a\n- b');
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('konvertiert eine Bestands-"* "-Liste auf "- " (kein doppeltes Präfix)', () => {
    const view = viewWith('* a\n* b', 0, 7);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- a\n- b');
    view.destroy();
  });

  it('platziert den Cursor hinter den Marker in einer leeren Zeile', () => {
    const view = viewWith('', 0);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- ');
    expect(view.state.selection.main.head).toBe(2);
    view.destroy();
  });
});

describe('unorderedListStar — Sternchen "* " (Shift+Alt+Cmd+L)', () => {
  it('setzt und entfernt "* "', () => {
    const view = viewWith('a\nb', 0, 3);
    unorderedListStar(view);
    expect(view.state.doc.toString()).toBe('* a\n* b');
    unorderedListStar(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('konvertiert eine Bestands-"- "-Liste auf "* " (kein doppeltes Präfix)', () => {
    const view = viewWith('- a\n- b', 0, 7);
    unorderedListStar(view);
    expect(view.state.doc.toString()).toBe('* a\n* b');
    view.destroy();
  });

  it('gemischte Marker werden einheitlich auf "* " gebracht', () => {
    const view = viewWith('- a\n* b\nc', 0, 9);
    unorderedListStar(view);
    expect(view.state.doc.toString()).toBe('* a\n* b\n* c');
    view.destroy();
  });
});

describe('orderedList (AC-L2)', () => {
  it('nummeriert fortlaufend', () => {
    const view = viewWith('a\nb\nc', 0, 5);
    orderedList(view);
    expect(view.state.doc.toString()).toBe('1. a\n2. b\n3. c');
    view.destroy();
  });

  it('platziert den Cursor hinter den Marker in einer leeren Zeile', () => {
    const view = viewWith('', 0);
    orderedList(view);
    expect(view.state.doc.toString()).toBe('1. ');
    expect(view.state.selection.main.head).toBe(3);
    view.destroy();
  });
});

describe('checkList (AC-L3)', () => {
  it('setzt "- [ ] "', () => {
    const view = viewWith('a', 0, 1);
    checkList(view);
    expect(view.state.doc.toString()).toBe('- [ ] a');
    view.destroy();
  });

  it('platziert den Cursor hinter den Marker in einer leeren Zeile', () => {
    const view = viewWith('', 0);
    checkList(view);
    expect(view.state.doc.toString()).toBe('- [ ] ');
    expect(view.state.selection.main.head).toBe(6);
    view.destroy();
  });
});

describe('continueList (AC-L4/L5)', () => {
  it('setzt das "- "-Präfix in der neuen Zeile fort', () => {
    const view = viewWith('- item', 6); // Cursor am Zeilenende
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- item\n- ');
    view.destroy();
  });

  it('behält auch einen "* "-Marker bei der Fortsetzung bei', () => {
    const view = viewWith('* item', 6);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('* item\n* ');
    view.destroy();
  });

  it('beendet die Liste bei leerer Listenzeile', () => {
    const view = viewWith('- ', 2);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('');
    view.destroy();
  });

  it('gibt false zurück außerhalb einer Liste', () => {
    const view = viewWith('kein Listeneintrag', 5);
    expect(continueList(view)).toBe(false);
    view.destroy();
  });
});

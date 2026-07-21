import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { unorderedList, orderedList, checkList, continueList } from '../list';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
  });
  return new EditorView({ state });
}

describe('unorderedList (AC-L1)', () => {
  it('setzt und entfernt "* "', () => {
    const view = viewWith('a\nb', 0, 3);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('* a\n* b');
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('entfernt eine Bestands-"- "-Liste beim Toggle-Off (kein doppeltes "* -")', () => {
    const view = viewWith('- a\n- b', 0, 7);
    unorderedList(view);
    // Bestands-Spiegelstriche werden als Liste erkannt und ENTFERNT,
    // nicht mit einem zweiten Marker versehen.
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });

  it('gemischte Marker (- und *): alle als Liste erkannt, alle entfernt', () => {
    const view = viewWith('- a\n* b', 0, 7);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('a\nb');
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
});

describe('checkList (AC-L3)', () => {
  it('setzt "- [ ] "', () => {
    const view = viewWith('a', 0, 1);
    checkList(view);
    expect(view.state.doc.toString()).toBe('- [ ] a');
    view.destroy();
  });
});

describe('continueList (AC-L4/L5)', () => {
  it('setzt das "* "-Präfix in der neuen Zeile fort', () => {
    const view = viewWith('* item', 6); // Cursor am Zeilenende
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('* item\n* ');
    view.destroy();
  });

  it('behält einen Bestands-"- "-Marker bei der Fortsetzung bei', () => {
    const view = viewWith('- item', 6);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- item\n- ');
    view.destroy();
  });

  it('beendet die Liste bei leerer Listenzeile', () => {
    const view = viewWith('* ', 2);
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

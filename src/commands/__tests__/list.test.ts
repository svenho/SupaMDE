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

  it('konvertiert verschachtelte Marker hinter der Einrückung statt davor', () => {
    // Die eingerückte Zeile trägt bereits einen Marker: er muss ERSETZT werden,
    // ohne dass ein zweiter Marker vor die Einrückung rutscht.
    const view = viewWith('* huhu\n  * hihi\n* haha', 0, 22);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- huhu\n  - hihi\n- haha');
    view.destroy();
  });

  it('entfernt Marker verschachtelter Listen und behält die Einrückung', () => {
    const view = viewWith('- huhu\n  - hihi\n- haha', 0, 22);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('huhu\n  hihi\nhaha');
    view.destroy();
  });

  it('setzt den Marker bei eingerücktem Klartext hinter die Einrückung', () => {
    const view = viewWith('- a\n  b', 0, 7);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- a\n  - b');
    view.destroy();
  });

  it('lässt Checklisten und geordnete Listen unangetastet', () => {
    const view = viewWith('* a\n- [ ] todo\n1. eins\nklartext', 0, 31);
    unorderedList(view);
    expect(view.state.doc.toString()).toBe('- a\n- [ ] todo\n1. eins\n- klartext');
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

  it('konvertiert verschachtelte Marker hinter der Einrückung statt davor', () => {
    const view = viewWith('- huhu\n  - hihi\n- haha', 0, 22);
    unorderedListStar(view);
    expect(view.state.doc.toString()).toBe('* huhu\n  * hihi\n* haha');
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

  it('beendet die Liste ohne zusätzliche Leerzeile, wenn Zeilen vorausgehen', () => {
    // Zweites Enter direkt nach dem ersten: die leere Listenzeile folgt auf einen
    // befüllten Eintrag. Es darf NUR das Präfix verschwinden — die Zeile selbst
    // bleibt bestehen und der Cursor steht an ihrem Anfang.
    const view = viewWith('- item\n- ', 9);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- item\n');
    expect(view.state.selection.main.head).toBe(7);
    view.destroy();
  });

  it('beendet die Liste per Enter-Folge (Eintrag → Enter → Enter)', () => {
    const view = viewWith('- item', 6);
    continueList(view); // 1. Enter: neue Listenzeile mit Präfix
    expect(view.state.doc.toString()).toBe('- item\n- ');
    continueList(view); // 2. Enter: Präfix weg, KEINE weitere Zeile
    expect(view.state.doc.toString()).toBe('- item\n');
    expect(view.state.selection.main.head).toBe(7);
    view.destroy();
  });

  it('gibt false zurück, wenn der Cursor VOR dem Listenmarker steht (Bug: "* * Hallo")', () => {
    // Cursor am Zeilenanfang, also vor dem Marker: Enter darf hier nur eine
    // Leerzeile einfügen, kein zweites Präfix erzeugen.
    const view = viewWith('* Hallo', 0);
    expect(continueList(view)).toBe(false);
    view.destroy();
  });

  it('gibt false zurück, wenn der Cursor INNERHALB des Listenmarkers steht', () => {
    const view = viewWith('- [ ] Aufgabe', 3);
    expect(continueList(view)).toBe(false);
    view.destroy();
  });

  it('gibt false zurück, wenn der Cursor vor der Einrückung einer Unterliste steht', () => {
    const view = viewWith('- a\n  - b', 4); // Anfang der eingerückten Zeile
    expect(continueList(view)).toBe(false);
    view.destroy();
  });

  it('setzt fort, wenn der Cursor direkt hinter dem Marker steht', () => {
    const view = viewWith('* Hallo', 2);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('* \n* Hallo');
    view.destroy();
  });

  it('gibt false zurück außerhalb einer Liste', () => {
    const view = viewWith('kein Listeneintrag', 5);
    expect(continueList(view)).toBe(false);
    view.destroy();
  });

  it('setzt eingerückte Listen samt Einrückung fort', () => {
    const view = viewWith('- a\n  - b', 9);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n  - ');
    view.destroy();
  });

  it('beendet eine eingerückte Liste ohne zusätzliche Zeile', () => {
    // Zweites Enter in der eingerückten Liste: Einrückung UND Marker müssen weg,
    // der Cursor bleibt am Anfang derselben Zeile (keine neue Leerzeile).
    const view = viewWith('- a\n  - b\n  - ', 14);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n');
    expect(view.state.selection.main.head).toBe(10);
    view.destroy();
  });

  it('beendet eingerückte Liste per Enter-Folge (Eintrag → Enter → Enter)', () => {
    const view = viewWith('- a\n  - b', 9);
    continueList(view);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n  - ');
    continueList(view);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n');
    view.destroy();
  });

  it('inkrementiert eingerückte geordnete Listen', () => {
    const view = viewWith('  3. Punkt', 10);
    expect(continueList(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('  3. Punkt\n  4. ');
    view.destroy();
  });
});

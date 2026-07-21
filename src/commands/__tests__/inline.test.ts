import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { bold, italic, strikethrough, inlineCode } from '../inline';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ extensions: GFM })],
  });
  return new EditorView({ state });
}

describe('bold', () => {
  it('umschließt die Selektion mit ** (AC-I1)', () => {
    const view = viewWith('Wort', 0, 4);
    expect(bold(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('**Wort**');
    view.destroy();
  });

  it('fügt am Cursor ein Marker-Paar ein und setzt den Cursor dazwischen (AC-I2)', () => {
    const view = viewWith('', 0);
    bold(view);
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
    view.destroy();
  });

  it('entfernt vorhandene ** (Toggle-Off, AC-I3)', () => {
    const view = viewWith('**Wort**', 2, 6); // "Wort" selektiert
    bold(view);
    expect(view.state.doc.toString()).toBe('Wort');
    view.destroy();
  });

  it('umschließt eine mehrzeilige Selektion als einen Bereich (AC-I5)', () => {
    const view = viewWith('a\nb', 0, 3);
    bold(view);
    expect(view.state.doc.toString()).toBe('**a\nb**');
    view.destroy();
  });
});

describe('verschachteltes Toggle (AC-I4)', () => {
  it('italic-Toggle-Off wirkt nur auf den inneren *b*, ** bleibt intakt', () => {
    // Ausgangsdoc mit real verschachteltem Emphasis-Knoten:
    // "**a *b* c**" → StrongEmphasis(…, Emphasis(*b*), …). italic-Toggle auf "b"
    // findet den inneren Emphasis-Knoten und entfernt NUR dessen *-Marker;
    // die umschließende **-Ebene bleibt unangetastet.
    const view = viewWith('**a *b* c**', 5, 6); // "b" innerhalb des Emphasis
    italic(view);
    expect(view.state.doc.toString()).toBe('**a b c**');
    view.destroy();
  });

  it('italic-Toggle-On fügt inneres *…* ein, ohne die **-Ebene zu berühren', () => {
    // Gegenprobe ohne inneren Knoten: hier greift der wrapSelection-Zweig.
    const view = viewWith('**a b c**', 4, 5); // "b" selektiert, kein Emphasis darum
    italic(view);
    expect(view.state.doc.toString()).toBe('**a *b* c**');
    view.destroy();
  });
});

describe('italic / strikethrough / inlineCode', () => {
  it('italic umschließt mit *', () => {
    const view = viewWith('x', 0, 1);
    italic(view);
    expect(view.state.doc.toString()).toBe('*x*');
    view.destroy();
  });

  it('strikethrough umschließt mit ~~', () => {
    const view = viewWith('x', 0, 1);
    strikethrough(view);
    expect(view.state.doc.toString()).toBe('~~x~~');
    view.destroy();
  });

  it('inlineCode umschließt mit `', () => {
    const view = viewWith('x', 0, 1);
    inlineCode(view);
    expect(view.state.doc.toString()).toBe('`x`');
    view.destroy();
  });
});

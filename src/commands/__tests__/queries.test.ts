import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import {
  resolveEnclosingNode,
  isBold,
  isItalic,
  isStrikethrough,
  isInlineCode,
  activeHeadingLevel,
  isQuote,
  isInUnorderedList,
  isInOrderedList,
  isInCheckList,
} from '../queries';

/** Baut einen State, dessen Cursor bei `pos` (Default: Mitte von `doc`) steht. */
function stateAt(doc: string, pos = Math.floor(doc.length / 2)): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [markdown({ extensions: GFM })],
  });
}

describe('resolveEnclosingNode', () => {
  it('liefert den umschließenden Knoten', () => {
    const doc = 'ein **fetter** text';
    const node = resolveEnclosingNode(stateAt(doc, doc.indexOf('fetter') + 2), 'StrongEmphasis');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('StrongEmphasis');
  });

  it('liefert null, wenn kein solcher Knoten umschließt', () => {
    expect(resolveEnclosingNode(stateAt('nur klartext', 3), 'StrongEmphasis')).toBeNull();
  });
});

describe('inline queries', () => {
  it('isBold erkennt Cursor in **fett**', () => {
    const doc = 'ein **fetter** text';
    expect(isBold(stateAt(doc, doc.indexOf('fetter') + 2))).toBe(true);
  });

  it('isBold ist false außerhalb', () => {
    expect(isBold(stateAt('nur klartext', 3))).toBe(false);
  });

  it('isItalic erkennt Cursor in *kursiv*', () => {
    const doc = 'ein *kursiver* text';
    expect(isItalic(stateAt(doc, doc.indexOf('kursiver') + 2))).toBe(true);
  });

  it('isStrikethrough erkennt ~~durch~~', () => {
    const doc = 'ein ~~weg~~ text';
    expect(isStrikethrough(stateAt(doc, doc.indexOf('weg') + 1))).toBe(true);
  });

  it('isInlineCode erkennt `code`', () => {
    const doc = 'ein `x` text';
    expect(isInlineCode(stateAt(doc, doc.indexOf('x')))).toBe(true);
  });
});

describe('block/list queries', () => {
  it('activeHeadingLevel liefert die #-Ebene', () => {
    expect(activeHeadingLevel(stateAt('### Titel', 5))).toBe(3);
  });

  it('activeHeadingLevel liefert 0 ohne Überschrift', () => {
    expect(activeHeadingLevel(stateAt('Absatz', 2))).toBe(0);
  });

  it('isQuote erkennt Blockzitat', () => {
    expect(isQuote(stateAt('> zitat', 3))).toBe(true);
    expect(isQuote(stateAt('kein zitat', 3))).toBe(false);
  });

  it('isInUnorderedList erkennt - und *', () => {
    expect(isInUnorderedList(stateAt('- punkt', 3))).toBe(true);
    expect(isInUnorderedList(stateAt('* punkt', 3))).toBe(true);
    expect(isInUnorderedList(stateAt('kein punkt', 3))).toBe(false);
  });

  it('isInOrderedList erkennt 1.', () => {
    expect(isInOrderedList(stateAt('1. punkt', 3))).toBe(true);
    expect(isInOrderedList(stateAt('- punkt', 3))).toBe(false);
  });

  it('isInCheckList erkennt - [ ]', () => {
    expect(isInCheckList(stateAt('- [ ] task', 5))).toBe(true);
    expect(isInCheckList(stateAt('- punkt', 3))).toBe(false);
  });
});

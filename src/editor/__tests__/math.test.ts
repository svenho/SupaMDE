import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { syntaxTree } from '@codemirror/language';
import { Math as MathExtension } from '../math';

function parse(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM, MathExtension] })],
  });
}

/** Sammelt die Namen aller Knoten, die innerhalb eines Bereichs `[from, to)` liegen. */
function nodeNamesInRange(state: EditorState, from: number, to: number): string[] {
  const names: string[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.from >= from && node.to <= to) names.push(node.name);
    },
  });
  return names;
}

describe('Math-Extension', () => {
  it('erkennt $...$ als InlineMath-Knoten', () => {
    const state = parse('$x^2$');
    let found = false;
    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name === 'InlineMath') found = true;
      },
    });
    expect(found).toBe(true);
  });

  it('erkennt $$...$$ als BlockMath-Knoten', () => {
    const state = parse('$$x^2$$');
    let found = false;
    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name === 'BlockMath') found = true;
      },
    });
    expect(found).toBe(true);
  });

  it('parst **fett** innerhalb von $...$ NICHT als StrongEmphasis', () => {
    const state = parse('$a **b** c$');
    const names = nodeNamesInRange(state, 0, state.doc.length);
    expect(names).not.toContain('StrongEmphasis');
  });

  it('parst [Link](url) innerhalb von $...$ NICHT als Link', () => {
    const state = parse('$a [b](c) d$');
    const names = nodeNamesInRange(state, 0, state.doc.length);
    expect(names).not.toContain('Link');
  });

  it('parst **fett** außerhalb von $...$ weiterhin als StrongEmphasis', () => {
    const state = parse('**b** und $x$');
    let found = false;
    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name === 'StrongEmphasis') found = true;
      },
    });
    expect(found).toBe(true);
  });
});

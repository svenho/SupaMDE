import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { HighlightStyle } from '@codemirror/language';
import { supaHighlightStyle, highlightExtension } from '../highlight';

describe('supaHighlightStyle', () => {
  it('ist ein HighlightStyle', () => {
    expect(supaHighlightStyle).toBeInstanceOf(HighlightStyle);
  });

  it('ist als Extension in einem State nutzbar (Style gültig)', () => {
    // Robuster als das Inspizieren von HighlightStyle-Interna (`.specs` ist
    // kein garantiertes öffentliches API): Wenn der Style ungültig wäre,
    // würde EditorState.create() werfen.
    const state = EditorState.create({ doc: '# H', extensions: [highlightExtension] });
    expect(state.doc.toString()).toBe('# H');
  });

  it('stellt eine Extension bereit', () => {
    expect(highlightExtension).toBeDefined();
  });
});

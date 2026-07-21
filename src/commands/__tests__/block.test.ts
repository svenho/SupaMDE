import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import {
  setHeading,
  headingSmaller,
  headingBigger,
  quote,
  codeBlock,
  horizontalRule,
  cleanBlock,
} from '../block';

function viewWith(doc: string, anchor = 0, head = anchor): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown({ extensions: GFM })],
  });
  return new EditorView({ state });
}

describe('setHeading', () => {
  it('setzt ## vor eine Klartextzeile (AC-B1)', () => {
    const view = viewWith('Titel', 0);
    expect(setHeading(2)(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('## Titel');
    view.destroy();
  });

  it('entfernt die Überschrift bei erneutem gleichem Level (Toggle, AC-B1)', () => {
    const view = viewWith('## Titel', 0);
    setHeading(2)(view);
    expect(view.state.doc.toString()).toBe('Titel');
    view.destroy();
  });
});

describe('headingSmaller / headingBigger (AC-B2)', () => {
  it('headingSmaller macht aus Klartext H1 und dann H2', () => {
    const view = viewWith('T', 0);
    headingSmaller(view);
    expect(view.state.doc.toString()).toBe('# T');
    headingSmaller(view);
    expect(view.state.doc.toString()).toBe('## T');
    view.destroy();
  });

  it('headingBigger macht aus H1 Klartext und bleibt dann bei Klartext (Untergrenze)', () => {
    const view = viewWith('# T', 0);
    headingBigger(view);
    expect(view.state.doc.toString()).toBe('T');
    headingBigger(view);
    expect(view.state.doc.toString()).toBe('T');
    view.destroy();
  });

  it('headingBigger auf Klartext (Level 0) ist No-op: gibt false zurück und ändert Doc nicht', () => {
    const view = viewWith('T', 0);
    const result = headingBigger(view);
    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe('T');
    view.destroy();
  });
});

describe('quote (AC-B3)', () => {
  it('setzt und entfernt > Präfix', () => {
    const view = viewWith('a\nb', 0, 3);
    quote(view);
    expect(view.state.doc.toString()).toBe('> a\n> b');
    quote(view);
    expect(view.state.doc.toString()).toBe('a\nb');
    view.destroy();
  });
});

describe('codeBlock (AC-B4)', () => {
  it('umschließt die Selektion mit Fences', () => {
    const view = viewWith('x', 0, 1);
    codeBlock(view);
    expect(view.state.doc.toString()).toBe('```\nx\n```');
    view.destroy();
  });

  it('entfernt die Fences auf bereits umschlossener Selektion (Toggle-Off)', () => {
    const view = viewWith('```\nx\n```', 4, 5); // "x" innerhalb der Fences selektiert
    codeBlock(view);
    expect(view.state.doc.toString()).toBe('x');
    view.destroy();
  });
});

describe('horizontalRule (AC-B5)', () => {
  it('fügt eine Trennlinie an der Cursorzeile ein', () => {
    const view = viewWith('a', 1);
    horizontalRule(view);
    expect(view.state.doc.toString()).toBe('a\n---\n');
    view.destroy();
  });
});

describe('cleanBlock (AC-B6)', () => {
  it('entfernt Heading-, Quote- und Listen-Präfixe (inkl. beider Bullet-Marker)', () => {
    const doc = '## a\n> b\n- c\n1. d\n* e';
    const view = viewWith(doc, 0, doc.length);
    cleanBlock(view);
    expect(view.state.doc.toString()).toBe('a\nb\nc\nd\ne');
    view.destroy();
  });
});

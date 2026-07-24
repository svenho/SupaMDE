import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { buildExtensions } from '../extensions';
import type { ResolvedOptions } from '../../options';
import { resolveOptions } from '../../options';

const base: ResolvedOptions = {
  lineWrapping: true,
  placeholder: null,
  autofocus: false,
  tabSize: 2,
  indentUnit: 2,
};

/** Baut einen State aus den Extensions — schlägt fehl, wenn Extensions inkompatibel sind. */
function stateFrom(resolved: ResolvedOptions) {
  return EditorState.create({ doc: '# Test', extensions: buildExtensions(resolved) });
}

describe('buildExtensions', () => {
  it('liefert immer eine nicht-leere Extension-Liste', () => {
    const ext = buildExtensions(base);
    expect(Array.isArray(ext)).toBe(true);
    expect(ext.length).toBeGreaterThan(0);
  });

  it('erzeugt einen gültigen State (Extensions kompatibel)', () => {
    const state = stateFrom(base);
    expect(state.doc.toString()).toBe('# Test');
  });

  it('aktiviert lineWrapping, wenn lineWrapping=true', () => {
    const view = new EditorView({ state: stateFrom({ ...base, lineWrapping: true }) });
    expect(view.lineWrapping).toBe(true);
    view.destroy();
  });

  it('aktiviert lineWrapping NICHT, wenn lineWrapping=false', () => {
    const view = new EditorView({ state: stateFrom({ ...base, lineWrapping: false }) });
    expect(view.lineWrapping).toBe(false);
    view.destroy();
  });

  it('übernimmt tabSize in den State', () => {
    const state = stateFrom({ ...base, tabSize: 4 });
    expect(state.tabSize).toBe(4);
  });

  it('übernimmt indentUnit in den State', () => {
    // indentUnit ist als String (Leerzeichen) im Facet hinterlegt.
    const state = stateFrom({ ...base, indentUnit: 4 });
    expect(state.facet(indentUnit)).toBe('    ');
  });

  it('erzeugt bei gesetztem placeholder das .cm-placeholder-DOM', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const view = new EditorView({
      state: stateFrom({ ...base, placeholder: "Los geht's …" }),
      parent: ta.parentNode as HTMLElement,
    });
    // Placeholder erscheint nur im leeren Doc; hier ist doc='# Test' → wir
    // prüfen stattdessen, dass die Extension aktiv ist, indem wir leeren.
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    expect(view.dom.querySelector('.cm-placeholder')).not.toBeNull();
    view.destroy();
    ta.remove();
  });

  it('erzeugt KEIN .cm-placeholder-DOM, wenn placeholder=null', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    const view = new EditorView({
      state: stateFrom({ ...base, placeholder: null }),
      parent: ta.parentNode as HTMLElement,
    });
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    expect(view.dom.querySelector('.cm-placeholder')).toBeNull();
    view.destroy();
    ta.remove();
  });

  it('parst GFM-Strikethrough (~~...~~) als Strikethrough-Knoten', () => {
    const state = EditorState.create({ doc: '~~weg~~', extensions: buildExtensions(base) });
    let hasStrike = false;
    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name === 'Strikethrough') hasStrike = true;
      },
    });
    expect(hasStrike).toBe(true);
  });

  it('bindet History ein: eine Änderung ist per undo rücknehmbar', async () => {
    const { EditorState } = await import('@codemirror/state');
    const { EditorView } = await import('@codemirror/view');
    const { undo } = await import('@codemirror/commands');
    const { resolveOptions } = await import('../../options');

    const state = EditorState.create({
      doc: 'a',
      extensions: buildExtensions(resolveOptions({})),
    });
    const view = new EditorView({ state });
    view.dispatch({ changes: { from: 1, insert: 'b' } });
    expect(view.state.doc.toString()).toBe('ab');
    undo(view);
    expect(view.state.doc.toString()).toBe('a');
    view.destroy();
  });

  it('ruft den sink bei einer Doc-Änderung', () => {
    const calls: boolean[] = [];
    const ext = buildExtensions(resolveOptions({}), {
      onUpdate: (u) => calls.push(u.docChanged),
    });
    const view = new EditorView({ state: EditorState.create({ doc: '', extensions: ext }) });
    view.dispatch({ changes: { from: 0, insert: 'x' } });
    expect(calls.some(Boolean)).toBe(true);
    view.destroy();
  });
});

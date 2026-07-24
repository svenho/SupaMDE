import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { updateListenerExtension } from '../update-listener';

function makeView(ext: ReturnType<typeof updateListenerExtension>, doc = ''): EditorView {
  return new EditorView({ state: EditorState.create({ doc, extensions: [ext] }) });
}

describe('updateListenerExtension', () => {
  it('meldet docChanged bei einer Doc-Änderung', () => {
    const onUpdate = vi.fn();
    const view = makeView(updateListenerExtension({ onUpdate }));
    view.dispatch({ changes: { from: 0, insert: 'x' } });
    const call = onUpdate.mock.calls.at(-1)![0];
    expect(call.docChanged).toBe(true);
    expect(call.state.doc.toString()).toBe('x');
    view.destroy();
  });

  it('meldet selectionSet bei reiner Cursorbewegung', () => {
    const onUpdate = vi.fn();
    const view = makeView(updateListenerExtension({ onUpdate }), 'abc');
    onUpdate.mockClear();
    view.dispatch({ selection: { anchor: 2 } });
    const call = onUpdate.mock.calls.at(-1)![0];
    expect(call.selectionSet).toBe(true);
    expect(call.docChanged).toBe(false);
    view.destroy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { createToolbar } from '../toolbar';

function makeView(doc = ''): EditorView {
  return new EditorView({
    state: EditorState.create({ doc, extensions: [markdown({ extensions: GFM })] }),
  });
}

describe('createToolbar', () => {
  it('liefert null bei toolbar=false', () => {
    const view = makeView();
    expect(createToolbar(view, false, {})).toBeNull();
    view.destroy();
  });

  it('rendert Buttons und Separatoren', () => {
    const view = makeView();
    const toolbar = createToolbar(view, ['bold', '|', 'italic'], {})!;
    expect(toolbar.dom.querySelectorAll('button').length).toBe(2);
    expect(toolbar.dom.querySelectorAll('.supamde-separator').length).toBe(1);
    view.destroy();
  });

  it('Klick auf einen Built-in-Button verändert das Doc', () => {
    const view = makeView('text');
    view.dispatch({ selection: { anchor: 0, head: 4 } });
    const toolbar = createToolbar(view, ['bold'], {})!;
    const btn = toolbar.dom.querySelector('button')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.state.doc.toString()).toBe('**text**');
    view.destroy();
  });

  it('setzt .active für Aktiv-Zustand', () => {
    const view = makeView('**fett**');
    view.dispatch({ selection: { anchor: 3 } }); // Cursor im fetten Bereich
    const toolbar = createToolbar(view, ['bold'], {})!;
    toolbar.update(view.state);
    expect(toolbar.dom.querySelector('button')!.classList.contains('active')).toBe(true);
    view.destroy();
  });

  it('Custom-Button ruft action(editor)', () => {
    const view = makeView();
    const action = vi.fn();
    const editor = { marker: true };
    const toolbar = createToolbar(view, [{ name: 'foo', action, title: 'Foo' }], editor)!;
    toolbar.dom.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(action).toHaveBeenCalledWith(editor);
    view.destroy();
  });

  it('Custom-Button mit className rendert <i>', () => {
    const view = makeView();
    const toolbar = createToolbar(
      view,
      [{ name: 'foo', action: () => {}, className: 'fa fa-star', title: 'Foo' }],
      {},
    )!;
    expect(toolbar.dom.querySelector('button i.fa.fa-star')).not.toBeNull();
    view.destroy();
  });
});

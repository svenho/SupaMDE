import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createSideBySide } from '../preview';

function viewWith(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  return new EditorView({ state: EditorState.create({ doc }), parent });
}

describe('createSideBySide', () => {
  it('ist initial inaktiv und rendert erst bei toggle()', () => {
    const view = viewWith('# Hallo');
    const panel = createSideBySide(view, { render: (t) => `<rendered>${t}</rendered>` });
    expect(panel.isActive()).toBe(false);
    panel.toggle();
    expect(panel.isActive()).toBe(true);
    expect(panel.dom.innerHTML).toContain('# Hallo');
    view.destroy();
  });

  it('update() re-rendert nur bei aktivem Panel', () => {
    const view = viewWith('a');
    const panel = createSideBySide(view, { render: (t) => `R:${t}` });
    panel.update(EditorState.create({ doc: 'b' })); // inaktiv → No-op
    expect(panel.dom.innerHTML).toBe('');
    panel.toggle();
    panel.update(EditorState.create({ doc: 'c' }));
    expect(panel.dom.innerHTML).toBe('R:c');
    view.destroy();
  });

  it('previewClass wird auf das Panel gesetzt', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t, previewClass: ['prose', 'foo'] });
    expect(panel.dom.classList.contains('prose')).toBe(true);
    expect(panel.dom.classList.contains('foo')).toBe(true);
    view.destroy();
  });

  it('destroy() entfernt das Panel aus dem DOM', () => {
    const view = viewWith('x');
    const panel = createSideBySide(view, { render: (t) => t });
    panel.toggle();
    panel.destroy();
    expect(panel.dom.isConnected).toBe(false);
    view.destroy();
  });
});

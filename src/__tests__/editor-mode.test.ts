import { describe, it, expect, vi } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { SupaMDE } from '../index';

/** Baut eine SupaMDE-Instanz auf einer frischen Textarea im DOM. */
function makeEditor(value: string, options: Record<string, unknown> = {}) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  const editor = new SupaMDE({ element: textarea, toolbar: false, status: false, ...options });
  return {
    editor,
    cleanup: () => {
      editor.toTextArea();
      textarea.remove();
    },
  };
}

describe('SupaMDE — editorMode API', () => {
  it('startet im Modus "source", wenn nichts gesetzt ist', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    expect(editor.getEditorMode()).toBe('source');
    cleanup();
  });

  it('startet im Modus "live", wenn die Option gesetzt ist', () => {
    const { editor, cleanup } = makeEditor('**fett**', { editorMode: 'live' });
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });

  it('schaltet mit setEditorMode um', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    editor.setEditorMode('live');
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });

  it('wechselt mit toggleEditorMode hin und zurück', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    editor.toggleEditorMode();
    expect(editor.getEditorMode()).toBe('live');
    editor.toggleEditorMode();
    expect(editor.getEditorMode()).toBe('source');
    cleanup();
  });

  it('ist idempotent — setEditorMode auf den aktiven Modus dispatcht nicht', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    const dispatch = vi.spyOn(editor.codemirror, 'dispatch');
    editor.setEditorMode('source');
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
    cleanup();
  });

  it('blendet im Live-Modus inaktives Markup aus', () => {
    const { editor, cleanup } = makeEditor('**fett** x');
    editor.codemirror.dispatch({ selection: EditorSelection.single(9) });
    editor.setEditorMode('live');
    expect(editor.codemirror.contentDOM.textContent).toBe('fett x');
    cleanup();
  });

  it('erhält Dokument, Cursor und Historie über den Moduswechsel', async () => {
    const { undo } = await import('../commands/history');
    const { editor, cleanup } = makeEditor('a');
    editor.codemirror.dispatch({ changes: { from: 1, insert: 'b' } });
    editor.codemirror.dispatch({ selection: EditorSelection.single(1) });

    editor.setEditorMode('live');

    expect(editor.value()).toBe('ab');
    expect(editor.codemirror.state.selection.main.head).toBe(1);

    // Die Historie überlebt den reconfigure NACHWEISLICH: das vor dem Wechsel
    // eingefügte "b" lässt sich danach zurücknehmen. Ohne echtes undo() würde
    // dieser Test die Historie gar nicht prüfen.
    undo(editor.codemirror);
    expect(editor.value()).toBe('a');
    cleanup();
  });

  it('lässt den Dokumentinhalt beim Moduswechsel unangetastet', () => {
    const { editor, cleanup } = makeEditor('# Titel\n\n**fett**');
    editor.setEditorMode('live');
    expect(editor.value()).toBe('# Titel\n\n**fett**');
    editor.setEditorMode('source');
    expect(editor.value()).toBe('# Titel\n\n**fett**');
    cleanup();
  });
});

describe('SupaMDE — F10', () => {
  it('schaltet den Modus per F10 um', () => {
    const { editor, cleanup } = makeEditor('**fett**');
    const container = editor.codemirror.dom.closest('.supamde-container');
    expect(container).not.toBeNull();

    container!.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true }));
    expect(editor.getEditorMode()).toBe('live');
    cleanup();
  });
});

describe('SupaMDE — Commands im Live-Modus', () => {
  it('bold fügt ** ein und lässt sie sichtbar (Cursor steht im Knoten)', async () => {
    const { bold } = await import('../commands/inline');
    const { editor, cleanup } = makeEditor('Wort', { editorMode: 'live' });

    editor.codemirror.dispatch({ selection: EditorSelection.single(0, 4) });
    bold(editor.codemirror);

    expect(editor.value()).toBe('**Wort**');
    // Die Selektion berührt den neuen Knoten → Markup sichtbar.
    expect(editor.codemirror.contentDOM.textContent).toBe('**Wort**');
    cleanup();
  });

  it('bold bei leerer Selektion erzeugt **** — sichtbar, weil Lezer dort keinen Marker parst', async () => {
    const { bold } = await import('../commands/inline');
    const { editor, cleanup } = makeEditor('', { editorMode: 'live' });

    bold(editor.codemirror);

    expect(editor.value()).toBe('****');
    // Verifiziert: "****" ist eine HorizontalRule ohne Marker-Kinder — es gibt
    // nichts auszublenden. Ohne sichtbare Sternchen gäbe es nach dem Klick auf
    // "Fett" gar keine Rückmeldung.
    expect(editor.codemirror.contentDOM.textContent).toBe('****');
    cleanup();
  });
});

describe('SupaMDE — Statusbar zählt modusunabhängig', () => {
  it('zählt im Live-Modus dieselben Werte wie im Source-Modus', () => {
    // Spec-Zusage: Die Statusbar beschreibt das DOKUMENT, nicht die Ansicht.
    // Markup-Zeichen zählen daher in beiden Modi mit.
    const textarea = document.createElement('textarea');
    textarea.value = '**fett** und *kursiv*';
    document.body.appendChild(textarea);
    const editor = new SupaMDE({
      element: textarea,
      toolbar: false,
      status: ['lines', 'words'],
    });

    const before = editor.codemirror.dom
      .closest('.supamde-container')
      ?.querySelector('.supamde-statusbar')?.textContent;

    editor.setEditorMode('live');

    const after = editor.codemirror.dom
      .closest('.supamde-container')
      ?.querySelector('.supamde-statusbar')?.textContent;

    expect(after).toBe(before);
    editor.toTextArea();
    textarea.remove();
  });
});

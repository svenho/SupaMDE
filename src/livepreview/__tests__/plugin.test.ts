import { describe, it, expect } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { viewWith as baseViewWith, cleanup, atomicRangesOf } from '../../__tests__/helpers';
import { livePreviewExtension } from '..';

/** Kurzform: View mit Markdown-Setup UND der Live-Preview-Extension. */
function viewWith(doc: string, anchor = 0, head = anchor) {
  return baseViewWith(doc, [livePreviewExtension], anchor, head);
}

describe('livePreviewExtension — Dekorationen', () => {
  it('versteckt inaktives Markup im DOM', () => {
    const view = viewWith('**fett** x', 9);
    // Der sichtbare Text enthält die Sternchen nicht mehr.
    expect(view.contentDOM.textContent).toBe('fett x');
    cleanup(view);
  });

  it('zeigt das Markup, sobald der Cursor im Knoten steht', () => {
    const view = viewWith('**fett** x', 4);
    expect(view.contentDOM.textContent).toBe('**fett** x');
    cleanup(view);
  });

  it('aktualisiert die Darstellung bei einer Cursorbewegung', () => {
    const view = viewWith('**fett** x', 9);
    expect(view.contentDOM.textContent).toBe('fett x');
    view.dispatch({ selection: EditorSelection.single(4) });
    expect(view.contentDOM.textContent).toBe('**fett** x');
    cleanup(view);
  });

  it('lässt das Dokument unverändert — nur die Darstellung ändert sich', () => {
    const view = viewWith('**fett** x', 9);
    expect(view.state.doc.toString()).toBe('**fett** x');
    cleanup(view);
  });
});

describe('livePreviewExtension — atomicRanges', () => {
  it('meldet die versteckten Bereiche als atomar', () => {
    const view = viewWith('**fett** x', 9);
    expect(atomicRangesOf(view)).toEqual([
      { from: 0, to: 2 },
      { from: 6, to: 8 },
    ]);
    cleanup(view);
  });

  it('meldet keine atomaren Bereiche, wenn der Knoten aktiv ist', () => {
    const view = viewWith('**fett**', 4);
    expect(atomicRangesOf(view)).toEqual([]);
    cleanup(view);
  });

  it('überspringt einen inaktiven Marker bei der Cursor-Bewegung', () => {
    // "a **b** c" — Cursor am Ende (9), beide Knoten inaktiv.
    // Marker liegen bei [2,4] und [5,7]; verifiziert am realen CodeMirror.
    const view = viewWith('a **b** c', 9);

    // moveByChar ist die Methode, die atomicRanges auswertet. Bewusst NICHT
    // cursorCharLeft aus @codemirror/commands: das nimmt ohne echtes Layout
    // (jsdom) einen anderen Pfad und umgeht die atomaren Bereiche.
    expect(view.moveByChar(EditorSelection.cursor(7), false).head).toBe(5);
    cleanup(view);
  });

  it('bewegt den Cursor normal, wenn kein atomarer Bereich im Weg ist', () => {
    const view = viewWith('a **b** c', 9);
    expect(view.moveByChar(EditorSelection.cursor(8), false).head).toBe(7);
    cleanup(view);
  });
});

describe('livePreviewFor', () => {
  it('liefert für "source" eine leere Extension', async () => {
    const { livePreviewFor } = await import('..');
    expect(livePreviewFor('source')).toEqual([]);
  });

  it('liefert für "live" die aktive Extension', async () => {
    const { livePreviewFor, livePreviewExtension } = await import('..');
    expect(livePreviewFor('live')).toBe(livePreviewExtension);
  });
});

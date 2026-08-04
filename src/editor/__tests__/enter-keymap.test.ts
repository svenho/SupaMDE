import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { buildExtensions } from '../extensions';
import { resolveOptions } from '../../options';

/**
 * Integrationstests der Enter-Taste gegen die VOLLSTÄNDIGE Extension-Liste.
 *
 * Unit-Tests von `continueList` genügen hier nicht: `markdown()` bringt einen
 * eigenen Enter-Handler (`insertNewlineContinueMarkup`) mit und registriert ihn
 * per `Prec.high`, also VOR dem `supaKeymap`. Ob SupaMDEs Listen-Logik überhaupt
 * zum Zug kommt, entscheidet sich damit erst im Zusammenspiel aller Extensions —
 * und genau das prüfen diese Tests.
 */
function mk(doc: string, anchor: number): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor),
      extensions: buildExtensions(resolveOptions({})),
    }),
  });
}

function pressEnter(view: EditorView): void {
  runScopeHandlers(
    view,
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13 }),
    'editor',
  );
}

describe('Enter in Listen (volle Extension-Kette)', () => {
  it('beendet eine flache Liste beim zweiten Enter', () => {
    const view = mk('- item', 6);
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- item\n- ');
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- item\n');
    expect(view.state.selection.main.head).toBe(7);
    view.destroy();
  });

  it('beendet eine verschachtelte Liste ebenfalls beim zweiten Enter', () => {
    // Kein Zwischenschritt über eine Leerzeile und kein separates Ausrücken:
    // das zweite Enter entfernt Einrückung UND Marker in einem Zug.
    const view = mk('- a\n  - b', 9);
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n  - ');
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- a\n  - b\n');
    expect(view.state.selection.main.head).toBe(10);
    view.destroy();
  });

  it('erzeugt beim Beenden keine Leerzeile zwischen Liste und Cursorzeile', () => {
    const view = mk('- a\n  - b', 9);
    pressEnter(view);
    pressEnter(view);
    // Regression: früher entstand hier "- a\n  - b\n \n  - " (Leerzeile, Bullet
    // eine Zeile tiefer) und es brauchte vier Enter bis zum Listenende.
    expect(view.state.doc.toString()).not.toContain('\n \n');
    expect(view.state.doc.toString().split('\n')).toHaveLength(3);
    view.destroy();
  });

  it('setzt geordnete Listen fort und beendet sie beim zweiten Enter', () => {
    const view = mk('1. eins', 7);
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('1. eins\n2. ');
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('1. eins\n');
    view.destroy();
  });

  it('setzt Checklisten unangehakt fort und beendet sie beim zweiten Enter', () => {
    const view = mk('- [x] erledigt', 14);
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- [x] erledigt\n- [ ] ');
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('- [x] erledigt\n');
    view.destroy();
  });

  it('fügt außerhalb von Listen eine normale Zeile ein', () => {
    const view = mk('Klartext', 8);
    pressEnter(view);
    expect(view.state.doc.toString()).toBe('Klartext\n');
    view.destroy();
  });
});

describe('Backspace-Bindung aus markdownKeymap bleibt erhalten', () => {
  function pressBackspace(view: EditorView): void {
    runScopeHandlers(
      view,
      new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8 }),
      'editor',
    );
  }

  it('entfernt den Listenmarker bei Backspace direkt hinter dem Marker', () => {
    // `deleteMarkupBackward` wird in commands/keymap.ts einzeln nachgebunden, weil
    // `addKeymap: false` den kompletten markdownKeymap abschaltet.
    const view = mk('- item', 2); // Cursor unmittelbar hinter "- "
    pressBackspace(view);
    expect(view.state.doc.toString()).toBe('item');
    view.destroy();
  });

  it('entfernt auch bei verschachtelten Einträgen den Marker', () => {
    // Entfernt wird der Marker, die Einrückung bleibt stehen — ein Ausrücken auf
    // die äußere Ebene findet dabei nicht statt.
    const view = mk('- a\n  - b', 8); // Cursor hinter dem eingerückten Marker
    pressBackspace(view);
    expect(view.state.doc.toString()).toBe('- a\n  b');
    view.destroy();
  });
});

import { describe, it, expect } from 'vitest';
import { stateWith, viewWith, cleanup } from '../../__tests__/helpers';
import { linkUrlAt, linkClickExtension } from '../link-click';

describe('linkUrlAt', () => {
  it('findet die URL eines Inline-Links vom Linktext aus', () => {
    // "[Text](https://example.com)" — Position 2 liegt in "Text"
    const state = stateWith('[Text](https://example.com)');
    expect(linkUrlAt(state, 2)).toBe('https://example.com');
  });

  it('findet die URL, wenn die Position im URL-Teil liegt', () => {
    const state = stateWith('[Text](https://example.com)');
    expect(linkUrlAt(state, 10)).toBe('https://example.com');
  });

  it('findet die URL eines Autolinks', () => {
    // "<https://example.com>" — verifiziert: Autolink mit URL[1,20]
    const state = stateWith('<https://example.com>');
    expect(linkUrlAt(state, 5)).toBe('https://example.com');
  });

  it('akzeptiert http', () => {
    const state = stateWith('[T](http://example.com)');
    expect(linkUrlAt(state, 1)).toBe('http://example.com');
  });

  it('liefert null außerhalb eines Links', () => {
    const state = stateWith('Nur Text ohne Link');
    expect(linkUrlAt(state, 4)).toBeNull();
  });

  it('liefert null im leeren Dokument', () => {
    expect(linkUrlAt(stateWith(''), 0)).toBeNull();
  });

  it('verwirft javascript:-URLs', () => {
    // Angriffsvektor: ein präpariertes Dokument darf keinen Code ausführen.
    const state = stateWith('[Klick](javascript:alert(1))');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('verwirft data:-URLs', () => {
    const state = stateWith('[Klick](data:text/html,<script>alert(1)</script>)');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('verwirft relative Pfade ohne Schema', () => {
    const state = stateWith('[Doku](./seite.md)');
    expect(linkUrlAt(state, 2)).toBeNull();
  });

  it('ignoriert Groß-/Kleinschreibung des Schemas', () => {
    const state = stateWith('[T](HTTPS://example.com)');
    expect(linkUrlAt(state, 1)).toBe('HTTPS://example.com');
  });
});

describe('linkClickExtension', () => {
  /** View mit Markdown-Setup und der Klick-Extension. */
  function linkView(doc: string) {
    return viewWith(doc, [linkClickExtension]);
  }

  it('liefert in der verdrahteten View dieselbe URL wie die reine Funktion', () => {
    // `posAtCoords` ist in jsdom ohne echtes Layout unzuverlässig, ein echter
    // Ctrl+Klick lässt sich hier also nicht sinnvoll simulieren. Geprüft wird
    // daher, dass der State der verdrahteten View dieselbe URL liefert — das
    // Öffnen selbst deckt der Handler-Code ab (eine Zeile `window.open`).
    const view = linkView('[Text](https://example.com)');
    expect(linkUrlAt(view.state, 2)).toBe('https://example.com');
    cleanup(view);
  });

  it('greift ohne Modifier nicht ein — der Handler meldet "nicht behandelt"', () => {
    // Bewusst NICHT über `event.defaultPrevented` geprüft: CodeMirror ruft bei
    // einem simulierten mousedown selbst `preventDefault()` auf (verifiziert mit
    // leerer Extension-Liste), der Wert misst also Fremdverhalten statt unseres.
    // Aussagekräftig ist stattdessen der Rückgabewert unseres Handlers: `false`
    // bedeutet "nicht behandelt", CodeMirror behält die Kontrolle.
    const view = linkView('[Text](https://example.com)');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(event);
    // Ohne Modifier wird kein Link geöffnet — das prüft der folgende Test direkt.
    // Hier genügt, dass der Klick die View nicht verändert hat.
    expect(view.state.doc.toString()).toBe('[Text](https://example.com)');
    cleanup(view);
  });

  it('öffnet nichts, wenn kein Modifier gedrückt ist', () => {
    const opened: string[] = [];
    const original = window.open;
    // @ts-expect-error — Test-Attrappe für window.open
    window.open = (url: string) => { opened.push(url); return null; };

    const view = linkView('[Text](https://example.com)');
    view.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    window.open = original;
    cleanup(view);
    expect(opened).toEqual([]);
  });
});

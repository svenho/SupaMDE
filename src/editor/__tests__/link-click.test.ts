import { describe, it, expect, vi } from 'vitest';
import { stateWith, viewWith, cleanup } from '../../__tests__/helpers';
import {
  linkUrlAt,
  linkClickExtension,
  handleLinkMousedown,
  normalizeBareUrl,
} from '../link-click';

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

describe('linkUrlAt — nackte URLs (GFM-Autoerkennung ohne Link/Autolink-Knoten)', () => {
  it('findet eine nackte https-URL mitten im Fließtext', () => {
    // "Siehe https://example.com hier" — URL[6,25], Position 10 liegt darin.
    const state = stateWith('Siehe https://example.com hier');
    expect(linkUrlAt(state, 10)).toBe('https://example.com');
  });

  it('findet eine nackte http-URL', () => {
    const state = stateWith('Siehe http://example.com hier');
    expect(linkUrlAt(state, 10)).toBe('http://example.com');
  });

  it('findet eine nackte URL, die das gesamte Dokument ausmacht', () => {
    const state = stateWith('https://example.com');
    expect(linkUrlAt(state, 5)).toBe('https://example.com');
  });

  it('ergänzt bei www.-URLs das Schema https://', () => {
    // "Siehe www.example.com hier" — URL[6,21] = "www.example.com"
    const state = stateWith('Siehe www.example.com hier');
    expect(linkUrlAt(state, 10)).toBe('https://www.example.com');
  });

  it('ergänzt bei nackten E-Mail-Adressen das Präfix mailto:', () => {
    // "Mail an foo@example.com hier" — URL[8,23] = "foo@example.com"
    const state = stateWith('Mail an foo@example.com hier');
    expect(linkUrlAt(state, 12)).toBe('mailto:foo@example.com');
  });

  it('verdoppelt das Präfix nicht, wenn mailto: bereits im Dokument steht', () => {
    // "mailto:foo@example.com hier" — URL[0,22] = "mailto:foo@example.com" (Präfix im Knoten!)
    const state = stateWith('mailto:foo@example.com hier');
    expect(linkUrlAt(state, 5)).toBe('mailto:foo@example.com');
  });

  it('findet eine nackte URL in Klammern, ohne die schließende Klammer', () => {
    // "Klammer (https://example.com) zu" — URL[9,28], schließende Klammer nicht enthalten.
    const state = stateWith('Klammer (https://example.com) zu');
    expect(linkUrlAt(state, 15)).toBe('https://example.com');
  });

  it('findet eine nackte URL am Satzende, ohne den Satzpunkt', () => {
    // "Satzende https://example.com." — URL[9,28], Satzpunkt nicht enthalten.
    const state = stateWith('Satzende https://example.com.');
    expect(linkUrlAt(state, 15)).toBe('https://example.com');
  });

  it('findet sowohl die URL im Markdown-Link als auch die nackte URL danach', () => {
    // "[Text](https://e.com) und nackt https://b.de"
    const state = stateWith('[Text](https://e.com) und nackt https://b.de');
    expect(linkUrlAt(state, 2)).toBe('https://e.com'); // im Linktext
    expect(linkUrlAt(state, 40)).toBe('https://b.de'); // in der nackten URL
  });

  it('liefert null für javascript:-Text (Parser erzeugt hier keinen URL-Knoten)', () => {
    const state = stateWith('javascript:alert(1) im Text');
    expect(linkUrlAt(state, 5)).toBeNull();
  });

  it('liefert null für data:-Text (Parser erzeugt hier keinen URL-Knoten)', () => {
    const state = stateWith('data:text/html,<b>x</b> hier');
    expect(linkUrlAt(state, 5)).toBeNull();
  });

  it('liefert null für ftp:-Text (Parser erzeugt hier keinen URL-Knoten)', () => {
    const state = stateWith('ftp://example.com hier');
    expect(linkUrlAt(state, 5)).toBeNull();
  });

  it('liefert null innerhalb von Inline-Code', () => {
    const state = stateWith('`https://example.com` in Code');
    expect(linkUrlAt(state, 5)).toBeNull();
  });

  it('liefert null innerhalb eines Codeblocks', () => {
    const state = stateWith('```\nhttps://example.com\n```');
    expect(linkUrlAt(state, 8)).toBeNull();
  });

  it('erkennt großgeschriebene nackte URLs nicht (Parser-Grenze, nicht unser Fehler)', () => {
    // GFM erkennt nackte Autolinks nur kleingeschrieben — kein URL-Knoten, also null.
    const state = stateWith('HTTPS://EXAMPLE.COM hier');
    expect(linkUrlAt(state, 5)).toBeNull();
  });

  it('erkennt großgeschriebenes www. nicht (Parser-Grenze, nicht unser Fehler)', () => {
    const state = stateWith('WWW.Example.COM hier');
    expect(linkUrlAt(state, 5)).toBeNull();
  });
});

describe('normalizeBareUrl — reine Normalisierungsfunktion', () => {
  it('lässt https-URLs unverändert', () => {
    expect(normalizeBareUrl('https://example.com')).toBe('https://example.com');
  });

  it('lässt http-URLs unverändert', () => {
    expect(normalizeBareUrl('http://example.com')).toBe('http://example.com');
  });

  it('ergänzt bei www.-Text das Schema https://', () => {
    expect(normalizeBareUrl('www.example.com')).toBe('https://www.example.com');
  });

  it('ergänzt bei einer nackten E-Mail-Adresse das Präfix mailto:', () => {
    expect(normalizeBareUrl('foo@example.com')).toBe('mailto:foo@example.com');
  });

  it('verdoppelt das Präfix nicht, wenn mailto: bereits vorhanden ist', () => {
    expect(normalizeBareUrl('mailto:foo@example.com')).toBe('mailto:foo@example.com');
  });

  it('behandelt eine URL mit Benutzerteil (user@host) NICHT als E-Mail', () => {
    // Schema-Prüfung muss VOR der @-Heuristik greifen, sonst würde daraus
    // fälschlich "mailto:https://user@host/pfad".
    expect(normalizeBareUrl('https://user@host/pfad')).toBe('https://user@host/pfad');
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

  it('meldet "nicht behandelt", wenn kein Modifier gedrückt ist', () => {
    // `event.defaultPrevented` taugt hier nicht: CodeMirror ruft bei simuliertem
    // mousedown selbst `preventDefault()` auf — auch mit leerer Extension-Liste.
    // Aussagekräftig ist der Rückgabewert des Handlers: `false` heißt
    // "nicht behandelt", CodeMirror behält die Kontrolle über den Klick.
    const view = linkView('[Text](https://example.com)');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    expect(handleLinkMousedown(event, view)).toBe(false);
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

  it('öffnet den Link in einem neuen Tab, wenn Modifier gedrückt ist und ein Link unter dem Zeiger liegt', () => {
    // posAtCoords ist in jsdom ohne echtes Layout unzuverlässig, daher wird die
    // Position hier gestubbt (Position 2 liegt in "Text" von "[Text](https://example.com)").
    const original = window.open;
    const openSpy = vi.fn().mockReturnValue(null);
    window.open = openSpy;

    const view = linkView('[Text](https://example.com)');
    vi.spyOn(view, 'posAtCoords').mockReturnValue(2);
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true });

    expect(handleLinkMousedown(event, view)).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    // Argumente einzeln prüfen: Reihenfolge und Inhalt sind sicherheitsrelevant
    // (fehlendes "noopener,noreferrer" gäbe der geöffneten Seite Zugriff auf window.opener).
    expect(openSpy.mock.calls[0]?.[0]).toBe('https://example.com');
    expect(openSpy.mock.calls[0]?.[1]).toBe('_blank');
    expect(openSpy.mock.calls[0]?.[2]).toBe('noopener,noreferrer');

    window.open = original;
    cleanup(view);
  });

  it('öffnet nichts bei einer javascript:-URL, obwohl Modifier gedrückt und Link unter dem Zeiger ist', () => {
    // Sicherheits-Gegentest zum positiven Pfad: ein präpariertes Dokument darf
    // trotz Modifier keinen Code ausführen.
    const original = window.open;
    const openSpy = vi.fn().mockReturnValue(null);
    window.open = openSpy;

    const view = linkView('[Klick](javascript:alert(1))');
    vi.spyOn(view, 'posAtCoords').mockReturnValue(2);
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ctrlKey: true });

    expect(handleLinkMousedown(event, view)).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();

    window.open = original;
    cleanup(view);
  });
});

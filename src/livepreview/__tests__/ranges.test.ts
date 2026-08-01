import { describe, it, expect } from 'vitest';
import { stateWith, stateWithCursors, whole } from '../../__tests__/helpers';
import { computeHiddenRanges } from '../ranges';

/** Bequemer Vergleich: liefert die ausgeblendeten Textstücke statt Zahlen. */
function hiddenTexts(doc: string, anchor = 0, head = anchor): string[] {
  const state = stateWith(doc, anchor, head);
  return computeHiddenRanges(state, whole(state)).map((r) => state.doc.sliceString(r.from, r.to));
}

describe('computeHiddenRanges — inaktive Knoten', () => {
  it('blendet ** bei Fett aus, wenn der Cursor außerhalb steht', () => {
    // Doc: "**fett** x", Cursor auf Position 9 (das "x") → außerhalb
    expect(hiddenTexts('**fett** x', 9)).toEqual(['**', '**']);
  });

  it('blendet * bei Kursiv aus, wenn der Cursor außerhalb steht', () => {
    expect(hiddenTexts('*kursiv* x', 9)).toEqual(['*', '*']);
  });

  it('blendet ~~ bei Durchgestrichen aus (StrikethroughMark, nicht EmphasisMark)', () => {
    expect(hiddenTexts('~~weg~~ x', 8)).toEqual(['~~', '~~']);
  });

  it('blendet ` bei Inline-Code aus', () => {
    expect(hiddenTexts('`code` x', 7)).toEqual(['`', '`']);
  });

  it('blendet "# " bei Überschrift inklusive Leerzeichen aus', () => {
    // Cursor in Zeile 2, also außerhalb der Überschrift
    expect(hiddenTexts('# Titel\nx', 8)).toEqual(['# ']);
  });

  it('blendet "> " bei Zitat inklusive Leerzeichen aus', () => {
    // ACHTUNG Lazy Continuation: "> Zitat\nx" ergibt Blockquote[0,9] — die
    // Folgezeile gehört noch zum Zitat, Cursor 8 läge INNERHALB. Die Leerzeile
    // beendet den Blockquote (verifiziert: Blockquote[0,7], Paragraph[9,10]),
    // erst damit steht Cursor 9 außerhalb.
    expect(hiddenTexts('> Zitat\n\nx', 9)).toEqual(['> ']);
  });

  it('blendet die Marker ALLER Zeilen eines mehrzeiligen Zitats aus', () => {
    // "> a\n> b\n\nx" → QuoteMark[0,1] und QuoteMark[4,5], beide am selben Parent.
    expect(hiddenTexts('> a\n> b\n\nx', 9)).toEqual(['> ', '> ']);
  });
});

describe('computeHiddenRanges — aktive Knoten', () => {
  it('blendet NICHTS aus, wenn der Cursor im Knoten steht', () => {
    // Doc: "**fett**", Cursor auf 4 (mitten in "fett")
    expect(hiddenTexts('**fett**', 4)).toEqual([]);
  });

  it('behandelt den Knoten als aktiv, wenn der Cursor genau an seiner linken Grenze steht', () => {
    expect(hiddenTexts('**fett**', 0)).toEqual([]);
  });

  it('behandelt den Knoten als aktiv, wenn der Cursor genau an seiner rechten Grenze steht', () => {
    expect(hiddenTexts('**fett**', 8)).toEqual([]);
  });

  it('macht nur den Knoten sichtbar, in dem der Cursor steht (knoten-genau)', () => {
    // "Ein **fett** und *kursiv*." — Cursor in "fett" (Position 8)
    // → ** sichtbar, * bleibt versteckt
    expect(hiddenTexts('Ein **fett** und *kursiv*.', 8)).toEqual(['*', '*']);
  });
});

describe('computeHiddenRanges — Selektion', () => {
  it('macht das Markup aller von der Selektion berührten Knoten sichtbar', () => {
    // Selektion 0..26 umfasst beide Knoten → nichts versteckt
    expect(hiddenTexts('Ein **fett** und *kursiv*.', 0, 26)).toEqual([]);
  });

  it('berücksichtigt mehrere Cursor (Multi-Selection)', () => {
    // stateWithCursors setzt `allowMultipleSelections` — ohne dieses Facet
    // verwirft CM6 den zweiten Cursor still und der Test misst nichts.
    const doc = '**a** **b** **c**';
    // Cursor in "a" (Position 2) UND in "c" (Position 14)
    const state = stateWithCursors(doc, [2, 14]);
    expect(state.selection.ranges).toHaveLength(2); // Absicherung gegen stilles Verwerfen

    const texts = computeHiddenRanges(state, whole(state)).map((r) =>
      state.doc.sliceString(r.from, r.to),
    );
    // Nur die Marker um "b" bleiben versteckt
    expect(texts).toEqual(['**', '**']);
  });

  it('macht bei einem Cursor in EINER Zitatzeile alle Zitat-Marker sichtbar', () => {
    // Gegenstück zum Ausblende-Test: Cursor auf Position 2 (in "a").
    expect(hiddenTexts('> a\n> b\n\nx', 2)).toEqual([]);
  });
});

describe('computeHiddenRanges — Randfälle', () => {
  it('liefert für ein leeres Dokument keine Bereiche', () => {
    expect(hiddenTexts('')).toEqual([]);
  });

  it('liefert für "****" keine Bereiche — Lezer parst das als HorizontalRule', () => {
    // Am Parser verifiziert: "****" → HorizontalRule ohne Marker-Kinder.
    // Folge: nach bold() mit leerer Selektion bleiben die Sternchen sichtbar.
    expect(hiddenTexts('****', 2)).toEqual([]);
  });

  it('läuft bei einer Zeile aus nur "#" nicht in die Folgezeile', () => {
    // "#\nText" — HeaderMark[0,1], danach direkt Zeilenende.
    // Die Leerzeichen-Erweiterung darf das \n NICHT verschlucken.
    const state = stateWith('#\nText', 4);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([{ from: 0, to: 1 }]);
  });

  it('läuft bei einer Zeile aus nur ">" nicht in die Folgezeile', () => {
    const state = stateWith('>\nText', 4);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([{ from: 0, to: 1 }]);
  });

  it('blendet den schließenden HeaderMark bei "# Titel #" mit aus', () => {
    // Verifiziert: HeaderMark[0,1] und HeaderMark[8,9].
    // Der schließende erweitert nach LINKS über das Leerzeichen (Position 7).
    const state = stateWith('# Titel #\nx', 10);
    const ranges = computeHiddenRanges(state, whole(state));
    expect(ranges).toEqual([
      { from: 0, to: 2 }, // "# "
      { from: 7, to: 9 }, // " #"
    ]);
  });

  it('nimmt keine feste Markerbreite an (` ist 1, ~~ ist 2 Zeichen)', () => {
    expect(hiddenTexts('`a` ~~b~~ x', 10)).toEqual(['`', '`', '~~', '~~']);
  });

  it('behandelt verschachtelte Knoten unabhängig', () => {
    // "**a *b* c**" — Cursor in "b" (Position 5) → BEIDE Ebenen aktiv
    expect(hiddenTexts('**a *b* c**', 5)).toEqual([]);
  });

  it('betrachtet nur den übergebenen sichtbaren Bereich', () => {
    // "**a** **b**" — Cursor ans Dokumentende (11), also außerhalb beider Knoten.
    // Sichtbar ist nur 0..5, daher darf der zweite Knoten keine Bereiche liefern.
    const state = stateWith('**a** **b**', 11);
    const ranges = computeHiddenRanges(state, [{ from: 0, to: 5 }]);
    expect(ranges).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
    ]);
  });
});

describe('computeHiddenRanges — konfigurierbare Marker-Mengen', () => {
  it('blendet nur die Marker aus den übergebenen Mengen aus', () => {
    // Nur Inline-Code, keine Emphasis: die ** bleiben stehen.
    const state = stateWith('**a** `b` x', 10);
    const ranges = computeHiddenRanges(state, whole(state), {
      inline: new Set(['CodeMark']),
      block: new Set(),
    });
    expect(ranges.map((r) => state.doc.sliceString(r.from, r.to))).toEqual(['`', '`']);
  });

  it('liefert bei leeren Mengen gar nichts', () => {
    const state = stateWith('**a** # b', 9);
    expect(computeHiddenRanges(state, whole(state), { inline: new Set(), block: new Set() })).toEqual(
      [],
    );
  });

  it('nutzt ohne dritten Parameter die Default-Mengen', () => {
    expect(hiddenTexts('**fett** x', 9)).toEqual(['**', '**']);
  });
});

describe('computeHiddenRanges — Rückgabe-Vertrag', () => {
  it('liefert die Bereiche nach from aufsteigend sortiert', () => {
    const state = stateWith('**a** *b* ~~c~~ `d` x', 20);
    const ranges = computeHiddenRanges(state, whole(state));
    const froms = ranges.map((r) => r.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
  });

  it('liefert überlappungsfreie Bereiche', () => {
    const state = stateWith('**a** *b* ~~c~~ `d` k', 20);
    const ranges = computeHiddenRanges(state, whole(state));
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.from).toBeGreaterThanOrEqual(ranges[i - 1]!.to);
    }
  });
});

import { StateEffect, StateField, type EditorState } from '@codemirror/state';

/** Der aktuelle Bereich eines offenen Platzhalters im Dokument. */
export interface PlaceholderRange {
  from: number;
  to: number;
}

/** Nimmt einen neuen Platzhalter unter `id` in die Verfolgung auf. */
export const addPlaceholder = StateEffect.define<{ id: number; from: number; to: number }>();

/** Nimmt den Platzhalter mit dieser `id` wieder heraus. */
export const removePlaceholder = StateEffect.define<number>();

/**
 * Hält die offenen Platzhalter und mappt sie bei JEDER Transaktion durch
 * `tr.changes`. Bewusst ein StateField und kein Instanzfeld mit gemerkten
 * Zahlen: Genau daran scheiterte easyMDE — dort wurde das fertige Bild
 * nachträglich am dann-aktuellen Cursor eingefügt, sodass es bei Weitertippen
 * an falscher Stelle landete.
 */
export const uploadPlaceholderField = StateField.define<Map<number, PlaceholderRange>>({
  create() {
    return new Map();
  },

  update(value, tr) {
    let next = value;

    if (tr.docChanged && next.size > 0) {
      const gemappt = new Map<number, PlaceholderRange>();
      for (const [id, range] of next) {
        // `assoc: +1` für `from`, `-1` für `to` — der Bereich SCHRUMPFT an
        // beiden Grenzen. Text, der genau davor oder genau dahinter eingefügt
        // wird, bleibt draußen; sonst verschluckte ihn die spätere Ersetzung
        // durch das fertige Bild. Am realen CM6 verifiziert: nur diese
        // Kombination hält beide Grenzen dicht (`-1`/`+1` tut das Gegenteil).
        const from = tr.changes.mapPos(range.from, 1);
        const to = tr.changes.mapPos(range.to, -1);
        // Auf Länge 0 zusammengefallen heißt: der Nutzer hat den Platzhalter
        // gelöscht (oder `setValue()` hat das Dokument ersetzt). Dann ist der
        // Eintrag hinfällig — das Ergebnis darf nirgendwo mehr landen.
        if (to > from) gemappt.set(id, { from, to });
      }
      next = gemappt;
    }

    for (const effect of tr.effects) {
      if (effect.is(addPlaceholder)) {
        const kopie = new Map(next);
        kopie.set(effect.value.id, { from: effect.value.from, to: effect.value.to });
        next = kopie;
      } else if (effect.is(removePlaceholder)) {
        if (next.has(effect.value)) {
          const kopie = new Map(next);
          kopie.delete(effect.value);
          next = kopie;
        }
      }
    }

    return next;
  },
});

/**
 * Der AKTUELLE Bereich eines Platzhalters, oder `null`, wenn er nicht mehr
 * existiert. Die einzige erlaubte Quelle für die Ersetzungsposition.
 */
export function placeholderRange(state: EditorState, id: number): PlaceholderRange | null {
  return state.field(uploadPlaceholderField, false)?.get(id) ?? null;
}

/**
 * Erzeugt eine unabhängige ID-Quelle. Bewusst eine Factory statt eines
 * modul-globalen Zählers: Der wäre gemeinsamer Zustand über alle Instanzen und
 * alle Testdateien hinweg und machte jeden Test auf eine konkrete ID von der
 * Ausführungsreihenfolge abhängig. Eindeutigkeit ist nur PRO View nötig — die
 * IDs sind Schlüssel in der Map genau eines `uploadPlaceholderField`.
 */
export function createIdSource(): () => number {
  let zähler = 0;
  return () => {
    zähler += 1;
    return zähler;
  };
}

import { Facet } from '@codemirror/state';
import { createTranslator, type Translator } from './translator';

/** Englischer Default — stabil, damit `combine` ohne Provider stets dasselbe Objekt liefert. */
const defaultTranslator = createTranslator();

/**
 * Der Translator im Editor-State. Commands sind reine `(view) => boolean`-
 * Funktionen ohne Zugriff auf die SupaMDE-Instanz; die Facet ist der
 * idiomatische CM6-Weg, ihnen Konfiguration mitzugeben. Ohne Provider (z. B. in
 * Unit-Tests ohne Instanz) gilt Englisch.
 */
export const translatorFacet = Facet.define<Translator, Translator>({
  combine: (values) => values[0] ?? defaultTranslator,
});

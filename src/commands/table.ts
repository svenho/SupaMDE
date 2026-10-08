import type { SupaCommand } from './types';
import { translatorFacet } from '../i18n/facet';

/**
 * Fügt ein GFM-Tabellengerüst (Header, Trennzeile, eine Datenzeile) am Cursor ein.
 * Die Spaltenköpfe kommen aus dem Translator im State — ohne Provider englisch,
 * damit der Command auch ohne SupaMDE-Instanz läuft.
 */
export const table: SupaCommand = (view) => {
  const translator = view.state.facet(translatorFacet);
  const column1 = translator.t('table.column', { n: '1' });
  const column2 = translator.t('table.column', { n: '2' });
  const skeleton = `| ${column1} | ${column2} |\n| --- | --- |\n|  |  |\n`;
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: skeleton },
    selection: { anchor: sel.from + skeleton.length },
  });
  return true;
};

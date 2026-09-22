import { describe, it, expect } from 'vitest';
import {
  mountEditor,
  registriereCleanup,
  panelOf,
  anteil,
  scrolleAufAnteil,
  naechsterFrame,
  langesDokument,
} from './helpers';

const merke = registriereCleanup();

/**
 * Mount mit aktiver Vorschau und gesetztem Layout.
 *
 * Zusätzlich zu setSideBySide(true) auch setFullScreen(true): Eine
 * Höhenbegrenzung existiert nur unter .supamde-fullscreen
 * (src/ui/fullscreen.css) — src/ui/preview.css setzt keine. Ohne Fullscreen
 * wächst der Editor mit dem Dokument mit (height: auto), scrollHeight ===
 * clientHeight bleibt, und es gibt strukturell nichts zu synchronisieren.
 * Gemessen (langes Dokument, beide Seiten):
 *   ohne Fullscreen: scroller 4820/4820, panel 4820/4820 -> nichts scrollbar
 *   mit  Fullscreen: scroller 4820/804,  panel 3648/804  -> beide scrollbar
 * Das deckt sich mit dem Produkt: die Default-Toolbar bietet für diese
 * Ansicht nur den kombinierten preview-fullscreen-Button (F8) an, der
 * togglePreviewFullScreen() (src/index.ts:355-358) ruft und Side-by-Side
 * und Fullscreen gemeinsam schaltet. Reines Side-by-Side ohne Fullscreen
 * ist keine Konstellation, die das Produkt so anbietet.
 */
async function mitVorschau(text: string) {
  const m = merke(await mountEditor({ initialValue: text }));
  m.editor.setSideBySide(true);
  m.editor.setFullScreen(true);
  // Die Vorschau rendert per innerHTML — erst danach stehen ihre Höhen.
  await naechsterFrame();
  return { m, panel: panelOf(m) };
}

describe('Scroll-Sync mit echten Höhen', () => {
  it('zieht die Vorschau mit, wenn der Editor scrollt', async () => {
    const { m, panel } = await mitVorschau(langesDokument());

    // Echte Höhen — in jsdom wären beide 0 und der Test bedeutungslos.
    expect(m.scroller.scrollHeight).toBeGreaterThan(m.scroller.clientHeight);
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);

    await scrolleAufAnteil(m.scroller, 0.5);

    expect(anteil(panel)).toBeCloseTo(0.5, 1);
  });

  it('zieht den Editor mit, wenn die Vorschau scrollt', async () => {
    const { m, panel } = await mitVorschau(langesDokument());

    await scrolleAufAnteil(panel, 0.25);

    expect(anteil(m.scroller)).toBeCloseTo(0.25, 1);
  });

  it('schaukelt sich nicht auf und verschluckt den nächsten Nutzer-Scroll nicht', async () => {
    // Der Daseinszweck von scheduleGuardReset in src/ui/preview.ts: nach dem
    // Sync muss das Guard-Flag im nächsten Frame wieder frei sein, sonst
    // ginge der unmittelbar folgende echte Nutzer-Scroll als Echo verloren.
    const { m, panel } = await mitVorschau(langesDokument());

    await scrolleAufAnteil(m.scroller, 0.5);
    expect(anteil(panel)).toBeCloseTo(0.5, 1);

    // Direkt danach ein zweiter echter Scroll: er MUSS ankommen.
    await scrolleAufAnteil(m.scroller, 0.8);
    expect(anteil(panel)).toBeCloseTo(0.8, 1);
  });

  it('bleibt ruhig, wenn das Dokument kürzer als der Viewport ist', async () => {
    // Randfall denom === 0 in src/ui/preview.ts: kein NaN, kein Sprung.
    const { m, panel } = await mitVorschau('Kurz.');

    expect(m.scroller.scrollHeight).toBeLessThanOrEqual(m.scroller.clientHeight + 1);

    // Nichts zu scrollen — der Handler darf trotzdem nicht NaN schreiben.
    await scrolleAufAnteil(m.scroller, 0.5);

    expect(Number.isNaN(panel.scrollTop)).toBe(false);
    expect(panel.scrollTop).toBe(0);
  });
});

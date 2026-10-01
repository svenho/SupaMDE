import { describe, it, expect } from 'vitest';
import {
  mountEditor,
  registriereCleanup,
  panelOf,
  editorRowOf,
  langesDokument,
} from './helpers';

const merke = registriereCleanup();

describe('Fullscreen-Geometrie', () => {
  it('spannt den Container auf Viewport-Größe', async () => {
    const m = merke(await mountEditor());

    const vorher = m.container.getBoundingClientRect();
    expect(vorher.height).toBeLessThan(window.innerHeight);

    m.editor.setFullScreen(true);

    const nachher = m.container.getBoundingClientRect();
    expect(Math.round(nachher.width)).toBe(window.innerWidth);
    expect(Math.round(nachher.height)).toBe(window.innerHeight);
  });

  it('hält die Höhenkette: langes Dokument scrollt innen, statt den Viewport zu sprengen', async () => {
    // Die Regression aus 11e4f9d. Die drei ineinandergreifenden Flex-Regeln in
    // src/ui/fullscreen.css sind nur mit echtem Layout prüfbar — in jsdom sind
    // sämtliche Höhen 0.
    const m = merke(await mountEditor({ initialValue: langesDokument() }));

    m.editor.setFullScreen(true);

    const rect = m.container.getBoundingClientRect();
    expect(Math.round(rect.height)).toBe(window.innerHeight);

    // Der Scroller muss innen überlaufen — genau das ist "scrollt innen".
    expect(m.scroller.scrollHeight).toBeGreaterThan(m.scroller.clientHeight);

    // Und der Body darf dabei NICHT mitscrollen.
    expect(document.body.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1);
  });

  it('sperrt den body-Scroll und gibt ihn wieder frei', async () => {
    const m = merke(await mountEditor({ initialValue: langesDokument() }));

    expect(document.body.style.overflow).not.toBe('hidden');
    m.editor.setFullScreen(true);
    expect(document.body.style.overflow).toBe('hidden');
    m.editor.setFullScreen(false);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Side-by-Side-Aufteilung', () => {
  it('teilt die Editor-Zeile etwa hälftig', async () => {
    const m = merke(await mountEditor({ initialValue: '# Titel\n\nAbsatz.' }));

    m.editor.setSideBySide(true);

    const zeilenBreite = editorRowOf(m).getBoundingClientRect().width;
    const editorBreite = m.editor.codemirror.dom.getBoundingClientRect().width;
    const panelBreite = panelOf(m).getBoundingClientRect().width;

    expect(panelBreite).toBeGreaterThan(0);
    // 50/50 mit Toleranz für Rahmen und Sub-Pixel-Rundung.
    expect(editorBreite).toBeGreaterThan(zeilenBreite * 0.4);
    expect(panelBreite).toBeGreaterThan(zeilenBreite * 0.4);
  });
});

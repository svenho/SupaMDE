import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import katex from 'katex';
import { markdownToHtml } from '../parse';
import { addAnchorTargetBlank } from '../sanitize';
import { isKatexAvailable, setKatex } from '../katex-marked';

describe('markdownToHtml — Markdown', () => {
  it('rendert einfaches Markdown zu HTML', () => {
    const html = markdownToHtml('# Titel\n\nText **fett**.');
    expect(html).toContain('<h1>Titel</h1>');
    expect(html).toContain('<strong>fett</strong>');
  });

  it('previewRender ersetzt den eingebauten Renderer komplett', () => {
    const html = markdownToHtml('# egal', { previewRender: () => '<p>CUSTOM</p>' });
    expect(html).toBe('<p>CUSTOM</p>');
  });
});

describe('markdownToHtml — KaTeX (mit injizierter Instanz)', () => {
  // KaTeX explizit injizieren → deterministisch verfügbar, kein Import-Race.
  beforeAll(() => setKatex(katex));
  afterAll(() => setKatex(null));

  it('KaTeX ist injiziert und verfügbar', () => {
    expect(isKatexAvailable()).toBe(true);
  });

  it('rendert eine Block-Formel $$…$$', () => {
    expect(markdownToHtml('$$\nE = mc^2\n$$')).toContain('katex');
  });

  it('rendert eine align-Umgebung innerhalb $$', () => {
    const html = markdownToHtml('$$\n\\begin{align} a &= b \\\\ c &= d \\end{align}\n$$');
    expect(html).toContain('katex');
  });

  it('rendert eine Inline-Formel $…$', () => {
    expect(markdownToHtml('Es gilt $x_5$ hier.')).toContain('katex');
  });

  it('Kein-Leerzeichen-Regel: "$5 und $10" bleibt Text', () => {
    const html = markdownToHtml('Das kostet $5 und jenes $10.');
    expect(html).not.toContain('class="katex"');
    expect(html).toContain('$5 und jenes $10');
  });

  it('kaputte Formel crasht nicht (throwOnError:false)', () => {
    expect(() => markdownToHtml('$\\frac{1}{$')).not.toThrow();
  });
});

describe('markdownToHtml — KaTeX fehlt (graceful degradation)', () => {
  // Kein setKatex, kein globalThis.katex → resolveKatex() liefert null.
  beforeAll(() => setKatex(null));

  it('ist als nicht verfügbar gemeldet', () => {
    expect(isKatexAvailable()).toBe(false);
  });

  it('gibt Rohtext (HTML-escaped) statt Formelsatz zurück, kein Crash', () => {
    const html = markdownToHtml('Inline $x_5$ hier.');
    expect(html).not.toContain('class="katex"');
    expect(html).toContain('$x_5$');
  });
});

describe('addAnchorTargetBlank', () => {
  it('ergänzt target=_blank + rel bei Links ohne target', () => {
    expect(addAnchorTargetBlank('<a href="x">y</a>')).toBe(
      '<a target="_blank" rel="noopener noreferrer" href="x">y</a>',
    );
  });
  it('lässt Links mit vorhandenem target unangetastet', () => {
    const html = '<a target="_self" href="x">y</a>';
    expect(addAnchorTargetBlank(html)).toBe(html);
  });
});

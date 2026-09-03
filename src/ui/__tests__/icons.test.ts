import { describe, it, expect } from 'vitest';
import { renderIcon, hasIcon } from '../icons';

describe('icons', () => {
  it('hasIcon erkennt bekannten Namen', () => {
    expect(hasIcon('bold')).toBe(true);
  });

  it('hasIcon lehnt unbekannten Namen ab', () => {
    expect(hasIcon('gibt-es-nicht')).toBe(false);
  });

  it('renderIcon liefert ein SVGElement', () => {
    const el = renderIcon('bold');
    expect(el).toBeInstanceOf(SVGElement);
    expect(el.tagName.toLowerCase()).toBe('svg');
  });

  it('renderIcon wirft bei unbekanntem Namen', () => {
    expect(() => renderIcon('gibt-es-nicht')).toThrow();
  });

  it('kennt alle Default-Toolbar-Icons', () => {
    for (const name of [
      'bold', 'italic', 'strikethrough', 'code',
      'heading', 'quote', 'code-block', 'horizontal-rule', 'clean-block',
      'unordered-list', 'ordered-list', 'check-list',
      'link', 'image', 'table', 'undo', 'redo',
    ]) {
      expect(hasIcon(name), name).toBe(true);
    }
  });

  it('kennt die M4-Icons side-by-side und fullscreen', () => {
    expect(hasIcon('side-by-side')).toBe(true);
    expect(hasIcon('fullscreen')).toBe(true);
    expect(() => renderIcon('side-by-side')).not.toThrow();
    expect(() => renderIcon('fullscreen')).not.toThrow();
  });

  it('kennt das Icon preview-fullscreen', () => {
    expect(hasIcon('preview-fullscreen')).toBe(true);
    expect(renderIcon('preview-fullscreen')).toBeInstanceOf(SVGElement);
  });
});

describe('Icon editor-mode', () => {
  it('ist bekannt', () => {
    expect(hasIcon('editor-mode')).toBe(true);
  });

  it('rendert ein SVG', () => {
    expect(renderIcon('editor-mode').tagName.toLowerCase()).toBe('svg');
  });
});

describe('Icon upload-image', () => {
  it('ist als Built-in-Icon bekannt', () => {
    expect(hasIcon('upload-image')).toBe(true);
  });

  it('rendert ein SVG', () => {
    expect(renderIcon('upload-image').tagName.toLowerCase()).toBe('svg');
  });
});

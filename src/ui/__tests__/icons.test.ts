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
});

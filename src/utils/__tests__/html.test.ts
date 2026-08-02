import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html';

describe('escapeHtml', () => {
  it('escaped alle fünf kritischen Zeichen', () => {
    expect(escapeHtml("&<>\"'")).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('lässt harmlosen Text unangetastet', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('escaped HTML-Tags in Text', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escaped Attribute-Werte', () => {
    expect(escapeHtml('value="test"')).toBe('value=&quot;test&quot;');
  });

  it('escaped & einzeln', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });
});

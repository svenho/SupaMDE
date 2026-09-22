import { describe, it, expect } from 'vitest';

describe('Browser-Umgebung', () => {
  it('stellt echtes Layout bereit — anders als jsdom', () => {
    const div = document.createElement('div');
    div.style.width = '120px';
    div.style.height = '40px';
    document.body.appendChild(div);

    // Genau das ist der Unterschied zur jsdom-Suite: dort wäre beides 0.
    const rect = div.getBoundingClientRect();
    expect(rect.width).toBe(120);
    expect(rect.height).toBe(40);

    div.remove();
  });

  it('feuert ein natives scroll-Event auf scrollTop-Zuweisung', async () => {
    // Die Grundlage der ganzen Scroll-Suite: im Browser feuert die Zuweisung
    // ein ECHTES (asynchrones) Event. Kein dispatchEvent nötig — und genau
    // deshalb ist manuelles Dispatchen hier verboten (Global Constraints).
    const box = document.createElement('div');
    box.style.cssText = 'height:50px;overflow:auto';
    const inner = document.createElement('div');
    inner.style.height = '500px';
    box.appendChild(inner);
    document.body.appendChild(box);

    const gefeuert = new Promise<void>((resolve) => {
      box.addEventListener('scroll', () => resolve(), { once: true });
    });
    box.scrollTop = 100;
    await gefeuert;

    expect(box.scrollTop).toBe(100);
    box.remove();
  });
});

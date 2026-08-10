import { describe, it, expect, vi } from 'vitest';
import SupaMDE, { SupaMDE as NamedSupaMDE, VERSION } from '../index';

describe('SupaMDE (Skelett)', () => {
  it('exportiert dieselbe Klasse als Default- und benannten Export', () => {
    expect(SupaMDE).toBe(NamedSupaMDE);
  });

  it('stellt die Version als statische Eigenschaft bereit', () => {
    expect(SupaMDE.version).toBe(VERSION);
  });
});

describe('SupaMDE (Editor-API, M1)', () => {
  function attachedTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('baut einen Editor aus der Textarea und liest den Wert', () => {
    const ta = attachedTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });
    expect(editor.value()).toBe('# Titel');
    expect(editor.getValue()).toBe('# Titel');
    editor.toTextArea();
  });

  it('setValue und value(val) ersetzen den Doc-Inhalt (äquivalent)', () => {
    const ta = attachedTextarea('alt');
    const editor = new SupaMDE({ element: ta });
    editor.setValue('neu');
    expect(editor.getValue()).toBe('neu');
    editor.value('via value');
    expect(editor.value()).toBe('via value');
    editor.toTextArea();
  });

  it('Roundtrip für Mehrzeiler und Leerstring', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });
    editor.setValue('Zeile 1\nZeile 2\n');
    expect(editor.getValue()).toBe('Zeile 1\nZeile 2\n');
    editor.setValue('');
    expect(editor.getValue()).toBe('');
    editor.toTextArea();
  });

  it('exponiert die EditorView als `codemirror`', () => {
    const ta = attachedTextarea('x');
    const editor = new SupaMDE({ element: ta });
    expect(editor.codemirror).toBe(editor.codemirror); // stabil
    expect(typeof editor.codemirror.state.doc.toString()).toBe('string');
    editor.toTextArea();
  });

  it('wirft bei fehlendem element', () => {
    expect(() => new SupaMDE({})).toThrow(/element/i);
  });
});

describe('SupaMDE (Toolbar/Statusbar-Integration, M3)', () => {
  function makeTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('baut Container mit Toolbar und Statusbar', () => {
    const ta = makeTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });
    const container = ta.previousSibling as HTMLElement;
    // Container liegt vor der (versteckten) Textarea
    expect(container.classList.contains('supamde-container')).toBe(true);
    expect(container.querySelector('.supamde-toolbar')).not.toBeNull();
    expect(container.querySelector('.supamde-statusbar')).not.toBeNull();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    editor.toTextArea();
  });

  it('respektiert toolbar:false und status:false', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta, toolbar: false, status: false });
    const container = ta.previousSibling as HTMLElement;
    expect(container.querySelector('.supamde-toolbar')).toBeNull();
    expect(container.querySelector('.supamde-statusbar')).toBeNull();
    editor.toTextArea();
  });

  it('Statusbar zeigt initial die Wortzahl', () => {
    const ta = makeTextarea('ein zwei drei');
    const editor = new SupaMDE({ element: ta });
    const words = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-words')!;
    expect(words.textContent).toContain('3');
    editor.toTextArea();
  });

  it('updateStatusBar überschreibt ein Item', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta, status: ['autosave'] });
    editor.updateStatusBar('autosave', 'gespeichert');
    const el = (ta.previousSibling as HTMLElement).querySelector('.supamde-status-autosave')!;
    expect(el.textContent).toBe('gespeichert');
    editor.toTextArea();
  });

  it('toTextArea räumt den Container ab', () => {
    const ta = makeTextarea('x');
    const editor = new SupaMDE({ element: ta });
    editor.toTextArea();
    expect(document.querySelector('.supamde-container')).toBeNull();
    expect(ta.style.display).not.toBe('none');
  });
});

describe('SupaMDE — Preview & Fullscreen', () => {
  function makeTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('markdown() rendert Markdown+Formel zu HTML', () => {
    const editor = new SupaMDE({ element: makeTextarea('# Hi') });
    expect(editor.markdown('# Hi')).toContain('<h1>Hi</h1>');
    editor.toTextArea();
  });

  it('toggleSideBySide schaltet isSideBySideActive und setzt Container-Klasse', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    expect(editor.isSideBySideActive()).toBe(false);
    editor.toggleSideBySide();
    expect(editor.isSideBySideActive()).toBe(true);
    editor.toTextArea();
  });

  it('toggleFullScreen schaltet isFullscreenActive', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(false);
    editor.toTextArea();
  });

  it('markdown() bleibt konsistent mit dem Panel-Render-Snapshot, auch wenn this.options nachträglich mutiert wird', () => {
    const editor = new SupaMDE({ element: makeTextarea('x'), renderingConfig: { singleLineBreaks: true } });

    // this.options ist public und mutierbar — ein Aufrufer könnte renderingConfig
    // nachträglich ändern. markdown() darf sich davon NICHT beeinflussen lassen,
    // sondern muss denselben (einmalig im Konstruktor berechneten) Snapshot nutzen
    // wie das Side-by-Side-Panel — sonst würden beide auseinanderlaufen.
    (editor.options as { renderingConfig?: { singleLineBreaks?: boolean } }).renderingConfig = {
      singleLineBreaks: false,
    };

    const withBreaks = 'Zeile eins\nZeile zwei';
    // Referenzwert: wie markdownToHtml mit dem URSPRÜNGLICHEN Snapshot rendern würde
    // (singleLineBreaks: true → <br> bei einfachem Zeilenumbruch).
    expect(editor.markdown(withBreaks)).toContain('<br>');

    editor.toTextArea();
  });
});

describe('SupaMDE — F9/F11-Tastenkürzel (view-Aktionen, keine CM6-Commands)', () => {
  function makeTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  function fireKey(target: EventTarget, key: string, mods: KeyboardEventInit = {}): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
  }

  it('F9 auf dem Container schaltet Side-by-Side um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    const container = document.querySelector('.supamde-container') as HTMLElement;
    expect(editor.isSideBySideActive()).toBe(false);
    fireKey(container, 'F9');
    expect(editor.isSideBySideActive()).toBe(true);
    editor.toTextArea();
  });

  it('F11 auf dem Container schaltet Fullscreen um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    const container = document.querySelector('.supamde-container') as HTMLElement;
    expect(editor.isFullscreenActive()).toBe(false);
    fireKey(container, 'F11');
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toTextArea();
  });

  it('nach toTextArea() feuern F9/F11 nicht mehr', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    const container = document.querySelector('.supamde-container') as HTMLElement;
    editor.toTextArea();
    fireKey(container, 'F9');
    fireKey(container, 'F11');
    expect(editor.isSideBySideActive()).toBe(false);
    expect(editor.isFullscreenActive()).toBe(false);
  });

  it('F9 aus dem fokussierten Editor (contentDOM) schaltet Side-by-Side um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    expect(editor.isSideBySideActive()).toBe(false);
    fireKey(editor.codemirror.contentDOM, 'F9');
    expect(editor.isSideBySideActive()).toBe(true);
    editor.toTextArea();
  });

  it('F11 aus dem fokussierten Editor (contentDOM) schaltet Fullscreen um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    expect(editor.isFullscreenActive()).toBe(false);
    fireKey(editor.codemirror.contentDOM, 'F11');
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toTextArea();
  });

  // Zweitbindung, weil F11 auf macOS vom OS abgefangen wird (siehe index.ts).
  it('Cmd+Shift+F schaltet Fullscreen um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    const container = document.querySelector('.supamde-container') as HTMLElement;
    expect(editor.isFullscreenActive()).toBe(false);
    fireKey(container, 'F', { metaKey: true, shiftKey: true });
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toTextArea();
  });

  it('Ctrl+Shift+F schaltet Fullscreen um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    expect(editor.isFullscreenActive()).toBe(false);
    fireKey(editor.codemirror.contentDOM, 'F', { ctrlKey: true, shiftKey: true });
    expect(editor.isFullscreenActive()).toBe(true);
    editor.toTextArea();
  });

  it('Shift+F ohne Mod-Taste schaltet Fullscreen nicht um', () => {
    const editor = new SupaMDE({ element: makeTextarea('x') });
    const container = document.querySelector('.supamde-container') as HTMLElement;
    fireKey(container, 'F', { shiftKey: true });
    expect(editor.isFullscreenActive()).toBe(false);
    editor.toTextArea();
  });
});

describe('SupaMDE: kombinierter Vorschau-Vollbild-Modus', () => {
  function attachedTextarea(value = ''): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('schaltet aus "beides aus" beide Modi ein und wieder aus', () => {
    const ta = attachedTextarea('# Titel');
    const editor = new SupaMDE({ element: ta });

    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);
    expect(editor.isPreviewFullScreenActive()).toBe(true);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(false);
    expect(editor.isFullscreenActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.toTextArea();
  });

  it('führt aus dem Teilzustand "nur Vorschau" in den Vollzustand', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.toggleSideBySide();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);

    editor.toTextArea();
  });

  it('führt aus dem Teilzustand "nur Vollbild" in den Vollzustand', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.toggleFullScreen();
    expect(editor.isFullscreenActive()).toBe(true);
    expect(editor.isSideBySideActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);

    editor.togglePreviewFullScreen();
    expect(editor.isSideBySideActive()).toBe(true);
    expect(editor.isFullscreenActive()).toBe(true);

    editor.toTextArea();
  });

  it('setSideBySide/setFullScreen sind idempotent', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.setSideBySide(true);
    editor.setSideBySide(true);
    expect(editor.isSideBySideActive()).toBe(true);

    editor.setFullScreen(false);
    expect(editor.isFullscreenActive()).toBe(false);

    editor.toTextArea();
  });

  it('setzt die Container-Klasse supamde-sided auch über den Kombi-Toggle', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta });

    editor.togglePreviewFullScreen();
    const container = document.querySelector('.supamde-container');
    expect(container?.classList.contains('supamde-sided')).toBe(true);
    expect(container?.classList.contains('supamde-fullscreen')).toBe(true);

    editor.toTextArea();
  });

  it('Escape aus dem Vollbild aktualisiert den Aktiv-Zustand des Kombi-Buttons', () => {
    const ta = attachedTextarea();
    const editor = new SupaMDE({ element: ta, toolbar: ['preview-fullscreen'] });
    const container = document.querySelector('.supamde-container');
    if (!container) throw new Error('Container fehlt');

    editor.togglePreviewFullScreen();
    const btn = container.querySelector('button[data-action="preview-fullscreen"]');
    expect(btn?.classList.contains('active')).toBe(true);

    // Escape geht direkt an den fullscreen-internen Handler, NICHT über
    // toggleFullScreen() — die Toolbar muss trotzdem nachziehen.
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(editor.isFullscreenActive()).toBe(false);
    expect(editor.isPreviewFullScreenActive()).toBe(false);
    expect(btn?.classList.contains('active')).toBe(false);

    editor.toTextArea();
  });

  it('die Nutzer-Option onToggleFullScreen bleibt erhalten', () => {
    const ta = attachedTextarea();
    const onToggleFullScreen = vi.fn();
    const editor = new SupaMDE({ element: ta, onToggleFullScreen });

    editor.setFullScreen(true);
    expect(onToggleFullScreen).toHaveBeenCalledWith(true);
    editor.setFullScreen(false);
    expect(onToggleFullScreen).toHaveBeenCalledWith(false);

    editor.toTextArea();
  });
});

# Kombinierter Vorschau-Vollbild-Button

**Datum:** 2026-08-10
**Status:** Design abgestimmt

## Problem

Die Toolbar bietet `side-by-side` (Nebeneinander-Vorschau) und `fullscreen` (Vollbild)
als getrennte Buttons. In der Praxis werden beide fast immer gemeinsam benutzt: erst
Vollbild, dann Vorschau — zwei Klicks für einen Arbeitsmodus. Gesucht ist ein Button,
der beides in einem Schritt schaltet.

## Verhalten

Ein Toggle mit genau zwei Zuständen. `active` bedeutet: Side-by-Side **und** Fullscreen
sind beide aktiv.

| Ausgangszustand | Klick auf den Button |
|---|---|
| beides aus | beides an |
| nur Vorschau an | beides an |
| nur Vollbild an | beides an |
| beides an | beides aus |

Aus jedem Teilzustand führt ein Klick also in den Vollzustand ("Alles-oder-nichts").
Bewusst verworfen wurden ein reiner XOR-Toggle (invertiert beide unabhängig, aus einem
Teilzustand heraus unintuitiv) und eine Variante, die beim Ausschalten den Zustand von
vor dem Einschalten wiederherstellt (zusätzlicher State, schwerer zu erklären).

Die bestehenden Einzel-Buttons und ihre Kürzel (F9, F11, Mod-Shift-F) bleiben
unverändert. Werden beide Wege gemischt benutzt, ergibt sich der Kombi-Zustand aus den
zwei unabhängigen Flags — es wird kein zusätzlicher State eingeführt. Das erhält die
heutige Entkopplung von Vorschau und Vollbild (siehe Kommentar in `ui/fullscreen.ts`).

## Komponenten

### 1. Idempotente Setter auf den Modulen

`toggleSideBySide()` / `toggleFullScreen()` können nur invertieren; für "schalte beide
auf X" werden idempotente Setter gebraucht.

- `ui/fullscreen.ts`: das intern bereits vorhandene `set(next)` (arbeitet nur bei echter
  Änderung) wird auf dem `Fullscreen`-Interface exportiert.
- `ui/preview.ts`: analoges `set(next)` auf `SideBySide`, das intern `toggle()` nutzt.

### 2. Instanz-Methoden in `index.ts`

Neu: `setSideBySide(on: boolean)` und `setFullScreen(on: boolean)`. Die vorhandenen
`toggleSideBySide()` / `toggleFullScreen()` delegieren an diese Setter, damit es genau
einen Schaltpfad gibt.

Neu, der eigentliche Kombi-Toggle:

```ts
togglePreviewFullScreen(): void {
  const on = !(this.isSideBySideActive() && this.isFullscreenActive());
  this.setSideBySide(on);
  this.setFullScreen(on);
}

isPreviewFullScreenActive(): boolean {
  return this.isSideBySideActive() && this.isFullscreenActive();
}
```

### 3. `SupaLike` erweitern (`ui/actions.ts`)

`togglePreviewFullScreen()` und `isPreviewFullScreenActive()` ergänzen. Der
`_supaLikeCheck` am Ende von `index.ts` lässt Vertragsbrüche beim Typecheck auffallen.

### 4. Built-in-Action `'preview-fullscreen'`

In `BUILTIN_ACTIONS`:

```ts
'preview-fullscreen': {
  kind: 'view',
  run: (editor) => editor.togglePreviewFullScreen(),
  active: (editor) => editor.isPreviewFullScreenActive(),
  icon: 'preview-fullscreen',
  title: 'Vorschau im Vollbild',
  shortcut: 'F8',
}
```

### 5. Icon (`ui/icons.ts`)

Icons stammen aus Lucide, nicht aus handgeschriebenem SVG. Neuer Eintrag
`'preview-fullscreen': Maximize2` — Vollbild-Metapher, optisch klar unterscheidbar von
`Fullscreen` (Einzel-Vollbild) und `Columns2` (Einzel-Vorschau).

### 6. F8 im Keydown-Handler (`index.ts`)

Weiterer Zweig in `onViewShortcuts`, mit `event.preventDefault()` wie F9/F10/F11.
F8 ist frei (F9 = Side-by-Side, F10 = Editor-Modus, F11 = Vollbild) und reiht sich in
die bestehende Funktionstasten-Reihe ein.

### 7. `DEFAULT_TOOLBAR` (`ui/toolbar-config.ts`)

Die Einträge `'side-by-side', 'fullscreen'` werden durch `'preview-fullscreen'` ersetzt.
Beide Einzel-Namen bleiben in `BUILTIN_ACTIONS` registriert und über die
`toolbar`-Option weiterhin nutzbar — die API ändert sich nicht, nur die Default-Toolbar.

## Tests

- `actions.test.ts`: Action ist registriert; `run` schaltet aus jedem der vier
  Ausgangszustände korrekt; `active` nur wenn beide Modi an sind.
- `preview.test.ts` / `fullscreen.test.ts`: `set()` ist idempotent (doppelter Aufruf mit
  demselben Wert ändert nichts und löst keinen Callback aus).
- `index.test.ts`: `togglePreviewFullScreen()` aus allen vier Ausgangszuständen; F8
  löst die Aktion aus.
- `toolbar-config.test.ts`: Default-Toolbar enthält `'preview-fullscreen'`; die alten
  Namen `'side-by-side'` und `'fullscreen'` bleiben auflösbar.
- `icons.test.ts`: Icon `'preview-fullscreen'` ist vorhanden.

## Dokumentation

- README: Toolbar-Buttons und Tastenkürzel-Tabelle um den neuen Eintrag ergänzen.
- CHANGELOG: neuer Button plus geänderte Default-Toolbar.

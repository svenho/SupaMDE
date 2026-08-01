# SupaMDE — Umschaltbarer Live-Preview-Modus (Obsidian-Stil)

**Datum:** 2026-08-01
**Status:** Freigegeben (Design)
**Einordnung:** Zusatzfeature zwischen M4 und M5. Löst den Backlog-Punkt
„Decoration-basiertes Markup-Ausblenden" aus Abschnitt 3.6 des
[Migrations-Designs](2026-07-17-supamde-cm6-migration-design.md) ein.

---

## 1. Ziel

SupaMDE bekommt einen zweiten Editor-Modus. Der Nutzer schaltet zwischen:

- **`'source'`** — das bisherige Verhalten (easyMDE-Parität): Markdown-Markup
  bleibt sichtbar, wird per `HighlightStyle` live formatiert. **Default.**
- **`'live'`** — Obsidian-artige Live-Vorschau: Markup wird ausgeblendet und nur
  dort sichtbar, wo der Cursor steht.

Der Text bleibt in beiden Modi editierbarer Markdown-Quelltext. Der Live-Modus ist
eine **reine Darstellungsschicht** — er verändert weder das Dokument noch das
Verhalten bestehender Features.

### Ausbaustufe A (dieses Dokument)

Nur **Markup-Ausblenden**. Widget-Ersetzungen (gerenderte Bilder, LaTeX, Tabellen,
Trennlinien) sind **Ausbaustufe B** und ausdrücklich nicht Teil dieser Spec. Die
Architektur lässt B später als Erweiterung zu.

**Ausnahme, bewusst aufgenommen:** Cmd/Ctrl+Klick öffnet Links. Diese Funktion ist
modusunabhängig (auch im Source-Modus aktiv), berührt die Decoration-Schicht nicht
und ist in sich abgeschlossen — deshalb hier statt in B.

---

## 2. Verhalten

### 2.1 Sichtbarkeitsregel (knoten-genau)

Markup wird sichtbar, sobald der **umschließende Knoten** einen Cursor oder
Selektionsbereich berührt. Andere Formatierungen derselben Zeile bleiben versteckt.

```
Ein **fetter** und ein *kursiver* Teil
        ^ Cursor hier
→ **fetter** zeigt seine Sternchen, *kursiver* bleibt versteckt
```

Bei **Selektion** über einen Bereich wird das Markup aller berührten Knoten
sichtbar — sonst selektiert man Zeichen, die man nicht sieht, und Kopieren oder
Löschen wirkt unberechenbar.

Bei Überschriften umfasst der Knoten die ganze Zeile; dort verhält sich die
knoten-genaue Regel faktisch zeilen-genau. Das ist gewollt.

### 2.2 Ausgeblendete Marker

Verifizierte `@lezer/markdown`-Namen (mit `GFM`):

| Format | Elternknoten | Marker | Anmerkung |
|---|---|---|---|
| Fett | `StrongEmphasis` | `EmphasisMark` | |
| Kursiv | `Emphasis` | `EmphasisMark` | |
| Durchgestrichen | `Strikethrough` | `StrikethroughMark` | **eigener Name**, nicht `EmphasisMark` |
| Inline-Code | `InlineCode` | `CodeMark` | |
| Überschrift | `ATXHeading1`–`ATXHeading6` | `HeaderMark` | inkl. folgendem Leerzeichen |
| Zitat | `Blockquote` | `QuoteMark` | inkl. folgendem Leerzeichen |

**Nicht ausgeblendet:** Listen-Marker (`-`, `1.`) — in Obsidian ebenfalls sichtbar,
sie tragen Bedeutung. Link-Syntax — ohne Widget-Ersetzung ginge sonst die URL
verloren (Ausbaustufe B).

### 2.3 Cursor, Selektion, Zwischenablage

**Cursor-Bewegung.** Versteckte Bereiche sind über `EditorView.atomicRanges`
**atomar**: Der Cursor überspringt einen inaktiven Marker in einem Schritt statt in
mehreren wirkungslosen Tastendrücken.

Die beiden Zustände schließen sich aus, deshalb entsteht kein Konflikt zwischen
„atomar" und „editierbar":

| Knoten-Zustand | Markup | Cursor |
|---|---|---|
| Cursor **im** Knoten (aktiv) | sichtbar | vollständig normal navigier- und editierbar |
| Cursor **außerhalb** (inaktiv) | versteckt | wird als Einheit übersprungen |

Akzeptierter Randfall: Beim Überqueren einer Knotengrenze kann der Cursor eine
Position weiter springen als erwartet (hinter statt vor den ersten Marker). Eine
Position Differenz, kein Klemmen — dasselbe Verhalten wie in Obsidian.

**Löschen über einen inaktiven Marker.** `atomicRanges` wirkt auch auf Backspace
und Delete: Steht der Cursor direkt hinter einem versteckten `**`, entfernt ein
Backspace beide Sternchen auf einmal statt eines. Das ist konsistent — ein halb
gelöschter Marker hinterließe kaputtes Markup, das der Nutzer nicht sieht. Verhalten
wird so übernommen und getestet.

**Kopieren** liefert Markdown inklusive Markup (`**fett**`). Der Editor bearbeitet
Markdown, die Zwischenablage soll Markdown enthalten; alles andere wäre zwischen
zwei SupaMDE-Instanzen verlustbehaftet. Das ist zugleich das Verhalten ohne
Sondercode.

**Klick in eine formatierte Stelle** lässt den Text um die Markup-Breite springen.
Wird akzeptiert; jede Korrektur verhält sich in Randfällen schlechter als das
Nichtstun. Auch hier: Obsidian-Verhalten.

### 2.4 Verhältnis zu bestehenden Features

Der Live-Modus ändert an keinem M3/M4-Feature das Verhalten:

- **Vorschau / Side-by-Side** — unabhängig, beliebig kombinierbar. Die Vorschau
  zeigt das gerenderte Endergebnis, der Live-Modus nur ausgeblendetes Markup.
- **Toolbar-Commands** — arbeiten auf Dokument und Syntaxbaum, nicht auf der
  Darstellung. Keine Anpassung nötig. Nach jedem Command steht der Cursor im neu
  erzeugten Knoten, das Markup ist also **sichtbar** (bei `bold` mit leerer
  Selektion zwingend — sonst gäbe es keine sichtbare Rückmeldung).
- **Statusbar** — zählt weiter auf dem Dokument, inklusive Markup-Zeichen. Ein
  modusabhängiger Zähler wäre für Nutzer schwer erklärbar.
- **Fullscreen** — orthogonal.

---

## 3. Architektur

### 3.1 Modulstruktur

```
src/livepreview/
  ranges.ts      → computeHiddenRanges(): reine Funktion, Kern der Logik
  plugin.ts      → ViewPlugin: CM6-Verdrahtung + atomicRanges
  index.ts       → livePreviewExtension, Compartment, EditorMode-Typ
src/editor/
  link-click.ts  → Cmd/Ctrl+Klick auf Links (modusunabhängig)
```

Eigenes Verzeichnis, weil das Feature drei getrennte Verantwortlichkeiten mitbringt
(Berechnung, View-Anbindung, Komposition) und die Berechnung den Großteil der
Komplexität und Testmatrix trägt. Zusammengelegt verschwämme genau die
Testbarkeitsgrenze, die den gewählten Ansatz trägt.

### 3.2 Gewählter Ansatz: ViewPlugin

Ein `ViewPlugin` berechnet die Dekorationen über `view.visibleRanges`.

**Warum nicht `StateField`:** Die Dekoration hängt von der **Cursorposition** ab,
die sich ständig ohne Dokumentänderung ändert. Ein `StateField` müsste bei jeder
Cursorbewegung neu rechnen — sein einziger Vorteil, das inkrementelle Mapping, wäre
wertlos — und liefe dabei über das **ganze** Dokument statt über den sichtbaren
Ausschnitt. Die CM6-Doku empfiehlt `ViewPlugin` genau für viewport-abhängige
Dekorationen.

**Warum Ausblenden und `atomicRanges` aus einer Quelle:** Beide müssen exakt
dieselbe Menge beschreiben. Zwei getrennte Iterationen könnten auseinanderlaufen,
und ein atomarer Bereich ohne Ausblendung machte sichtbaren Text unnavigierbar. Aus
einer Berechnung ist der Drift konstruktiv ausgeschlossen.

**Preis:** `ViewPlugin`-Dekorationen können keine Zeilen umbrechen oder die
Blockstruktur ändern. Für reines Markup-Ausblenden innerhalb von Zeilen irrelevant.

### 3.3 `computeHiddenRanges` — der Kern

```typescript
export function computeHiddenRanges(
  state: EditorState,
  visibleRanges: readonly { from: number; to: number }[],
): { from: number; to: number }[]
```

Keine View, kein DOM, keine Dekorationen — Zahlen rein, Zahlen raus. Vollständig
unit-testbar, analog zum Muster der `commands/`-Module.

**Algorithmus:**

1. Selektionsbereiche aus `state.selection.ranges` holen
2. Je sichtbarem Bereich `syntaxTree(state).iterate({ from, to, enter })`
3. In `enter`: ist `node.name` einer der sechs Marker-Namen?
4. Falls ja: Elternknoten über `node.node.parent` ermitteln
5. Überlappt der Elternknoten einen Selektionsbereich?
6. Falls **nein**: `{ from: node.from, to: node.to }` ins Ergebnis

**Die Überlappungsprüfung:**

```typescript
function isActive(parent: { from: number; to: number }, ranges): boolean {
  return ranges.some((r) => r.from <= parent.to && r.to >= parent.from);
}
```

`<=` / `>=` statt `<` / `>` ist bewusst: Ein Knoten gilt auch dann als aktiv, wenn
der Cursor **an seiner Grenze** steht. Nötig für den Fall „`bold` bei leerer
Selektion" — der Cursor steht dort zwischen den Sternchen und dürfte nicht als
außerhalb gelten. Dieselbe Formel deckt die Selektions-Regel aus 2.1 mit ab.

**Sonderfall Leerzeichen.** Bei `# Titel` umfasst `HeaderMark` nur das `#`. Bliebe
das Leerzeichen stehen, wäre die Überschrift um ein Zeichen eingerückt. Der Bereich
wird bis zum ersten Nicht-Leerzeichen erweitert — analog bei `QuoteMark`. Die
Erweiterung endet spätestens am Zeilenende: Bei einer Zeile, die nur aus `#` oder
`>` besteht, darf sie nicht in die Folgezeile laufen.

**Schließende `HeaderMark`.** Bei der (selteneren) Form `# Titel #` vergibt Lezer
auch am Zeilenende einen `HeaderMark`. Er wird wie der öffnende behandelt: mit
ausgeblendet, wenn der Knoten inaktiv ist. Die Leerzeichen-Erweiterung gilt hier
nach **links** (das Leerzeichen *vor* dem schließenden `#`), damit kein
freistehendes Leerzeichen am Zeilenende zurückbleibt.

**Sonderfall Verschachtelung.** Bei `**a *b* c**` mit Cursor in `b` sind *beide*
Knoten aktiv (der Cursor liegt in beiden), also erscheinen beide Markup-Ebenen. Das
ist korrekt: Man sieht die Verschachtelung, in der man arbeitet.

**Rückgabe-Vertrag:** nach `from` sortiert, überlappungsfrei. Keine Kosmetik —
`RangeSet.of()` verlangt sortierte Eingaben und wirft sonst. Die Baum-Iteration
liefert bereits in Dokumentreihenfolge; der Vertrag wird in `ranges.ts` dennoch
explizit zugesichert und getestet, damit `plugin.ts` sich darauf verlassen darf.

### 3.4 `plugin.ts` — die Verdrahtung

Ein `ViewPlugin`, das `computeHiddenRanges` aufruft und das Ergebnis in einen
`DecorationSet` aus `Decoration.replace({})` übersetzt. Neuberechnung bei
`update.docChanged || update.selectionSet || update.viewportChanged`. Derselbe
`DecorationSet` speist `EditorView.atomicRanges`.

### 3.5 Modus-Umschaltung über Compartment

```typescript
export const livePreviewCompartment = new Compartment();

export function livePreviewFor(mode: EditorMode): Extension {
  return mode === 'live' ? livePreviewExtension : [];
}
```

In `editor/extensions.ts` als Listeneintrag:

```typescript
livePreviewCompartment.of(livePreviewFor(resolved.editorMode)),
```

Umschalten zur Laufzeit mit einem Dispatch:

```typescript
view.dispatch({
  effects: livePreviewCompartment.reconfigure(livePreviewFor(mode)),
});
```

Entscheidender Vorteil gegenüber einem View-Neuaufbau: Dokument, Cursor, Selektion,
Undo-Historie und Scrollposition bleiben erhalten. Der Nutzer steht nach dem
Umschalten exakt dort, wo er war.

Das `Compartment` liegt als Modul-Konstante in `livepreview/index.ts`, damit die
Fassade es erreicht, ohne dass `extensions.ts` eine Reconfigure-API nach außen geben
muss.

**Wo der Modus lebt:** als privates Feld auf der `SupaMDE`-Instanz, nicht im
`EditorState`. Er ist eine Eigenschaft der Ansicht, nicht des Dokuments, und die
Fassade ist die einzige Stelle, die ihn setzt — dasselbe Muster wie bei Fullscreen
und Side-by-Side.

---

## 4. Öffentliche API

### 4.1 Option

```typescript
/** Editor-Darstellungsmodus (Default: 'source'). */
editorMode?: EditorMode;   // 'source' | 'live'
```

Default `'source'` — bestehendes Verhalten bleibt unverändert. Wichtig für die
Drop-in-Zusage aus dem Migrations-Design.

### 4.2 Methoden auf `SupaMDE`

```typescript
getEditorMode(): EditorMode
setEditorMode(mode: EditorMode): void
toggleEditorMode(): void
```

`setEditorMode` ist **idempotent** — ein Aufruf mit dem bereits aktiven Modus
dispatcht nichts. Jede Änderung ruft anschließend `this.toolbar?.update(...)`, damit
der Button-Aktiv-Zustand folgt (wie `toggleSideBySide` heute).

### 4.3 Toolbar-Aktion

Neuer Eintrag in `BUILTIN_ACTIONS`, Muster `kind: 'view'`:

```typescript
'editor-mode': {
  kind: 'view',
  run: (editor) => editor.toggleEditorMode(),
  active: (editor) => editor.getEditorMode() === 'live',
  icon: 'editor-mode',
  title: 'Live-Vorschau',
  shortcut: 'F10',
}
```

Erfordert `toggleEditorMode()` und `getEditorMode()` im `SupaLike`-Interface. Da
`SupaMDE` per `_supaLikeCheck` strukturell dagegen geprüft wird, fängt der Typecheck
jede Lücke an dieser Stelle ab.

Neues Icon `editor-mode` in `ui/icons.ts`.

**Nicht in `DEFAULT_TOOLBAR`** — bestehende Nutzer bekommen ihre Toolbar
unverändert. Wer den Button will, nennt ihn in seiner `toolbar`-Liste.

### 4.4 Tastenkürzel F10

Wird in den bestehenden `onViewShortcuts`-Handler neben F9 und F11 eingereiht, mit
`preventDefault()` — F10 fokussiert in einigen Browsern die Menüleiste.

---

## 5. Cmd/Ctrl+Klick auf Links

Eigenes Modul `src/editor/link-click.ts`, **modusunabhängig** (fest in der
Extension-Liste, außerhalb des Compartments) — es gibt keinen Grund, nützliche
Navigation an den Live-Modus zu koppeln.

Eine Extension über `EditorView.domEventHandlers({ mousedown })`: bei gesetztem
`metaKey`/`ctrlKey` Position über `view.posAtCoords()` auflösen, im Baum den `Link`-
bzw. `URL`-Knoten suchen, bei Treffer `window.open(url, '_blank', 'noopener,noreferrer')`
und `preventDefault()`.

Die URL-Extraktion wird als reine Funktion herausgezogen:

```typescript
export function linkUrlAt(state: EditorState, pos: number): string | null
```

**Sicherheit:** `noopener,noreferrer` ist gesetzt. Nicht-`http(s)`-Schemata
(`javascript:`, `data:`) werden verworfen — sonst wäre ein präpariertes Dokument ein
Angriffsvektor.

**Nicht enthalten:** Ausblenden der Link-Syntax `[…](…)`. Das ist Ausbaustufe B,
zusammen mit den dort zu klärenden Fragen (Bearbeiten einer unsichtbaren URL,
Referenz-Links `[Text][ref]`, Autolinks `<https://…>`).

---

## 6. Fehlerbehandlung

**Ungültiger `editorMode`-Wert** (etwa aus untypisiertem JavaScript): `resolveOptions`
fällt auf `'source'` zurück und gibt `console.warn` aus — dasselbe Muster wie
`resolveToolbar` bei unbekannten Aktionsnamen. Kein Wurf: Ein falscher
Darstellungsmodus darf den Editor nicht am Starten hindern.

**Unvollständiger Syntaxbaum** (Lezer parst große Dokumente zunächst teilweise): Da
nur über `visibleRanges` iteriert wird, ist der sichtbare Bereich in der Praxis
geparst. Falls doch nicht, fehlen schlicht Dekorationen — der Text bleibt lesbar,
das Markup sichtbar. Degradierter, aber korrekter Zustand, kein Fehlerfall.

**Fehlende URL beim Link-Klick:** `linkUrlAt` liefert `null`, der Handler tut nichts
und lässt den Klick durch.

---

## 7. Teststrategie

| Ebene | Datei | Inhalt |
|---|---|---|
| Unit (rein) | `livepreview/__tests__/ranges.test.ts` | Matrix unten |
| Unit (rein) | `editor/__tests__/link-click.test.ts` | `linkUrlAt` inkl. Schema-Filterung |
| Integration | `livepreview/__tests__/plugin.test.ts` | headless `EditorView`: Dekorationen vorhanden, `atomicRanges` **deckungsgleich**, Backspace entfernt inaktiven Marker als Ganzes |
| Integration | `__tests__/editor-mode.test.ts` | API-Trio, Idempotenz, Erhalt von Cursor/Historie über den Wechsel |
| Regression | bestehende Suites | Toolbar-Commands im Live-Modus, Statusbar-Zählung |

Die Deckungsgleichheit von Dekorationen und `atomicRanges` sichert die Zusage aus
3.2 ab, dass kein Drift entstehen kann.

**Matrix für `ranges.ts`** (jeweils Cursor innerhalb / außerhalb):

| Fall | Prüft |
|---|---|
| Alle sechs Markertypen einzeln | Grundfunktion je Knotenart |
| Cursor an Knotengrenze | die `<=`/`>=`-Entscheidung aus 3.3 |
| Selektion über mehrere Knoten | Selektions-Regel aus 2.1 |
| Verschachtelt `**a *b* c**` | unabhängige Ebenen |
| Mehrere Cursor (Multi-Selection) | `ranges.some()` |
| Sichtbarer Ausschnitt kleiner als Dokument | Viewport-Beschränkung |
| Zeile nur aus `#` bzw. `>` | Leerzeichen-Erweiterung läuft nicht in die Folgezeile |
| Geschlossene Überschrift `# Titel #` | schließender `HeaderMark`, Erweiterung nach links |
| Leeres Markup `****` | siehe offener Punkt unten |
| Leeres Dokument | Randfall |

**Regressionstest zur Command-Zusage:** `bold` im Live-Modus aufrufen und prüfen,
dass das Dokument `**fett**` enthält **und** die Sternchen nicht in den
ausgeblendeten Bereichen liegen.

### Offener Punkt (beim Implementieren zu verifizieren)

Bei `****` mit Cursor in der Mitte ist der Knoten **leer**. Ob `@lezer/markdown`
dort überhaupt einen `StrongEmphasis`-Knoten bildet, ist nicht selbstverständlich —
der Parser könnte die Sternchen auch als gewöhnlichen Text sehen. Entsteht kein
Knoten, gibt es nichts auszublenden, und die Sternchen sind aus einem anderen Grund
sichtbar. Das sichtbare Ergebnis ist in beiden Fällen dasselbe; der Test wird gegen
das **tatsächliche** Parser-Verhalten geschrieben, nicht gegen eine Annahme.

---

## 8. Betroffene Dateien

| Neu | Geändert |
|---|---|
| `src/livepreview/ranges.ts` | `src/options.ts` — `editorMode` in Options + Resolved |
| `src/livepreview/plugin.ts` | `src/editor/extensions.ts` — Compartment + link-click |
| `src/livepreview/index.ts` | `src/index.ts` — API-Trio, F10, Modus-Feld |
| `src/editor/link-click.ts` | `src/ui/actions.ts` — `'editor-mode'`, `SupaLike` |
| die fünf Testdateien | `src/ui/icons.ts` — Icon `editor-mode` |
| | `README.md` — Doku |

---

## 9. Bewusste Grenzen (YAGNI / Scope)

- **Keine Widget-Ersetzungen** — Bilder, LaTeX-Rendering, Tabellen, Trennlinien
  sind Ausbaustufe B.
- **Link-Syntax bleibt sichtbar** — Ausblenden erst mit B, wo die Folgefragen
  (unsichtbare URL bearbeiten, Referenz-Links, Autolinks) geschlossen beantwortet
  werden.
- **Listen-Marker bleiben sichtbar** — tragen Bedeutung, auch in Obsidian sichtbar.
- **Keine Änderung** an Statusbar-Zählung, Vorschau, Fullscreen oder bestehenden
  Commands.
- **`DEFAULT_TOOLBAR` bleibt unverändert.**
- **Kein modusabhängiges Kopier-Verhalten** — die Zwischenablage bekommt immer
  Markdown.

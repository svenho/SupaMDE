# Design: Tab-Einrückung

**Datum:** 2026-07-25
**Status:** Genehmigt

## Ziel

`Tab` rückt die aktuelle Zeile bzw. alle selektierten Zeilen ein, `Shift-Tab`
rückt sie aus — unabhängig davon, wo der Cursor in der Zeile steht. Damit kehrt
das easyMDE-Verhalten (`tabAndIndentMarkdownList` /
`shiftTabAndUnindentMarkdownList`) zurück, das vor allem beim Verschachteln von
Listen gebraucht wird.

## Motivation

In easyMDE war Tab in jeder Zeile verfügbar und der übliche Weg, Listen zu
verschachteln. CodeMirror 6 belegt `Tab` bewusst nicht per Default, sodass die
Taste in SupaMDE aktuell wirkungslos an den Browser durchgereicht wird und den
Fokus aus dem Editor bewegt. Für einen Markdown-Editor ist die Einrückung die
naheliegendere Belegung.

## Verhalten

| Situation | `Tab` | `Shift-Tab` |
| --- | --- | --- |
| Nur Cursor, beliebige Spalte | Cursorzeile um ein `indentUnit` einrücken | Bis zu ein `indentUnit` führende Leerzeichen entfernen |
| Selektion über eine oder mehrere Zeilen | Alle berührten Zeilen einrücken | Alle berührten Zeilen ausrücken |
| Zeile ohne führenden Whitespace | (einrücken) | Keine Änderung, Taste wird dennoch konsumiert |

Weitere Festlegungen:

- **Eingefügt werden Leerzeichen**, `indentUnit`-viele (Default 2, über die
  bestehende Option `indentUnit` konfigurierbar). Nie Tab-Zeichen.
- **Immer am Zeilenanfang**, nie an der Cursorposition. Ein Tab-Zeichen wird
  unter keinen Umständen in den Text eingefügt.
- **Keine Sonderbehandlung für Listen.** Markdown definiert Unterlisten genau
  über Leerzeichen-Einrückung: aus `- Punkt` wird `  - Punkt`, die
  Verschachtelung ergibt sich von selbst. Eine Ausrichtung an der Einrücktiefe
  des übergeordneten Listeneintrags (CM5-Verhalten) wird bewusst nicht
  implementiert — sie ist unvorhersehbarer und deutlich aufwendiger.
- **Die Selektion bleibt erhalten** und verschiebt sich mit den Änderungen.
- **Beide Commands geben immer `true` zurück**, auch wenn nichts zu ändern war.
  Das konsumiert die Taste und verhindert, dass der Browser-Default den Fokus
  verschiebt.

### Ausrücken im Detail

`Shift-Tab` entfernt pro Zeile bis zu `indentUnit` führende Leerzeichen —
weniger, wenn weniger vorhanden sind (bei `indentUnit = 2` und einem einzelnen
führenden Leerzeichen wird genau dieses eine entfernt). Ein führendes
Tab-Zeichen zählt als eine vollständige Einrückstufe und wird als Ganzes
entfernt. Zeilen ohne führenden Whitespace bleiben unverändert.

## Bewusste Entscheidung: keine Escape-Hatch

Tab wird ausnahmslos vom Editor abgefangen. Es gibt **keinen** Escape-dann-Tab-
Ausstieg.

**Konsequenz:** Nutzer, die ausschließlich mit der Tastatur arbeiten, können den
Editor nicht per Tab verlassen; die Fokusreihenfolge der einbettenden Seite ist
an dieser Stelle unterbrochen. Genau deshalb belegt CodeMirror 6 `Tab` nicht per
Default (siehe CM6-Doku zu `indentWithTab`).

Diese Abwägung wurde bewusst zugunsten des durchgängigen Einrück-Verhaltens
getroffen und ist hier dokumentiert, damit sie später nachvollziehbar bleibt und
bei Bedarf revidiert werden kann. Eine Nachrüstung wäre ein State-Field, das ein
`Escape` merkt, plus eine Bedingung in der Tab-Bindung — additiv, ohne Änderung
an den Commands.

## Architektur

### Neues Modul `src/commands/indent.ts`

Zwei Commands, exportiert als `indentLines` und `dedentLines`. Sie folgen dem
Muster der bestehenden Command-Module (`list.ts`, `block.ts`):

1. Zeilenbereich über `selectedLineRange(state)` aus `src/utils/text.ts`
   bestimmen.
2. Pro Zeile eine `DocChange` bauen (`insert` am Zeilenanfang bzw. Löschbereich
   für den führenden Whitespace).
3. Über `dispatchLineChanges(view, changes)` absetzen — das mappt die Selektion
   bereits mit Rechts-Bias durch die Änderungen und liefert den geforderten
   Selektionserhalt ohne Zusatzlogik.

Die Einrücktiefe wird mit `getIndentUnit(state)` aus `@codemirror/language` aus
dem State gelesen, nicht über die Optionen durchgereicht. So funktionieren die
Commands ohne Options-Objekt und respektieren automatisch die bereits in
`buildExtensions` gesetzte `indentUnit`-Facet.

Der Export als Commands (nicht nur als Keybinding) hält sie für eine spätere
Toolbar oder direkte Consumer-Nutzung verfügbar, wie bei den übrigen Commands
des Projekts.

### Änderung an `src/commands/keymap.ts`

Zwei Bindings ergänzen:

```ts
{ key: 'Tab', run: indentLines, preventDefault: true },
{ key: 'Shift-Tab', run: dedentLines, preventDefault: true },
```

Die Bindings stehen in `supaKeymap` und damit vor `defaultKeymap`, sodass keine
CM6-Default-Bindung für Tab dazwischenkommt.

Keine weiteren Dateien werden geändert. Insbesondere bleiben `options.ts` und
`extensions.ts` unberührt — `indentUnit` und `tabSize` sind dort bereits
vorhanden.

## Tests

### `src/commands/__tests__/indent.test.ts` (neu)

- Cursor mitten in der Zeile → Zeile wird am Anfang eingerückt, nicht an der
  Cursorposition.
- Cursor am Zeilenende → gleiches Ergebnis.
- Mehrzeilige Selektion → alle berührten Zeilen eingerückt.
- Listenzeile `- Punkt` → `  - Punkt` (Verschachtelung).
- `Shift-Tab` auf eingerückter Zeile → ein `indentUnit` entfernt.
- `Shift-Tab` bei nur einem führenden Leerzeichen → genau dieses entfernt.
- `Shift-Tab` auf Zeile ohne führenden Whitespace → Dokument unverändert,
  Rückgabewert dennoch `true`.
- `Shift-Tab` auf führendem Tab-Zeichen → Tab-Zeichen entfernt.
- Selektionserhalt: Selektion umfasst nach dem Einrücken denselben Text.

### `src/commands/__tests__/keymap.test.ts` (Ergänzung)

- `Tab` und `Shift-Tab` sind in `supaKeymap` gebunden.

## Nicht im Scope

- Ausrichtung an der Einrücktiefe des übergeordneten Listeneintrags.
- Neunummerierung geordneter Listen beim Ein-/Ausrücken.
- Tab-Zeichen statt Leerzeichen als Einrückung (`indentWithTabs` aus easyMDE).
- Escape-dann-Tab-Ausstieg (siehe oben, bewusst ausgeschlossen).

# SupaMDE M5 — Autosave & Bild-Upload

**Datum:** 2026-08-11
**Status:** Freigegeben (Design)
**Einordnung:** Meilenstein M5 aus dem
[Migrations-Design](2026-07-17-supamde-cm6-migration-design.md), Abschnitt 8.

---

## 1. Ziel & Rahmen

M5 gibt SupaMDE zwei Features, die den Editor über das reine Bearbeiten
hinausheben:

- **Autosave** — der Inhalt überlebt Absturz, versehentliches Schließen und
  Reload.
- **Bild-Upload** — Bilder landen per Drag & Drop, Einfügen aus der Zwischenablage
  oder Dateiauswahl im Dokument.

### 1.1 Scope-Änderung gegenüber dem Migrations-Design

Der ursprüngliche Fahrplan nannte für M5 „Autosave, Bild-Upload, Wortzählung".
Zwei Abweichungen, beide vom Auftraggeber entschieden:

**Wortzählung entfällt als M5-Punkt.** `wordCount()` existiert seit M3
([`src/features/word-count.ts`](../../../src/features/word-count.ts)) und ist in
der Statusbar verdrahtet. Es gibt nichts zu bauen.

**Die easyMDE-Drop-in-Kompatibilität wird für M5 aufgegeben.** Das
Migrations-Design forderte in Abschnitt 1 „Drop-in-Ersatz für easyMDE v2 — Grad:
API + Optionen". Für M5 gilt das **nicht mehr**: Optionsnamen, Optionsstruktur
und Methodensignaturen werden frei nach dem entworfen, was für SupaMDE richtig
ist. easyMDE dient nur noch als Referenz dafür, welche Fälle ein solches Feature
abdecken muss — nicht als vorgeschriebene Schnittstelle.

Das ist eine bewusste Kursänderung und betrifft ausdrücklich nur M5 und spätere
Arbeit; die in M1–M4 bereits umgesetzte API bleibt, wie sie ist.

### 1.2 Leitgedanke

Beide Features berühren die Außenwelt — Speicher und Netzwerk. SupaMDE übernimmt
dabei **die Editor-Seite vollständig** (Zustand, Platzhalter, Anzeige,
Fehlerdarstellung) und **die Infrastruktur-Seite gar nicht** (kein HTTP-Client,
kein festes Response-Format, kein erzwungener Speicher). Die Grenze verläuft an
zwei schmalen, austauschbaren Schnittstellen: `SupaStorage` und `upload()`.

---

## 2. Modulschnitt

Vier neue Module, dem etablierten Muster folgend — reine Logik in `features/`,
Verdrahtung dünn in der Fassade:

```
src/features/
  storage.ts             → SupaStorage-Interface + localStorage-Implementierung
  autosave.ts            → Debounce, Restore, Speicher-Anbindung
  image-upload.ts        → Upload-Orchestrierung (Datei → upload() → Text)
  upload-placeholder.ts  → CM6-StateField für positionsstabile Platzhalter
```

Beide Features hängen sich in **vorhandene** Strukturen ein, statt neue zu
schaffen:

| Anknüpfpunkt | Datei | Nutzung |
|---|---|---|
| `updateListener`-Sink | [`src/index.ts`](../../../src/index.ts) | Autosave-Debounce an `docChanged` |
| Statusbar-Item `'autosave'` | [`src/ui/statusbar.ts`](../../../src/ui/statusbar.ts) | bereits als M5-No-op angelegt |
| `insertImage()` | [`src/commands/link-image.ts`](../../../src/commands/link-image.ts) | Textform des eingefügten Bildes |
| Toolbar-Aktionsregistry | [`src/ui/actions.ts`](../../../src/ui/actions.ts) | neuer Button `'upload-image'` |

Zwei Entscheidungen zum Schnitt:

**`storage.ts` getrennt von `autosave.ts`.** Der Speicher ist die einzige Stelle,
an der Autosave die Außenwelt berührt. Getrennt lässt sich Debounce- und
Restore-Logik gegen einen In-Memory-Speicher testen — ohne jsdom-localStorage.

**`upload-placeholder.ts` als eigenes StateField.** Der einzige echte CM6-Anteil
von M5. Ein StateField hält die offenen Platzhalter und mappt sie über
`tr.changes`; getrennt vom Upload-Modul, weil das eine reine Editor-Zustandsfrage
ist und das andere asynchrone Orchestrierung.

---

## 3. Autosave

### 3.1 Optionen

```typescript
interface AutosaveOptions {
  /** Aktiviert Autosave. Default: false. */
  enabled?: boolean;
  /** Pflicht. Identifiziert das Dokument im Speicher. */
  key: string;
  /** Debounce nach der letzten Änderung, in ms. Default: 1000. */
  delay?: number;
  /** Eigener Speicher. Default: localStorage unter `supamde:<key>`. */
  storage?: SupaStorage;
  /** Wird gerufen, wenn beim Start ein Entwurf geladen wurde. */
  onRestore?: (saved: string) => void;
}
```

Ergänzt `SupaMDEOptions` um `autosave?: AutosaveOptions`.

`key` ist Pflicht und wird **im Konstruktor** geprüft. Fehlt er bei
`enabled: true`, erscheint **eine** `console.warn` und Autosave bleibt aus.

### 3.2 Speicher-Interface

```typescript
interface SupaStorage {
  load(key: string): string | null | Promise<string | null>;
  save(key: string, value: string): void | Promise<void>;
  clear(key: string): void | Promise<void>;
}
```

Async-fähig, damit ein Server-Backend oder IndexedDB ohne Zusatzschicht passt.
Die eingebaute localStorage-Implementierung ist synchron; SupaMDE behandelt beide
Fälle über `await` gleich.

Der Default-Key im localStorage ist `supamde:<key>`.

### 3.3 Ablauf

**Beim Konstruktor**, nach dem Aufbau der EditorView:

1. Speicher auf Verfügbarkeit prüfen (Probe-Schreibvorgang in `try/catch`).
2. `load(key)` aufrufen.
3. Ist das Ergebnis ein nicht-leerer String **und** weicht es vom aktuellen
   Dokument ab: ins Dokument schreiben und `onRestore(saved)` rufen.

Stimmt der gespeicherte Stand mit dem aktuellen Dokument überein, passiert
nichts — insbesondere wird `onRestore` **nicht** gerufen. Es gibt keinen Entwurf
wiederherzustellen, wenn er dem Ausgangsinhalt gleicht.

Der gespeicherte Stand gewinnt gegenüber dem Ausgangsinhalt der Textarea. Das ist
der Zweck des Features: den Entwurf zurückzubekommen. Der Host wird über
`onRestore` informiert und kann selbst eine Notiz anzeigen — SupaMDE erzwingt
dafür kein UI.

**Im Betrieb:** Jede Änderung mit `docChanged` setzt den Debounce-Timer neu; nach
`delay` ohne weitere Änderung wird gespeichert und die Statusbar aktualisiert.

**Leerer Inhalt** ruft `clear(key)` statt `save(key, '')` — sonst würde beim
nächsten Start ein leerer Entwurf über einen befüllten Ausgangsinhalt gelegt.

**Statusbar:** nach jedem erfolgreichen Speichern über die **instanz-eigene**
`statusbar.setItem('autosave', …)`, Format `Gespeichert: HH:MM` per
`Intl.DateTimeFormat` in der Locale der Umgebung. Gesetzt wird `textContent`.

**Bei `toTextArea()`:** laufenden Timer abräumen. Der gespeicherte Wert bleibt
erhalten — Rückbau des Editors ist kein Signal, den Entwurf zu verwerfen.

### 3.4 Öffentliche API

| Methode | Wirkung |
|---|---|
| `clearAutosavedValue()` | stoppt den Debounce-Timer **und** löscht den Eintrag |
| `isAutosaveActive()` | ob Autosave aktiv ist (Speicher verfügbar, `key` gültig) |

Das Stoppen des Timers ist wesentlich: Ohne das schriebe die nächste Änderung den
gerade gelöschten Eintrag sofort zurück.

### 3.5 Bewusste Abweichungen von easyMDE

Als Begründung dokumentiert, nicht als Kompatibilitätsversprechen:

| easyMDE | SupaMDE | Grund |
|---|---|---|
| globales `getElementById('autosaved')` | instanz-eigene Statusbar | zwei Editoren auf einer Seite störten sich |
| `clearAutosavedValue()` löscht nur den Key | stoppt zusätzlich den Timer | Eintrag kam sofort zurück |
| `toTextArea()`-Cleanup unerreichbar | räumt den Timer ab | Tippfehler im Variablennamen |
| Anzeige per `innerHTML` | `textContent` | XSS-Fläche |
| `submit_delay \|\| delay \|\| 1000` | ein `delay` | submit-benannte Option gewann den Tipp-Debounce |
| verschachteltes `autosave.unique_id`-Legacy | flaches `key` | Altlast ohne Nutzen |
| Options-Objekt wird mutiert | Optionen bleiben unberührt | überraschende Nebenwirkung |

---

## 4. Bild-Upload

### 4.1 Optionen

```typescript
interface UploadImageOptions {
  /** Aktiviert den Bild-Upload. Default: false. */
  enabled?: boolean;
  /** Pflicht. Lädt die Datei hoch und liefert die URL; wirft bei Fehler. */
  upload: (file: File) => Promise<string>;
  /** Maximale Dateigröße in Bytes. Default: 2 * 1024 * 1024. */
  maxSize?: number;
  /** Erlaubte MIME-Typen. Default: siehe unten. */
  accept?: string[];
  /** Überschreibt einzelne Anzeigetexte. */
  texts?: Partial<UploadTexts>;
  /** Wird bei jedem Fehler gerufen. Default: keiner (nur Statusbar). */
  onError?: (error: UploadError) => void;
}
```

Default für `accept`:
`['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']`

Ergänzt `SupaMDEOptions` um `uploadImage?: UploadImageOptions`.

`upload` ist der gesamte Vertrag zur Außenwelt: File rein, URL raus, wirft bei
Fehler. SupaMDE bringt **keinen** HTTP-Client, kein Response-Format, keine
CSRF-Optionen und keine Endpoint-Option mit. Begründung: Auth, Fehlerformate und
Upload-Flows (direkt, presigned, SDK) unterscheiden sich pro Projekt so stark,
dass jede eingebaute Variante für die Mehrheit falsch wäre. Der Host kennt sein
Backend ohnehin.

### 4.2 Auslöser

Drei Wege, alle über dieselbe Orchestrierung:

- **Drag & Drop** — `EditorView.domEventHandlers({ drop })`. Nur bei Dateien im
  `dataTransfer` eingreifen; reiner Text-Drop läuft unverändert weiter.
- **Einfügen** — `domEventHandlers({ paste })`. Nur eingreifen, wenn
  `clipboardData.files` Bilder enthält; sonst normales Text-Einfügen.
- **Toolbar-Button `'upload-image'`** — öffnet einen versteckten `<input
  type="file" multiple>`.

Der File-Input wird **bei Bedarf erzeugt** und nicht in der Toolbar geparkt.
Damit funktioniert `openBrowseFileWindow()` auch bei `toolbar: false` — bei
easyMDE warf derselbe Aufruf ohne Toolbar einen Fehler.

Der Button ist **nicht** Teil der `DEFAULT_TOOLBAR`; er wird nur bei
`uploadImage.enabled` gerendert, wenn er in der `toolbar`-Option steht.

### 4.3 Platzhalter-Mechanik

Der Kern des Features. Ablauf pro Datei:

1. **Validieren** — Größe gegen `maxSize`, `file.type` gegen `accept`. Bei
   Ablehnung passiert im Dokument **nichts**; nur Statusbar und `onError`.
2. **Platzhalter einfügen** — `![Uploading foo.png…]()` an der Cursorposition, in
   einer Transaktion, die zugleich einen `addPlaceholder`-Effect mit einer
   eindeutigen ID trägt.
3. **Verfolgen** — das StateField nimmt den Bereich auf und mappt ihn bei jeder
   folgenden Transaktion durch `tr.changes`. Tippt der Nutzer davor, wandert der
   Platzhalter mit. Löscht er ihn von Hand, verschwindet der Eintrag.
4. **Nach Erfolg** — aktuelle Position aus dem StateField lesen, Bereich durch
   `![foo.png](url)` ersetzen, Eintrag entfernen.
5. **Nach Fehler** — Platzhalter ersatzlos entfernen; Statusbar und `onError`.

**Positionsregel:** Die Ersetzung nutzt **ausschließlich** die gemappten
Positionen aus dem StateField, nie beim Einfügen gemerkte Zahlen. Das ist der
Kern der Lösung — easyMDE fügte nachträglich am dann-aktuellen Cursor ein, sodass
das Bild bei Weitertippen an falscher Stelle landete.

**Verschwundener Platzhalter:** Ist der Eintrag bei Eintreffen des Ergebnisses
nicht mehr im StateField (Nutzer hat ihn gelöscht, `setValue()` lief), wird
**nichts** eingefügt. Ein Bild, das in ein inzwischen fremdes Dokument
hineinspringt, wäre schlimmer als ein verlorener Upload.

**Mehrere Dateien** laufen parallel, jede mit eigener ID und eigenem Platzhalter.
Die Zuordnung bleibt korrekt, wenn der zweite Upload vor dem ersten fertig wird.

Jede Datei wird **einzeln** validiert und behandelt. Enthält eine Auswahl gültige
und ungültige Dateien, werden die gültigen hochgeladen und die ungültigen
einzeln über `onError` gemeldet — die ganze Auswahl wegen einer zu großen Datei
zu verwerfen wäre unnötig strikt.

**Nicht-Bild-Dateien** werden abgewiesen (`type-not-allowed`), nicht als Link
eingefügt. Das Feature heißt Bild-Upload. Bei easyMDE war genau dieser Pfad
derjenige, der `insertTexts.link[0]` dauerhaft mutierte und spätere
Link-Einfügungen beschädigte.

### 4.4 Anzeigetexte

```typescript
interface UploadTexts {
  placeholder: string;   // '![Uploading {name}…]()'
  statusInit: string;    // 'Bild hierher ziehen oder einfügen'
  statusUploading: string; // 'Lade {name} hoch…'
  statusDone: string;    // '{name} hochgeladen'
  errorTooLarge: string; // '{name} ist zu groß (max. {maxSize}).'
  errorType: string;     // '{name} ist kein unterstütztes Bildformat.'
  errorFailed: string;   // 'Upload von {name} fehlgeschlagen.'
}
```

Platzhalter `{name}`, `{maxSize}` — benannt und in geschweiften Klammern, nicht
easyMDEs `#image_name#`. Ersetzt werden **alle** Vorkommen.

Die Texte gehen in ein Statusbar-Item `'upload-image'`. Es muss in
`statusbar.ts` **neu** zu `BUILTIN_NAMES` hinzugefügt werden (`'autosave'` steht
dort bereits). Es ist nicht Teil von `DEFAULT_STATUS`; wer es will, nimmt es in
die `status`-Option auf.

Nach Erfolg fällt die Anzeige nach ca. 2 s auf `statusInit` zurück, nach Fehler
nach ca. 6 s. Laufen mehrere Uploads gleichzeitig, zeigt die Statusbar den
zuletzt eingetretenen Zustand; der Rückfall auf `statusInit` erfolgt erst, wenn
**kein** Upload mehr offen ist.

### 4.5 Öffentliche API

| Methode | Wirkung |
|---|---|
| `uploadImages(files: FileList \| File[]): void` | startet den Upload für die Dateien |
| `openBrowseFileWindow(): void` | öffnet die Dateiauswahl |

---

## 5. Fehlerbehandlung

### 5.1 Fehlertyp

```typescript
interface UploadError {
  kind: 'too-large' | 'type-not-allowed' | 'upload-failed';
  file: File;
  /** Der ursprüngliche Fehler aus upload(), bei kind === 'upload-failed'. */
  cause?: unknown;
}
```

Strukturiert statt vorformatiert: Der Host kann selbst darstellen und übersetzen.
SupaMDE erzeugt daraus nur den Statusbar-Text aus `texts` und ruft `onError`.

### 5.2 Kein `alert()`

easyMDE riss bei jedem Upload-Fehler einen blockierenden Browser-Dialog auf. Für
eine eingebettete Komponente ist das falsch. Default ist die Statusbar-Meldung;
wer mehr will, nutzt `onError`.

### 5.3 Speicher-Fehler

Ist der Speicher nicht verfügbar oder wirft er (Quota, Private Mode), wird
**einmalig** gewarnt und Autosave deaktiviert sich still — nicht bei jedem
Tastendruck erneut. Der eigentliche `save()`-Aufruf läuft in `try/catch`; easyMDE
prüfte nur mit einem Ein-Byte-Probeschreiben und ließ die echte Quota-Exception
beim Speichern großer Inhalte ungefangen durchschlagen.

Ein `upload()`, das nie auflöst, lässt den Platzhalter stehen. Das ist gewollt:
Ein Timeout gehört in die Verantwortung des Hosts, der seine Latenzen kennt. Die
README weist darauf hin.

---

## 6. Teststrategie

Der Schnitt ist so gewählt, dass fast alles im Unit-Test läuft.

**`storage.ts`** — In-Memory-Implementierung als Testdouble; die
localStorage-Variante gegen Wurf-Szenarien (nicht verfügbar, Quota).

**`autosave.ts`** — Fake-Timer gegen den In-Memory-Speicher:
- Debounce feuert einmal, nicht pro Tastendruck
- leerer Inhalt löscht den Eintrag
- Restore beim Start, inkl. `onRestore`
- `clearAutosavedValue()` stoppt den Timer (nächste Änderung schreibt nicht zurück)
- fehlender `key` bei `enabled: true` → eine Warnung, Autosave aus

**`upload-placeholder.ts`** — headless `EditorView`:
- Platzhalter einfügen, davor Text tippen → Position ist mitgewandert
- Platzhalter von Hand löschen → Eintrag verschwindet
- zwei Platzhalter gleichzeitig → beide unabhängig korrekt

**`image-upload.ts`** — `upload`-Stub, der kontrolliert auflöst oder wirft:
- Erfolg ersetzt den Platzhalter durch `![name](url)`
- Fehler entfernt den Platzhalter ersatzlos
- zweiter Upload wird vor dem ersten fertig → korrekte Zuordnung
- Platzhalter während des Uploads gelöscht → nichts wird eingefügt
- zu große Datei / falscher Typ → kein Platzhalter, `onError` mit passendem `kind`

**Drag & Drop und Paste** — je ein jsdom-Test mit synthetischem `DataTransfer`,
inklusive der Fälle „reiner Text-Paste läuft unverändert durch".

---

## 7. Dokumentation

**Teil der Definition of Done, nicht Nacharbeit.** Da M5 die Backend-Anbindung
bewusst zum Host verlagert, schuldet SupaMDE eine Anleitung, die das trägt.

Zwei neue README-Abschnitte in der bestehenden Meilenstein-Systematik, eingefügt
nach `## Editor-Modus (Live-Vorschau)`:

### `## Autosave (M5)`

Optionstabelle, Minimalbeispiel, dann die Punkte, die man erst im Betrieb merkt:

- Wahl des `key`, damit zwei Dokumente sich nicht überschreiben
- wann wiederhergestellt wird und wie `onRestore` den Nutzer informiert
- **wann `clearAutosavedValue()` zu rufen ist** — nach erfolgreichem Speichern im
  Backend; sonst holt der Editor beim nächsten Öffnen den alten Entwurf zurück
- Beispiel für einen eigenen `SupaStorage` gegen ein Server-Backend

### `## Bild-Upload (M5)`

Hier liegt das Gewicht:

1. **Wie es funktioniert** — Ablauf Datei → Validierung → Platzhalter →
   `upload()` → Ersetzung. Macht sofort klar, was SupaMDE übernimmt und wo der
   Host einsteigt.
2. **Der `upload`-Vertrag** — `(file: File) => Promise<string>`: URL zurückgeben
   oder werfen.
3. **Drei vollständige Backend-Beispiele**, kopierfertig:
   - **`fetch` gegen einen eigenen Endpunkt** mit `FormData`, CSRF-Header und
     Auswertung des Fehlerstatus — der Standardfall
   - **Presigned Upload (S3/kompatibel)** — Signatur beim eigenen Backend holen,
     direkt zum Storage hochladen, öffentliche URL zurückgeben
   - **Supabase Storage** — in wenigen Zeilen
4. **Serverseite** — was der Endpunkt leisten muss: Größen- und Typprüfung **auch
   serverseitig** (die Client-Validierung ist Komfort, keine Sicherheit),
   Dateinamen nicht ungeprüft übernehmen, sinnvolle Statuscodes
5. **Fehlerbehandlung** — die `UploadError`-Varianten, `onError`-Beispiel mit
   eigener Meldung; Hinweis auf Timeouts in der `upload`-Funktion

Die Codebeispiele werden gegen die tatsächlich implementierten Signaturen
geprüft. Eine Doku, die an der API vorbeigeht, ist schlimmer als keine.

---

## 8. Bewusste Grenzen (YAGNI)

- **Kein HTTP-Client**, kein Endpoint, kein CSRF, kein festes Response-Format.
- **Kein Fortschritt in Prozent.** Die Promise-API liefert keine
  Fortschritts-Events. Ein Nachrüsten über einen erweiterten `upload`-Vertrag ist
  später möglich, ohne Bestehendes zu brechen.
- **Kein Upload-Timeout** im Editor — gehört zum Host (siehe 5.3).
- **Keine Bildvorschau im Editor** (easyMDEs `previewImagesInEditor`). Das gehört
  in die Live-Preview-Ausbaustufe B, nicht in ein Upload-Feature.
- **Keine Bildbearbeitung** (Verkleinern, Zuschneiden, Konvertieren) vor dem
  Upload. Wer das braucht, macht es in seiner `upload`-Funktion.
- **Kein Konfliktauflösen** beim Autosave (gespeicherter vs. Server-Stand). Der
  gespeicherte Stand gewinnt; `onRestore` gibt dem Host die Möglichkeit, selbst zu
  reagieren.
- **Wortzählung bleibt unverändert.** Der Algorithmus wird in M5 nicht angefasst.

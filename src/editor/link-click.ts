import type { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/**
 * Nur diese Schemata werden geöffnet — `javascript:` und `data:` sind
 * Angriffsvektoren. `http`/`https` erzwingen zwingend "//" — ohne das wäre
 * z.B. "https:evil.com" (kein vollständiger Schema-Trenner) fälschlich
 * erlaubt. Dieselbe Konstante dient zwei Zwecken (bewusst EINE einzige
 * Quelle, damit beide nicht wieder auseinanderdriften können — genau das
 * war zuvor die Ursache einer Sicherheitslücke):
 * 1. In `linkUrlAt` als finale Allowlist-Prüfung.
 * 2. In `normalizeBareUrl`, um zu erkennen, ob im Dokumenttext bereits ein
 *    Schema steht (dann keine Normalisierung, keine Verdopplung).
 * `mailto:` ist Teil der Allowlist — unkritisch, weil es nur bei explizit im
 * Dokument stehendem `mailto:`-Text oder nach der `normalizeBareUrl`-Prüfung
 * greift und nicht von beliebigem Linktext erzeugt werden kann.
 */
const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;

/** Erkennt eine (mutmaßliche) E-Mail-Adresse ohne Schema, z.B. "foo@example.com". */
const BARE_EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Erkennt eine nackte www.-Adresse ohne Schema, z.B. "www.example.com". */
const BARE_WWW = /^www\./i;

/**
 * Zeichen, die — unmittelbar vor einem `URL`-Knoten stehend — verraten, dass
 * dieser Knoten NICHT eigenständig ist, sondern Teil einer größeren URL im
 * Dokument. Hintergrund: GFM erzeugt für eine nackte URL mit Benutzerteil
 * (z.B. `https://admin@github.com/repo`) einen `URL`-Knoten NUR für den
 * Teilstring ab dem Benutzernamen (`admin@github.com`) — dieser Teilstring
 * sieht für sich genommen aus wie eine nackte E-Mail-Adresse. Ohne diese
 * Kontextprüfung würde `normalizeBareUrl` daraus fälschlich
 * `mailto:admin@github.com` machen, obwohl im Dokument nie eine E-Mail-Adresse
 * stand — ein Klick hätte dann das Mailprogramm statt die Website geöffnet.
 * `/`, `:`, `@` und `.` decken die Fortsetzung eines Schemas (`https://`,
 * `http:`), eines weiteren Benutzerteils (`user:pass@`) oder eines
 * vorangehenden Hostnamen-Teils ab.
 */
const URL_CONTINUATION_CHARS = new Set(['/', ':', '@', '.']);

/**
 * Normalisiert den Text eines nackten `URL`-Knotens (GFM-Autoerkennung ohne
 * Link/Autolink-Elternknoten) zu einer vollständigen URL mit Schema.
 *
 * - Steht bereits ein Schema im Text (`http://`, `https://`, `mailto:`),
 *   bleibt der Text unverändert (keine Verdopplung).
 * - `www.example.com` bekommt das Schema `https://` vorangestellt.
 * - Eine nackte E-Mail-Adresse (`@` enthalten, kein Schema) bekommt das
 *   Präfix `mailto:` vorangestellt — ABER NUR, wenn `precedingChar` (das
 *   Dokumentzeichen unmittelbar vor dem Knoten) keine Fortsetzung einer
 *   größeren URL anzeigt (siehe `URL_CONTINUATION_CHARS`). Die Schema-Prüfung
 *   läuft dabei ZUERST, damit z.B. `https://user@host/pfad` (URL mit
 *   Benutzerteil, hier bereits vollständig im Knoten enthalten) nicht
 *   fälschlich als E-Mail behandelt wird.
 * - Erkennt die Kontextprüfung eine Fortsetzung, liefert die Funktion `null`
 *   (konservativ: lieber kein Link öffnen als versehentlich das Mailprogramm).
 * - Alles andere (z.B. bereits vollständige http/https-URLs) bleibt unverändert.
 *
 * Reine Funktion — ohne DOM/Editor-State testbar. `precedingChar` ist
 * `undefined`, wenn der Knoten am Dokumentanfang steht.
 */
export function normalizeBareUrl(text: string, precedingChar: string | undefined): string | null {
  if (SAFE_SCHEME.test(text)) return text;
  if (BARE_WWW.test(text)) return `https://${text}`;
  if (BARE_EMAIL.test(text)) {
    if (precedingChar !== undefined && URL_CONTINUATION_CHARS.has(precedingChar)) return null;
    return `mailto:${text}`;
  }
  return text;
}

/** Sucht vom Knoten aufwärts den umschließenden Link- oder Autolink-Knoten. */
function enclosingLink(node: SyntaxNode | null): SyntaxNode | null {
  for (let current = node; current; current = current.parent) {
    if (current.name === 'Link' || current.name === 'Autolink') return current;
  }
  return null;
}

/**
 * Sucht vom Knoten aufwärts (und, falls nötig, im Knoten selbst) einen
 * `URL`-Knoten OHNE umschließenden `Link`/`Autolink`-Elternknoten — das ist
 * der Fall bei nackten URLs, die GFM direkt unter `Paragraph` erzeugt.
 * `resolveInner` liefert an einer Position innerhalb einer nackten URL
 * entweder den `URL`-Knoten selbst oder einen Nachfahren davon.
 */
function enclosingBareUrl(node: SyntaxNode | null): SyntaxNode | null {
  for (let current = node; current; current = current.parent) {
    if (current.name === 'URL') return current;
    // Sobald ein Link/Autolink erreicht ist, gehört die URL dorthin — das
    // behandelt bereits `enclosingLink`, hier also abbrechen.
    if (current.name === 'Link' || current.name === 'Autolink') return null;
  }
  return null;
}

/**
 * Liefert die Ziel-URL des Links an `pos`, oder `null`.
 *
 * Deckt drei Fälle ab: Markdown-Links (`[Text](url)`), Autolinks (`<url>`)
 * und nackte URLs (GFM-Autoerkennung, `URL`-Knoten direkt unter `Paragraph`).
 * Bei nackten URLs wird der Text normalisiert (`normalizeBareUrl`), bevor die
 * Schema-Prüfung läuft.
 *
 * `null` bei: keinem Link an der Position, fehlendem URL-Knoten, oder einem
 * normalisierten Schema außerhalb der Allowlist. Reine Funktion — ohne DOM
 * testbar.
 */
export function linkUrlAt(state: EditorState, pos: number): string | null {
  const resolved = syntaxTree(state).resolveInner(pos, 0);

  const link = enclosingLink(resolved);
  if (link) {
    const url = link.getChild('URL');
    if (!url) return null;
    const text = state.doc.sliceString(url.from, url.to);
    return SAFE_SCHEME.test(text) ? text : null;
  }

  const bareUrl = enclosingBareUrl(resolved);
  if (bareUrl) {
    // Zeichen unmittelbar vor dem Knoten: entscheidet, ob eine nackte
    // E-Mail-Adresse eigenständig ist oder Teil einer größeren URL (siehe
    // Doc-Kommentar von `normalizeBareUrl`). `undefined` am Dokumentanfang.
    const precedingChar = bareUrl.from > 0 ? state.doc.sliceString(bareUrl.from - 1, bareUrl.from) : undefined;
    const text = normalizeBareUrl(state.doc.sliceString(bareUrl.from, bareUrl.to), precedingChar);
    if (text === null) return null;
    return SAFE_SCHEME.test(text) ? text : null;
  }

  return null;
}

/**
 * Der mousedown-Handler als benannte Funktion: liefert `true`, wenn er den Klick
 * behandelt hat (Link geöffnet), sonst `false`. Separat exportiert, damit sich
 * die Entscheidungslogik ohne DOM-Layout testen lässt — `event.defaultPrevented`
 * taugt dafür nicht, weil CodeMirror bei simuliertem mousedown selbst
 * `preventDefault()` aufruft (auch mit leerer Extension-Liste).
 */
export function handleLinkMousedown(event: MouseEvent, view: EditorView): boolean {
  if (!event.metaKey && !event.ctrlKey) return false;

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos === null) return false;

  const url = linkUrlAt(view.state, pos);
  if (!url) return false;

  // noopener/noreferrer: die geöffnete Seite darf weder auf `window.opener`
  // zugreifen noch den Referrer sehen.
  window.open(url, '_blank', 'noopener,noreferrer');
  event.preventDefault();
  return true;
}

/**
 * Cmd/Ctrl+Klick öffnet den Link unter dem Zeiger in einem neuen Tab.
 *
 * Bewusst MODUSUNABHÄNGIG (fest in der Extension-Liste, außerhalb des
 * Live-Preview-Compartments) — es gibt keinen Grund, nützliche Navigation an den
 * Darstellungsmodus zu koppeln.
 */
export const linkClickExtension: Extension = EditorView.domEventHandlers({
  mousedown: handleLinkMousedown,
});

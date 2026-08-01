import type { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/**
 * Nur diese normalisierten Schemata werden geöffnet — `javascript:` und `data:`
 * sind Angriffsvektoren. `mailto:` ist erlaubt, weil es erst NACH der
 * Normalisierung geprüft wird (siehe `normalizeBareUrl`) und daher nicht von
 * beliebigem Linktext erzeugt werden kann.
 */
const SAFE_SCHEME = /^(https?|mailto):/i;

/** Ein Schema, das bereits explizit im Dokumenttext steht. */
const EXPLICIT_SCHEME = /^(https?:\/\/|mailto:)/i;

/** Erkennt eine (mutmaßliche) E-Mail-Adresse ohne Schema, z.B. "foo@example.com". */
const BARE_EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Erkennt eine nackte www.-Adresse ohne Schema, z.B. "www.example.com". */
const BARE_WWW = /^www\./i;

/**
 * Normalisiert den Text eines nackten `URL`-Knotens (GFM-Autoerkennung ohne
 * Link/Autolink-Elternknoten) zu einer vollständigen URL mit Schema.
 *
 * - Steht bereits ein Schema im Text (`http://`, `https://`, `mailto:`),
 *   bleibt der Text unverändert (keine Verdopplung).
 * - `www.example.com` bekommt das Schema `https://` vorangestellt.
 * - Eine nackte E-Mail-Adresse (`@` enthalten, kein Schema) bekommt das
 *   Präfix `mailto:` vorangestellt. Die Schema-Prüfung läuft ZUERST, damit
 *   z.B. `https://user@host/pfad` (URL mit Benutzerteil) nicht fälschlich
 *   als E-Mail behandelt wird.
 * - Alles andere (z.B. bereits vollständige http/https-URLs) bleibt unverändert.
 *
 * Reine Funktion — ohne DOM/Editor-State testbar.
 */
export function normalizeBareUrl(text: string): string {
  if (EXPLICIT_SCHEME.test(text)) return text;
  if (BARE_WWW.test(text)) return `https://${text}`;
  if (BARE_EMAIL.test(text)) return `mailto:${text}`;
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
    const text = normalizeBareUrl(state.doc.sliceString(bareUrl.from, bareUrl.to));
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

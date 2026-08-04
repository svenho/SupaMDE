import type { EditorView } from '@codemirror/view';
import type { DocChange, SupaCommand } from './types';
import { stripLinePrefix } from './prefixes';
import { dispatchLineChanges, selectedLineRange, toggleLinePrefix } from '../utils/text';

/**
 * Ein ungeordneter Bullet-Marker (`- ` oder `* `), ohne führende Einrückung.
 * Vollständig verankert (`$`), damit das Checklisten-Präfix `- [ ] ` NICHT als
 * Bullet durchgeht — es beginnt zwar mit `- `, ist aber ein eigener Präfix-Typ.
 */
const BULLET_PREFIX = /^[-*] $/;

/**
 * Zerlegt eine Zeile in Einrückung, einen etwaigen Bullet-Marker und die Frage,
 * ob überhaupt ein bekanntes Präfix vorliegt. Checklisten, geordnete Listen,
 * Headings und Zitate liefern `bullet: null` bei `hasPrefix: true` — sie werden
 * vom Bullet-Toggle bewusst nicht angefasst.
 */
function splitBullet(text: string): { indent: string; bullet: string | null; hasPrefix: boolean } {
  const stripped = stripLinePrefix(text);
  if (stripped === null) {
    return { indent: /^[ \t]*/.exec(text)![0], bullet: null, hasPrefix: false };
  }
  const isBullet = BULLET_PREFIX.test(stripped.prefix);
  return { indent: stripped.indent, bullet: isBullet ? stripped.prefix : null, hasPrefix: true };
}

/**
 * Toggelt einen ungeordneten Bullet-Marker über die Selektion mit Konvertier-
 * Semantik, sodass NIE ein zweiter Marker davorgesetzt wird:
 * - Tragen ALLE Zeilen bereits exakt `marker`, wird er entfernt (Toggle-Off).
 * - Sonst wird jede Zeile auf `marker` gebracht: ein vorhandener Fremd-Bullet
 *   (`- ` ↔ `* `) wird ERSETZT (Konvertierung), Klartextzeilen bekommen `marker`.
 *
 * Alle Eingriffe erfolgen HINTER der Einrückung, damit verschachtelte Listen ihre
 * Ebene behalten; die Einrückung selbst bleibt auch beim Toggle-Off erhalten.
 * Checklisten (`- [ ] `) und geordnete Listen (`1. `) bleiben unberührt.
 */
function toggleBulletList(view: EditorView, marker: '- ' | '* '): boolean {
  const range = selectedLineRange(view.state);
  const lines = [];
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    lines.push({ from: line.from, ...splitBullet(line.text) });
  }

  // Toggle-Off nur, wenn wirklich JEDE Zeile den Ziel-Marker trägt. Nicht-Bullets
  // (Checkliste, geordnet) verhindern das und lösen stattdessen ein Setzen aus.
  const allHaveMarker = lines.every((l) => l.bullet === marker);

  const changes: DocChange[] = [];
  for (const line of lines) {
    const { indent, bullet, hasPrefix } = line;
    // Ab hier ist der Marker-Bereich der Zeile: [markerFrom, markerFrom + bullet.length).
    const markerFrom = line.from + indent.length;
    if (allHaveMarker) {
      // Toggle-Off: den (überall gleichen) Marker entfernen, Einrückung behalten.
      changes.push({ from: markerFrom, to: markerFrom + marker.length, insert: '' });
    } else if (bullet !== null) {
      // Fremd-Bullet → auf den Ziel-Marker konvertieren.
      changes.push({ from: markerFrom, to: markerFrom + bullet.length, insert: marker });
    } else if (!hasPrefix) {
      // Klartext → Ziel-Marker hinter der Einrückung setzen.
      changes.push({ from: markerFrom, to: markerFrom, insert: marker });
    }
    // Checkliste/geordnete Liste/Heading/Zitat: keine Änderung.
  }

  if (changes.length === 0) return false;
  dispatchLineChanges(view, changes);
  return true;
}

/** Ungeordnete Liste mit Spiegelstrich (`- `) ein-/ausschalten (Default, Cmd+L). */
export const unorderedList: SupaCommand = (view) => toggleBulletList(view, '- ');

/** Ungeordnete Liste mit Sternchen (`* `) ein-/ausschalten (Shift+Alt+Cmd+L). */
export const unorderedListStar: SupaCommand = (view) => toggleBulletList(view, '* ');

/** Checkliste (`- [ ] `) je Zeile ein-/ausschalten. */
export const checkList: SupaCommand = (view) => toggleLinePrefix(view, '- [ ] ');

/** Geordnete Liste (`1. `, `2. `, …) fortlaufend setzen bzw. entfernen. */
export const orderedList: SupaCommand = (view) => {
  const range = selectedLineRange(view.state);
  // Wenn ALLE Zeilen bereits nummeriert sind → entfernen.
  let allNumbered = true;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    if (!/^\d+\. /.test(view.state.doc.line(n).text)) {
      allNumbered = false;
      break;
    }
  }
  const changes: DocChange[] = [];
  let counter = 1;
  for (let n = range.firstLine; n <= range.lastLine; n++) {
    const line = view.state.doc.line(n);
    if (allNumbered) {
      const match = /^\d+\. /.exec(line.text);
      const len = match ? match[0].length : 0;
      changes.push({ from: line.from, to: line.from + len, insert: '' });
    } else {
      changes.push({ from: line.from, to: line.from, insert: `${counter}. ` });
      counter++;
    }
  }
  dispatchLineChanges(view, changes);
  return true;
};

/**
 * Berechnet aus einem erkannten Ist-Präfix das Präfix für die FORTSETZUNGSZEILE:
 * geordnete Listen werden inkrementiert (`3. ` → `4. `), Checklisten starten leer
 * (`- [x] ` → `- [ ] `), ungeordnete behalten ihren Marker (`* ` oder Bestands-`- `).
 * `null`, wenn kein Listenpräfix.
 */
function continuationPrefix(currentPrefix: string): string | null {
  if (/^- \[[ xX]\] $/.test(currentPrefix)) return '- [ ] ';
  const ordered = /^(\d+)\. $/.exec(currentPrefix);
  if (ordered) return `${Number(ordered[1]) + 1}. `;
  // Bullet-Marker der aktuellen Zeile beibehalten (`* ` oder ein Bestands-`- `).
  if (currentPrefix === '* ' || currentPrefix === '- ') return currentPrefix;
  return null;
}

/**
 * Enter-Handler für Listen: setzt Einrückung und Präfix in der neuen Zeile fort;
 * ist die aktuelle Listenzeile leer (nur Einrückung + Präfix), wird die Liste
 * beendet — die Zeile wird geleert, der Cursor bleibt an ihrem Anfang stehen.
 * `false`, wenn die Cursorzeile keine Liste ist (Standard-Enter greift dann).
 *
 * Die Präfix-Erkennung teilt sich mit `cleanBlock` die zentrale `stripLinePrefix`
 * (Task 1); nur die Fortsetzungs-Logik (Inkrement) ist listenspezifisch.
 */
export function continueList(view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.head);
  const stripped = stripLinePrefix(line.text);
  if (stripped === null) return false;
  // Heading/Quote sind zwar Präfixe, aber keine Listen → Standard-Enter.
  const prefix = continuationPrefix(stripped.prefix);
  if (prefix === null) return false;

  if (stripped.rest.length === 0) {
    // Leere Listenzeile → Liste beenden: Einrückung UND Marker entfernen, die Zeile
    // selbst aber behalten. Der Cursor landet dadurch am Anfang derselben Zeile —
    // es entsteht KEINE zusätzliche Leerzeile.
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    });
    return true;
  }

  // Fortsetzung erbt die Einrückung der aktuellen Zeile, damit Unterlisten auf
  // ihrer Ebene bleiben.
  const insert = `\n${stripped.indent}${prefix}`;
  view.dispatch({
    changes: { from: sel.head, insert },
    selection: { anchor: sel.head + insert.length },
  });
  return true;
}

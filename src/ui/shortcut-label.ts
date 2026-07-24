/**
 * Erkennt, ob die aktuelle Plattform macOS ist.
 * Nutzt `navigator.userAgentData?.platform` mit Fallback auf `navigator.userAgent`.
 */
function detectMac(): boolean {
  try {
    // `navigator.userAgentData` ist nur in modernen Browsern verfügbar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (typeof navigator !== 'undefined' && nav.userAgentData?.platform) {
      return nav.userAgentData.platform.toLowerCase().includes('mac');
    }
    // Fallback auf userAgent (deprecated, aber breit unterstützt)
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return /mac/i.test(navigator.userAgent);
    }
  } catch {
    // In Nicht-Browser-Umgebungen (Node.js, etc.) — Default zu false
  }
  return false;
}

/**
 * Plattformabhängiges Shortcut-Kürzel: `default` gilt für alle Plattformen außer Mac,
 * `mac` überschreibt die Anzeige (und ggf. Bindung) auf macOS. Nötig für Fälle wie
 * redo, wo CM6s `historyKeymap` auf Mac `Mod-Shift-z` statt `Mod-y` bindet.
 */
export interface PlatformShortcut {
  default: string;
  mac: string;
}

/**
 * Formatiert einen CM6-Shortcut-String lesbar für die UI.
 *
 * Eingabeformat: CM6-kompatible Strings wie 'Mod-b', 'Shift-Mod-h', 'Mod-Alt-c', etc.
 * Segmente sind mit `-` getrennt; alle außer dem letzten sind Modifier.
 *
 * Alternativ akzeptiert die Funktion ein plattformabhängiges Kürzel-Objekt
 * `{ default, mac }` — auf Mac wird dann `mac` formatiert, sonst `default`.
 *
 * @param shortcut Der zu formatierende Shortcut-String (z.B. 'Mod-b') oder ein
 *   plattformabhängiges Kürzel-Objekt (z.B. `{ default: 'Mod-y', mac: 'Mod-Shift-z' }`)
 * @param isMac Optionales Flag, um Plattform zu überschreiben (Default: auto-erkannt)
 * @returns Formatierter Shortcut (z.B. '⌘B' auf Mac, 'Ctrl+B' sonst)
 */
export function formatShortcut(shortcut: string | PlatformShortcut, isMac?: boolean): string {
  const platform = isMac ?? detectMac();

  // Bei plattformabhängigem Objekt zuerst den passenden String auflösen.
  const resolved = typeof shortcut === 'string' ? shortcut : platform ? shortcut.mac : shortcut.default;

  // Shortcut in Segmente zerlegen
  const segments = resolved.split('-');
  if (segments.length === 0) {
    return resolved;
  }

  // Letztes Segment ist die Taste; alle anderen sind Modifier
  const keySegment = segments[segments.length - 1];
  if (!keySegment) {
    return resolved;
  }
  const key = keySegment;
  const modifiers = segments.slice(0, -1);

  if (platform) {
    return formatMac(modifiers, key);
  } else {
    return formatNonMac(modifiers, key);
  }
}

/**
 * Formatiert macOS-Style: zusammengezogene Symbole, Taste groß.
 * Reihenfolge: Ctrl/Cmd-Cluster (Mod→⌘, Cmd→⌘, Ctrl→⌃), dann Alt/Option, dann Shift, dann Taste.
 * KRITISCH: Ctrl bleibt auf Mac als ⌃ (Control), nur Mod wird zu ⌘ (Cmd).
 */
function formatMac(modifiers: string[], key: string): string {
  // Normalisiere und ordne Modifier
  const normalized: string[] = [];
  let hasMod = false;
  let hasCmd = false;
  let hasCtrl = false;
  let hasAlt = false;
  let hasShift = false;

  for (const mod of modifiers) {
    if (mod === 'Mod') {
      hasMod = true;
    } else if (mod === 'Cmd') {
      hasCmd = true;
    } else if (mod === 'Ctrl') {
      hasCtrl = true;
    } else if (mod === 'Alt') {
      hasAlt = true;
    } else if (mod === 'Shift') {
      hasShift = true;
    }
  }

  // Baue in Reihenfolge auf: Mod/Cmd/Ctrl, Alt, Shift
  if (hasMod) {
    normalized.push('⌘');
  }
  if (hasCmd) {
    normalized.push('⌘');
  }
  if (hasCtrl) {
    normalized.push('⌃');
  }
  if (hasAlt) {
    normalized.push('⌥');
  }
  if (hasShift) {
    normalized.push('⇧');
  }

  // Taste großschreiben und zusammensetzen
  const upperKey = key.length === 1 ? key.toUpperCase() : key;
  return normalized.join('') + upperKey;
}

/**
 * Formatiert non-Mac-Style: mit `+` getrennte Modifier, Taste groß.
 * Reihenfolge: Ctrl, dann Alt, dann Shift, dann Taste.
 */
function formatNonMac(modifiers: string[], key: string): string {
  // Normalisiere und ordne Modifier
  const normalized: string[] = [];
  let hasCtrl = false;
  let hasAlt = false;
  let hasShift = false;

  for (const mod of modifiers) {
    if (mod === 'Mod' || mod === 'Ctrl') {
      hasCtrl = true;
    } else if (mod === 'Alt') {
      hasAlt = true;
    } else if (mod === 'Shift') {
      hasShift = true;
    }
  }

  // Baue in Reihenfolge auf
  if (hasCtrl) {
    normalized.push('Ctrl');
  }
  if (hasAlt) {
    normalized.push('Alt');
  }
  if (hasShift) {
    normalized.push('Shift');
  }

  // Taste großschreiben und zusammensetzen
  const upperKey = key.length === 1 ? key.toUpperCase() : key;
  normalized.push(upperKey);
  return normalized.join('+');
}

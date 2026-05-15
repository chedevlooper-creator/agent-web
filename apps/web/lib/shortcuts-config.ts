/**
 * Shortcuts Configuration System
 *
 * Central definition of all keyboard shortcuts, including defaults,
 * parsing/matching utilities, and a resolution function that applies
 * user overrides from the store.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShortcutDefinition {
  /** Unique stable ID (used in store overrides) */
  id: string;
  /** Default key combos (e.g. ["Ctrl+B"]) */
  defaultKeys: readonly string[];
  /** Human-readable label */
  label: string;
  /** Short description shown in help dialog */
  description: string;
  /** Category for grouping in help dialog */
  category: string;
  /** Which handler owns this shortcut (for context-aware dispatching) */
  handler?: "page" | "context-panel" | "settings-panel" | "document-panel";
}

export type ShortcutOverrides = Record<string, string[]>;

export interface ParsedShortcut {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  // ── General ──────────────────────────────────────────────────────────
  {
    id: "toggle-shortcuts",
    defaultKeys: ["?", "Ctrl+/"],
    label: "Kısayollar",
    description: "Kısayol yardımını aç/kapa",
    category: "Genel",
    handler: "page",
  },
  {
    id: "toggle-context-panel",
    defaultKeys: ["Ctrl+B"],
    label: "Context panel",
    description: "Context paneli aç/kapa",
    category: "Genel",
    handler: "page",
  },
  {
    id: "toggle-settings",
    defaultKeys: ["Ctrl+,"],
    label: "Ayarlar",
    description: "Ayarları aç/kapa",
    category: "Genel",
    handler: "page",
  },

  // ── Context Panel Tabs ───────────────────────────────────────────────
  {
    id: "context-tab-1",
    defaultKeys: ["Alt+1"],
    label: "Tools",
    description: "Tools sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-2",
    defaultKeys: ["Alt+2"],
    label: "Memory",
    description: "Memory sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-3",
    defaultKeys: ["Alt+3"],
    label: "Skills",
    description: "Skills sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-4",
    defaultKeys: ["Alt+4"],
    label: "Agents",
    description: "Agents sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-5",
    defaultKeys: ["Alt+5"],
    label: "Cron",
    description: "Cron sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-6",
    defaultKeys: ["Alt+6"],
    label: "Search",
    description: "Search sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },
  {
    id: "context-tab-7",
    defaultKeys: ["Alt+7"],
    label: "Documents",
    description: "Documents sekmesi",
    category: "Context Paneli",
    handler: "context-panel",
  },

  // ── Settings Panel Tabs ──────────────────────────────────────────────
  {
    id: "settings-tab-1",
    defaultKeys: ["Alt+1"],
    label: "Provider",
    description: "Provider ayarları",
    category: "Ayarlar",
    handler: "settings-panel",
  },
  {
    id: "settings-tab-2",
    defaultKeys: ["Alt+2"],
    label: "MCP",
    description: "MCP ayarları",
    category: "Ayarlar",
    handler: "settings-panel",
  },
  {
    id: "settings-tab-3",
    defaultKeys: ["Alt+3"],
    label: "Skills",
    description: "Skills ayarları",
    category: "Ayarlar",
    handler: "settings-panel",
  },
  {
    id: "settings-tab-4",
    defaultKeys: ["Alt+4"],
    label: "Memory",
    description: "Memory ayarları",
    category: "Ayarlar",
    handler: "settings-panel",
  },
  {
    id: "settings-tab-5",
    defaultKeys: ["Alt+5"],
    label: "Agents",
    description: "Agents ayarları",
    category: "Ayarlar",
    handler: "settings-panel",
  },

  // ── Documents ────────────────────────────────────────────────────────
  {
    id: "close-preview",
    defaultKeys: ["Escape"],
    label: "Önizleme kapat",
    description: "Önizlemeyi kapat",
    category: "Dokümanlar",
    handler: "document-panel",
  },
  {
    id: "upload-document",
    defaultKeys: ["Ctrl+U"],
    label: "Dosya yükle",
    description: "Dosya yükle",
    category: "Dokümanlar",
    handler: "document-panel",
  },
  {
    id: "delete-document",
    defaultKeys: ["Delete"],
    label: "Doküman sil",
    description: "Seçili dokümanı sil",
    category: "Dokümanlar",
    handler: "document-panel",
  },
];

// ─── Lookup ──────────────────────────────────────────────────────────────────

const defsById = new Map<string, ShortcutDefinition>(
  SHORTCUT_DEFINITIONS.map((d) => [d.id, d])
);

export function getShortcutDef(id: string): ShortcutDefinition | undefined {
  return defsById.get(id);
}

/**
 * Resolve the key strings for a shortcut ID, applying user overrides.
 */
export function getShortcutKeys(
  id: string,
  overrides?: ShortcutOverrides
): readonly string[] {
  if (overrides && overrides[id] && overrides[id].length > 0) {
    return overrides[id];
  }
  return defsById.get(id)?.defaultKeys ?? [];
}

// ─── Parsing & matching ──────────────────────────────────────────────────────

/**
 * Parse a shortcut string like "Ctrl+Shift+B" into a predicate object.
 */
export function parseShortcut(keyStr: string): ParsedShortcut {
  const parts = keyStr.split("+");
  const rawKey = parts[parts.length - 1];

  // Normalize letter keys to lowercase for matching
  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;

  const mods = {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
  };

  for (let i = 0; i < parts.length - 1; i++) {
    const m = parts[i].toLowerCase();
    if (m === "ctrl" || m === "control") mods.ctrlKey = true;
    else if (m === "alt" || m === "option") mods.altKey = true;
    else if (m === "shift") mods.shiftKey = true;
    else if (m === "cmd" || m === "meta" || m === "command") mods.metaKey = true;
  }

  return { key, ...mods };
}

/**
 * Check if a KeyboardEvent matches a parsed shortcut.
 */
/**
 * Check if a KeyboardEvent matches a parsed shortcut.
 * Uses one-way matching: only requires that specified modifiers ARE pressed,
 * but doesn't require unspecified modifiers to be absent.
 * This allows "?" to match (key ., shiftKey=true) since Shift isn't 
 * explicitly required, and "Ctrl+B" to match "b" or "B" (case-insensitive).
 */
export function matchParsedShortcut(
  e: KeyboardEvent,
  parsed: ParsedShortcut
): boolean {
  // Case-insensitive key comparison for single-character keys
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const parsedKey = parsed.key.length === 1 ? parsed.key.toLowerCase() : parsed.key;
  if (eventKey !== parsedKey) return false;

  // One-way modifier matching: only check that required modifiers ARE pressed
  if (parsed.ctrlKey && !e.ctrlKey) return false;
  if (parsed.altKey && !e.altKey) return false;
  if (parsed.metaKey && !e.metaKey) return false;
  if (parsed.shiftKey && !e.shiftKey) return false;
  return true;
}

/**
 * Check if a KeyboardEvent matches any of the given shortcut strings.
 * Returns the matching shortcut string or undefined.
 */
export function matchAnyShortcut(
  e: KeyboardEvent,
  shortcutStrs: readonly string[]
): string | undefined {
  for (const str of shortcutStrs) {
    if (matchParsedShortcut(e, parseShortcut(str))) return str;
  }
  return undefined;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format a shortcut string for display (e.g. "Ctrl+B").
 * The input is already in display format, so this is an identity
 * for most cases.
 */
export function formatShortcut(keyStr: string): string {
  return keyStr;
}

/**
 * Reconstruct a shortcut string from a KeyboardEvent.
 */
export function eventToShortcutString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Cmd");

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join("+");
}

// ─── Categories & grouping ───────────────────────────────────────────────────

export function getCategoriesWithShortcuts(
  overrides?: ShortcutOverrides
): Array<{ title: string; shortcuts: Array<{ id: string; keys: readonly string[]; description: string; label: string }> }> {
  const groups = new Map<string, ShortcutDefinition[]>();
  for (const def of SHORTCUT_DEFINITIONS) {
    const existing = groups.get(def.category) ?? [];
    existing.push(def);
    groups.set(def.category, existing);
  }

  return Array.from(groups.entries()).map(([title, defs]) => ({
    title,
    shortcuts: defs.map((d) => ({
      id: d.id,
      keys: getShortcutKeys(d.id, overrides),
      description: d.description,
      label: d.label,
    })),
  }));
}

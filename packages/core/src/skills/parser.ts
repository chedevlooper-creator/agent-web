/**
 * SKILL.md format parser
 * Parses YAML frontmatter from markdown content
 */

export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  platforms?: string[]; // macos, linux, windows
  required_environment_variables?: Array<{
    name: string;
    prompt: string;
    help: string;
    required_for: string;
  }>;
  metadata?: {
    hermes?: {
      tags: string[];
      category: string;
      fallback_for_toolsets?: string[];
      requires_toolsets?: string[];
      fallback_for_tools?: string[];
      requires_tools?: string[];
      config?: Array<{
        key: string;
        description: string;
        default: string;
        prompt: string;
      }>;
    };
  };
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string; // markdown content after frontmatter
  raw: string; // full raw content
}

/**
 * Parse YAML frontmatter from markdown skill content.
 * Format:
 * ---
 * name: my-skill
 * description: Brief description
 * version: 1.0.0
 * ---
 * # Skill content
 */
export function parseSkillMarkdown(raw: string): ParsedSkill | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatterStr = match[1];
  const body = match[2] || "";

  const frontmatter = parseYamlSimple(frontmatterStr) as unknown as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  if (!frontmatter.version) {
    frontmatter.version = "1.0.0";
  }

  return {
    frontmatter,
    body,
    raw,
  };
}

/**
 * Simple YAML parser for skill frontmatter.
 * Handles basic key-value, arrays, and nested objects.
 */
function parseYamlSimple(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey = "";
  let currentArray: string[] = [];
  let currentObject: Record<string, unknown> = {};
  let inArray = false;
  let inObject = false;
  let objectDepth = 0;

  function flushCurrent() {
    if (currentKey && inArray && currentArray.length > 0) {
      result[currentKey] = currentArray;
    } else if (currentKey && inObject) {
      result[currentKey] = currentObject;
    }
    currentKey = "";
    currentArray = [];
    currentObject = {};
    inArray = false;
    inObject = false;
    objectDepth = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a list item
    if (trimmed.startsWith("- ") && inArray) {
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    // Check if this is a nested object line
    if (line.startsWith("  ") && currentKey && !inArray) {
      const parts = trimmed.split(": ");
      const key = parts[0];
      const value = parts.slice(1).join(": ").trim();

      if (value === "" || value === "{}") {
        // Nested object start
        if (!inObject) {
          inObject = true;
          objectDepth = line.length - line.trimStart().length;
        }
        continue;
      }

      // Nested object property
      if (inObject) {
        const parsed = parseYamlValue(value);
        if (parsed !== null) currentObject[key] = parsed;
        continue;
      }
    }

    // If we were in an array or object, flush
    if (inArray || inObject) {
      flushCurrent();
    }

    // Check for array
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    if (valueStr.startsWith("[")) {
      // Inline array: [a, b, c]
      const arrStr = valueStr.slice(1, -1);
      result[key] = arrStr.split(",").map((s) => s.trim().replace(/['"]/g, ""));
    } else if (valueStr === "") {
      // Could be array or object - check next line
      currentKey = key;
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
        inArray = true;
      } else {
        inObject = true;
      }
    } else {
      result[key] = parseYamlValue(valueStr);
    }
  }

  // Flush last
  if (inArray || inObject) {
    flushCurrent();
  }

  return result;
}

function parseYamlValue(value: string): unknown {
  if (!value) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

  // Remove quotes
  const unquoted = value.replace(/^['"](.*)['"]$/, "$1");
  return unquoted;
}

/**
 * Convert skill metadata to JSON frontmatter for DB storage
 */
export function serializeFrontmatter(frontmatter: SkillFrontmatter): string {
  return JSON.stringify(frontmatter);
}

/**
 * Build SKILL.md content from frontmatter and body
 */
export function buildSkillMarkdown(frontmatter: SkillFrontmatter, body: string): string {
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => typeof v === "string" ? `"${v}"` : v).join(", ")}]`;
      }
      if (typeof value === "object" && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    })
    .join("\n");

  return `---\n${yaml}\n---\n${body}`;
}

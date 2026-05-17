import "server-only";
import { promises as fs } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { DbSession, DbMessage } from "./db";

const AGENT_WEB_DIR = "Agent Web";

const ROLE_LABELS: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
};

/**
 * Escape text for safe inclusion in YAML frontmatter string values.
 */
function yamlStr(value: string): string {
  if (/[:\[\]{}&#*!|>'"%@`]/.test(value) || value.includes("\n")) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Format a Unix-millisecond timestamp to ISO string for frontmatter.
 */
function fmtIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Format a Unix-millisecond timestamp to a short time string like "09:30".
 */
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formats a single message body as Markdown, preserving code blocks.
 */
function formatMessageContent(content: string): string {
  return content.trim();
}

/**
 * Render a full session to an Obsidian Markdown string with YAML frontmatter.
 */
export function renderSessionToMarkdown(
  session: DbSession,
  messages: DbMessage[],
  options?: { provider?: string; model?: string }
): string {
  const title = session.title || "Untitled Chat";
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`title: ${yamlStr(title)}`);
  lines.push(`created: ${fmtIso(session.createdAt)}`);
  lines.push(`updated: ${fmtIso(session.updatedAt)}`);
  lines.push(`session_id: "${session.id}"`);
  if (options?.model) {
    lines.push(`model: ${yamlStr(options.model)}`);
  }
  if (options?.provider) {
    lines.push(`provider: ${yamlStr(options.provider)}`);
  }
  lines.push("tags: [agent-web]");
  lines.push("---");
  lines.push("");

  // Heading
  lines.push(`# ${title}`);
  lines.push("");

  // Messages
  if (messages.length === 0) {
    lines.push("*No messages in this session.*");
    lines.push("");
  } else {
    lines.push("## Messages");
    lines.push("");

    for (const msg of messages) {
      const roleLabel = ROLE_LABELS[msg.role] || msg.role;
      const modelTag = msg.model ? ` — ${msg.model}` : "";
      const timeStr = fmtTime(msg.timestamp);
      lines.push(`### ${roleLabel}${modelTag} (${timeStr})`);
      lines.push("");
      lines.push(formatMessageContent(msg.content));
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Derive a safe filesystem-safe filename from the session title + date.
 */
function sessionFilename(session: DbSession): string {
  const date = new Date(session.createdAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const safeTitle = (session.title || "Untitled Chat")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${yyyy}-${mm}-${dd} - ${safeTitle}.md`;
}

/**
 * Check that a vault path is valid (exists and is a directory).
 */
export async function validateVaultPath(vaultPath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(vaultPath);
    if (!stat.isDirectory()) {
      return `Path exists but is not a directory: ${vaultPath}`;
    }
    return null; // valid
  } catch {
    return `Vault directory does not exist: ${vaultPath}`;
  }
}

/**
 * Resolve the vault path from DB config or env var.
 */
export function resolveVaultPath(): string | null {
  return process.env.OBSIDIAN_VAULT_PATH || null;
}

/**
 * Get the full vault target directory (resolved, with "Agent Web" subfolder).
 */
function vaultTargetDir(vaultPath: string): string {
  return resolve(join(vaultPath, AGENT_WEB_DIR));
}

/**
 * Sync a session to the Obsidian vault.
 * Returns the path of the written file, or null if vault path is not configured.
 */
export async function syncSessionToVault(
  session: DbSession,
  messages: DbMessage[],
  vaultPath: string,
  options?: { provider?: string; model?: string }
): Promise<string> {
  const targetDir = vaultTargetDir(vaultPath);

  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });

  // Detect model/provider from messages if not explicitly passed
  const opts = { ...options };
  if (!opts.model || !opts.provider) {
    const assistantMsgs = messages.filter((m) => m.role === "assistant" && m.model);
    if (assistantMsgs.length > 0) {
      const lastModel = assistantMsgs[assistantMsgs.length - 1].model;
      if (lastModel) opts.model = opts.model || lastModel;
    }
  }

  const markdown = renderSessionToMarkdown(session, messages, opts);
  const filename = sessionFilename(session);
  const targetPath = resolve(join(targetDir, filename));

  // Path traversal protection: ensure the resolved path is within the target dir
  const rel = relative(targetDir, targetPath);
  if (rel.startsWith("..") || rel.startsWith("/") || rel.startsWith("\\")) {
    throw new Error("Path traversal detected — refusing to write outside vault directory");
  }

  // Atomic write: write to .tmp then rename
  const tmpPath = targetPath + ".tmp";
  await fs.writeFile(tmpPath, markdown, "utf-8");
  await fs.rename(tmpPath, targetPath);

  return targetPath;
}

/**
 * Delete a session's markdown file from the Obsidian vault.
 * Returns the deleted file path, or null if no file was found.
 */
export async function deleteSessionFromVault(
  session: DbSession,
  vaultPath: string
): Promise<string | null> {
  const targetDir = vaultTargetDir(vaultPath);
  const filename = sessionFilename(session);
  const targetPath = resolve(join(targetDir, filename));

  // Path traversal protection
  const rel = relative(targetDir, targetPath);
  if (rel.startsWith("..") || rel.startsWith("/") || rel.startsWith("\\")) {
    throw new Error("Path traversal detected");
  }

  try {
    await fs.unlink(targetPath);
    return targetPath;
  } catch {
    // File doesn't exist — that's fine
    return null;
  }
}

/**
 * List all synced Obsidian notes for the current user (the "Agent Web" directory).
 */
export async function listVaultNotes(vaultPath: string): Promise<string[]> {
  const targetDir = vaultTargetDir(vaultPath);
  try {
    const entries = await fs.readdir(targetDir);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

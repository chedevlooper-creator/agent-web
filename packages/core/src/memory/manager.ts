import { db, memoryEntries, messages } from "@agent-web/db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { getMemoryUsage, searchSessions } from "@agent-web/db";

export const MEMORY_CHAR_LIMIT = parseInt(process.env.MEMORY_CHAR_LIMIT ?? "2200", 10);
export const USER_CHAR_LIMIT = parseInt(process.env.USER_CHAR_LIMIT ?? "1375", 10);

export interface MemoryQuery {
  query?: string;
  category?: string;
  limit?: number;
  sessionId?: string;
}

export class MemoryManager {
  async addEntry(opts: {
    key: string;
    value: string;
    category?: "user_pref" | "fact" | "task" | "insight" | "project";
    importance?: number;
    sessionId?: string;
    sourceMessageId?: string;
    target?: "memory" | "user";
  }) {
    const id = crypto.randomUUID();
    await db.insert(memoryEntries).values({
      id,
      key: opts.key,
      value: opts.value,
      category: opts.category ?? "fact",
      importance: opts.importance ?? 5,
      sessionId: opts.sessionId ?? null,
      sourceMessageId: opts.sourceMessageId ?? null,
      target: opts.target ?? "memory",
    });
    return id;
  }

  /**
   * Add entry with char limit enforcement (Hermes pattern)
   */
  async addEntryWithLimit(target: "memory" | "user", content: string, key?: string): Promise<{ success: boolean; error?: string }> {
    const usage = await getMemoryUsage();
    const limit = target === "memory" ? MEMORY_CHAR_LIMIT : USER_CHAR_LIMIT;
    const currentUsage = target === "memory" ? usage.memory : usage.user;

    if (currentUsage + content.length > limit) {
      return {
        success: false,
        error: `${target === "memory" ? "Memory" : "User profile"} at ${currentUsage}/${limit} chars. Adding this entry (${content.length} chars) would exceed the limit. Replace or remove existing entries first.`,
      };
    }

    await this.addEntry({
      key: key ?? `Entry ${new Date().toISOString().slice(0, 10)}`,
      value: content,
      category: "fact",
      importance: 5,
      target,
    });
    return { success: true };
  }

  /**
   * Replace entry via substring matching (Hermes pattern)
   */
  async replaceEntry(target: "memory" | "user", oldText: string, newContent: string): Promise<{ success: boolean; error?: string }> {
    const entries = await this.getRelevant({ query: oldText, limit: 50 });
    const matches = entries
      .filter((e) => e.target === target)
      .filter((e) => e.value.includes(oldText) || e.key.includes(oldText));

    if (matches.length === 0) {
      return { success: false, error: `No entry found matching "${oldText}".` };
    }
    if (matches.length > 1) {
      return { success: false, error: `Multiple entries match "${oldText}". Please use a more specific substring.` };
    }

    // Remove old, add new
    await this.deleteEntry(matches[0].id);
    await this.addEntry({
      key: matches[0].key,
      value: newContent,
      category: matches[0].category as any,
      importance: matches[0].importance,
      target,
    });

    return { success: true };
  }

  /**
   * Remove entry via substring matching
   */
  async removeEntry(target: "memory" | "user", oldText: string): Promise<{ success: boolean; error?: string }> {
    const entries = await this.getRelevant({ query: oldText, limit: 50 });
    const matches = entries
      .filter((e) => e.target === target)
      .filter((e) => e.value.includes(oldText) || e.key.includes(oldText));

    if (matches.length === 0) {
      return { success: false, error: `No entry found matching "${oldText}".` };
    }
    if (matches.length > 1) {
      return { success: false, error: `Multiple entries match "${oldText}".` };
    }

    await this.deleteEntry(matches[0].id);
    return { success: true };
  }

  async getRelevant(opts: MemoryQuery) {
    const limit = opts.limit ?? 20;
    const conditions = [];
    if (opts.category) {
      conditions.push(eq(memoryEntries.category, opts.category as any));
    }
    if (opts.sessionId) {
      conditions.push(eq(memoryEntries.sessionId, opts.sessionId));
    }
    if (opts.query) {
      conditions.push(
        sql`${memoryEntries.key} || ' ' || ${memoryEntries.value} LIKE ${"%" + opts.query + "%"}`
      );
    }

    const rows = await db
      .select()
      .from(memoryEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt))
      .limit(limit);
    return rows;
  }

  async getByTarget(target: "memory" | "user") {
    return db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.target, target))
      .orderBy(desc(memoryEntries.importance), desc(memoryEntries.createdAt));
  }

  async getByCategory(category: string) {
    return db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.category, category as any))
      .orderBy(desc(memoryEntries.createdAt));
  }

  async deleteEntry(id: string) {
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  /**
   * Format memory entries as MEMORY.md block for system prompt
   */
  async loadMemoryMd(): Promise<string> {
    const entries = await this.getByTarget("memory");
    if (entries.length === 0) return "";

    const text = entries.map((e) => `${e.key}: ${e.value}`).join("\n§\n");
    const charCount = text.length;
    const percentage = Math.round((charCount / MEMORY_CHAR_LIMIT) * 100);

    return `\n\n══════════════════════════════════════════════\nMEMORY (your personal notes) [${percentage}% — ${charCount}/${MEMORY_CHAR_LIMIT} chars]\n══════════════════════════════════════════════\n${text}`;
  }

  /**
   * Format user entries as USER.md block for system prompt
   */
  async loadUserMd(): Promise<string> {
    const entries = await this.getByTarget("user");
    if (entries.length === 0) return "";

    const text = entries.map((e) => `${e.key}: ${e.value}`).join("\n§\n");
    const charCount = text.length;
    const percentage = Math.round((charCount / USER_CHAR_LIMIT) * 100);

    return `\n\n══════════════════════════════════════════════\nUSER PROFILE [${percentage}% — ${charCount}/${USER_CHAR_LIMIT} chars]\n══════════════════════════════════════════════\n${text}`;
  }

  /**
   * Combined memory context for system prompt (frozen snapshot pattern)
   */
  async getMemoryContext(): Promise<string> {
    const memoryMd = await this.loadMemoryMd();
    const userMd = await this.loadUserMd();
    return memoryMd + userMd;
  }

  /**
   * Legacy method for backwards compatibility
   */
  async getMemoryContextForPrompt(query?: string, limit = 10): Promise<string> {
    const entries = await this.getRelevant({ query, limit });
    if (entries.length === 0) return "";
    return "\n\n[Relevant Memory]\n" + entries.map((e) => `- ${e.key}: ${e.value}`).join("\n");
  }

  async summarizeSession(sessionId: string) {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt);

    const content = msgs.map((m: typeof messages.$inferSelect) => `${m.role}: ${m.content}`).join("\n").slice(0, 8000);
    if (!content.trim()) return null;

    const id = crypto.randomUUID();
    await db.insert(memoryEntries).values({
      id,
      key: `Session ${sessionId} summary`,
      value: content.slice(0, 2000),
      category: "insight",
      importance: 4,
      sessionId,
      target: "memory",
    });
    return id;
  }

  /**
   * Search past sessions using FTS5
   */
  async searchSessions(query: string, limit = 10) {
    try {
      return await searchSessions(query, { limit });
    } catch (e) {
      console.error("Session search failed:", e);
      return [];
    }
  }

  /**
   * Auto-extract memories from a user/assistant exchange
   * In production, this would use an LLM to extract key facts
   */
  async extractMemoriesFromExchange(userMsg: string, assistantMsg: string, sessionId?: string): Promise<void> {
    // Simple heuristic extraction (production would use LLM)
    const keyPatterns = [
      { regex: /I prefer (.+?)[.!]/i, category: "user_pref" as const, target: "user" as const },
      { regex: /my (?:project|codebase|app|repo|service|API) (?:is|uses|runs on) (.+?)[.!]/i, category: "project" as const, target: "memory" as const },
      { regex: /we use (.+?)[.!]/i, category: "fact" as const, target: "memory" as const },
      { regex: /don'?t (?:use|do|forget) (.+?)[.!]/i, category: "user_pref" as const, target: "user" as const },
    ];

    for (const { regex, category, target } of keyPatterns) {
      const match = userMsg.match(regex);
      if (match) {
        const value = match[1].trim();
        if (value.length > 3 && value.length < 200) {
          await this.addEntry({
            key: `Extracted from session`,
            value: value,
            category,
            importance: 4,
            sessionId,
            target,
          });
        }
      }
    }
  }

  /**
   * Auto-consolidate when memory is above 80% capacity
   */
  async autoConsolidate(): Promise<boolean> {
    const usage = await getMemoryUsage();
    const memoryPercent = usage.memory / usage.memoryLimit;

    if (memoryPercent > 0.8) {
      // Remove lowest importance entries first
      const entries = await this.getRelevant({ limit: 100 });
      const sorted = entries.sort((a, b) => a.importance - b.importance);

      let removed = 0;
      for (const entry of sorted) {
        if (usage.memory / usage.memoryLimit <= 0.7) break;
        if (entry.importance <= 3) {
          await this.deleteEntry(entry.id);
          removed++;
        }
      }
      return removed > 0;
    }
    return false;
  }
}

export const memoryManager = new MemoryManager();

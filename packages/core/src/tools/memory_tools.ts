import { Tool } from "../types.js";
import { memoryManager } from "../memory/manager.js";
import { searchSessions, getMemoryUsage } from "@agent-web/db";

export const memoryTools: Tool[] = [
  {
    name: "memory_add",
    description:
      "Add a new memory entry. Use target='memory' for agent notes (environment, conventions, lessons) or target='user' for user preferences (communication style, expectations). Max 2200 chars for memory, 1375 for user.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["memory", "user"],
          description: "Target store: 'memory' for agent notes, 'user' for user profile",
        },
        key: { type: "string", description: "Key/label for the memory entry" },
        value: { type: "string", description: "The memory content" },
        category: {
          type: "string",
          enum: ["user_pref", "fact", "task", "insight", "project"],
          description: "Category of the memory",
        },
        importance: {
          type: "number",
          description: "Importance level 1-10 (default 5)",
        },
      },
      required: ["target", "key", "value"],
    },
    handler: async (args) => {
      const target = args.target as "memory" | "user";
      const key = args.key as string;
      const value = args.value as string;
      const category = (args.category as any) ?? "fact";
      const importance = (args.importance as number) ?? 5;

      const usage = await getMemoryUsage();
      if (target === "memory" && usage.memory + value.length > usage.memoryLimit) {
        return `Memory at ${usage.memory}/${usage.memoryLimit} chars. Adding this entry (${value.length} chars) would exceed the limit. Replace or remove existing entries first.`;
      }
      if (target === "user" && usage.user + value.length > usage.userLimit) {
        return `User profile at ${usage.user}/${usage.userLimit} chars. Adding this entry (${value.length} chars) would exceed the limit. Replace or remove existing entries first.`;
      }

      await memoryManager.addEntry({ key, value, category, importance });
      return `Memory added: ${key}: ${value}`;
    },
    toolset: "memory",
  },
  {
    name: "memory_replace",
    description:
      "Replace a memory entry by matching a unique substring. Use oldText parameter - it just needs to be a unique substring that identifies exactly one entry.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["memory", "user"],
          description: "Target store",
        },
        oldText: { type: "string", description: "Unique substring matching the entry to replace" },
        newContent: { type: "string", description: "New content for the entry" },
      },
      required: ["target", "oldText", "newContent"],
    },
    handler: async (args) => {
      const oldText = args.oldText as string;
      const newContent = args.newContent as string;

      const entries = await memoryManager.getRelevant({ query: oldText, limit: 50 });
      const matches = entries.filter((e) => e.value.includes(oldText) || e.key.includes(oldText));

      if (matches.length === 0) return `No entry found matching "${oldText}".`;
      if (matches.length > 1) return `Multiple entries match "${oldText}". Please use a more specific substring. Matches: ${matches.map((m) => m.key).join(", ")}`;

      await memoryManager.addEntry({
        key: matches[0].key,
        value: newContent,
        category: matches[0].category as any,
        importance: matches[0].importance,
      });

      return `Replaced: "${oldText}" -> "${newContent.slice(0, 100)}..."`;
    },
    toolset: "memory",
  },
  {
    name: "memory_remove",
    description:
      "Remove a memory entry by matching a unique substring.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["memory", "user"],
          description: "Target store",
        },
        oldText: { type: "string", description: "Unique substring matching the entry to remove" },
      },
      required: ["target", "oldText"],
    },
    handler: async (args) => {
      const oldText = args.oldText as string;

      const entries = await memoryManager.getRelevant({ query: oldText, limit: 50 });
      const matches = entries.filter((e) => e.value.includes(oldText) || e.key.includes(oldText));

      if (matches.length === 0) return `No entry found matching "${oldText}".`;
      if (matches.length > 1) return `Multiple entries match "${oldText}". Please use a more specific substring.`;

      await memoryManager.deleteEntry(matches[0].id);
      return `Removed: ${matches[0].key}: ${matches[0].value.slice(0, 100)}...`;
    },
    toolset: "memory",
  },
  {
    name: "session_search",
    description:
      "Search past conversations using full-text search. Use this to find discussions from previous sessions.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const query = args.query as string;
      const limit = (args.limit as number) ?? 10;

      try {
        const results = await searchSessions(query, { limit });
        if (results.length === 0) return `No results found for "${query}".`;

        return results.map((r: any) =>
          `Session: ${r.sessionTitle} (${r.messageRole})\n${r.messageContent.slice(0, 200)}...`
        ).join("\n\n---\n\n");
      } catch (e) {
        return `Session search failed: ${(e as Error).message}`;
      }
    },
    toolset: "memory",
  },
];

import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@libsql/client";

export interface SearchResult {
  documentId: string;
  knowledgeBaseId: string;
  filename: string;
  snippet: string;
  score: number;
}

export const knowledgeSearchTool = tool({
  description:
    "Search your knowledge base for relevant information using full-text search. Use this when the user asks about stored documents, saved knowledge, reference materials, or anything that might be in a knowledge base.",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant knowledge. Supports FTS5 syntax (e.g., phrase matches, prefix queries)."),
    topK: z.number().min(1).max(20).optional().describe("Number of results to return (default 5)"),
    knowledgeBaseId: z.string().optional().describe("Optional: restrict search to a specific knowledge base by ID"),
  }),
  execute: async ({ query, topK, knowledgeBaseId }) => {
    const max = Math.min(topK ?? 5, 20);
    const dbUrl = process.env.DATABASE_URL || "file:./packages/db/data/local.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    try {
      const client = createClient({
        url: dbUrl,
        ...(authToken ? { authToken } : {}),
      });

      let results: SearchResult[];

      // Try FTS5 search first
      try {
        const ftsQuery = knowledgeBaseId
          ? `SELECT c.rowid, c.content, c.chunk_index, d.id as doc_id, d.knowledge_base_id, d.filename
             FROM chunks_fts cfts
             JOIN document_chunks c ON c.rowid = cfts.rowid
             JOIN knowledge_documents d ON d.id = c.document_id
             WHERE cfts.content MATCH ?
             AND d.knowledge_base_id = ?
             ORDER BY rank
             LIMIT ?`
          : `SELECT c.rowid, c.content, c.chunk_index, d.id as doc_id, d.knowledge_base_id, d.filename
             FROM chunks_fts cfts
             JOIN document_chunks c ON c.rowid = cfts.rowid
             JOIN knowledge_documents d ON d.id = c.document_id
             WHERE cfts.content MATCH ?
             ORDER BY rank
             LIMIT ?`;

        const args = knowledgeBaseId
          ? [query, knowledgeBaseId, String(max * 5)]
          : [query, String(max * 5)];

        const result = await client.execute({
          sql: ftsQuery,
          args,
        });

        const rows = result.rows as unknown as {
          content: string;
          doc_id: string;
          knowledge_base_id: string;
          filename: string;
        }[];

        // Deduplicate by document
        const seen = new Set<string>();
        results = [];
        for (const row of rows) {
          if (seen.has(row.doc_id)) continue;
          seen.add(row.doc_id);
          results.push({
            documentId: row.doc_id,
            knowledgeBaseId: row.knowledge_base_id,
            filename: row.filename,
            snippet: extractSnippet(row.content ?? "", query, 300),
            score: Math.max(0, 1 - results.length * 0.15),
          });
          if (results.length >= max) break;
        }
      } catch {
        // FTS5 not available or query failed, fallback to LIKE search
        const likeQuery = knowledgeBaseId
          ? `SELECT id, knowledge_base_id, filename, content
             FROM knowledge_documents
             WHERE user_id = ? AND knowledge_base_id = ? AND (content LIKE ? OR filename LIKE ?)
             ORDER BY created_at DESC
             LIMIT ?`
          : `SELECT id, knowledge_base_id, filename, content
             FROM knowledge_documents
             WHERE content LIKE ? OR filename LIKE ?
             ORDER BY created_at DESC
             LIMIT ?`;

        const likePattern = `%${query}%`;
        const args = knowledgeBaseId
          ? ["", knowledgeBaseId, likePattern, likePattern, String(max)]
          : ["", likePattern, likePattern, String(max)];

        const result = await client.execute({
          sql: likeQuery,
          args,
        });

        const rows = result.rows as unknown as {
          id: string;
          knowledge_base_id: string;
          filename: string;
          content: string;
        }[];

        results = rows.map((row) => ({
          documentId: row.id,
          knowledgeBaseId: row.knowledge_base_id,
          filename: row.filename,
          snippet: extractSnippet(row.content ?? "", query, 300),
          score: 0.5,
        }));
      }

      await client.close();

      if (results.length === 0) {
        return `No results found in the knowledge base for "${query}".`;
      }

      // Format results for the AI
      const formatted = results
        .map(
          (r, i) =>
            `${i + 1}. [${r.filename}] (score: ${(r.score * 100).toFixed(0)}%)\n   ${r.snippet}`
        )
        .join("\n\n");

      return `Found ${results.length} result(s) in the knowledge base for "${query}":\n\n${formatted}`;
    } catch (e: unknown) {
      const err = e as { message?: string };
      return `[error] Knowledge search failed: ${err.message ?? "unknown error"}`;
    }
  },
});

function extractSnippet(content: string, query: string, maxLen: number): string {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? "..." : "");

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, idx - half);
  let end = Math.min(content.length, idx + query.length + half);

  if (start > 0) {
    const spaceIdx = content.indexOf(" ", start);
    if (spaceIdx > 0 && spaceIdx < idx) start = spaceIdx + 1;
  }
  if (end < content.length) {
    const spaceIdx = content.lastIndexOf(" ", end);
    if (spaceIdx > idx) end = spaceIdx;
  }

  let snippet = content.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

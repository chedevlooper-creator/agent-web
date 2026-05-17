import { eq, and, desc } from "drizzle-orm";
import { getDb, getClient } from "./client.js";
import {
  knowledgeBases,
  knowledgeDocuments,
  documentChunks,
  type KnowledgeBase,
  type NewKnowledgeBase,
  type KnowledgeDocument,
  type NewKnowledgeDocument,
  type DocumentChunk,
  type NewDocumentChunk,
} from "./schema.js";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ===== Knowledge Base CRUD =====

export async function createKnowledgeBase(
  userId: string,
  name: string,
  description?: string
): Promise<KnowledgeBase> {
  const db = getDb();
  const now = Date.now();
  const row: NewKnowledgeBase = {
    id: generateId(),
    userId,
    name,
    description: description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(knowledgeBases).values(row);
  return row as KnowledgeBase;
}

export async function listKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
  const db = getDb();
  return db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, userId))
    .orderBy(desc(knowledgeBases.updatedAt));
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  const client = getClient();
  const db = getDb();
  // Get all documents in this KB
  const docs = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.knowledgeBaseId, id));

  // Delete FTS entries for all documents
  for (const doc of docs) {
    const chunks = await db
      .select({ rowid: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, doc.id));
    for (const chunk of chunks) {
      await client.execute({
        sql: "DELETE FROM chunks_fts WHERE rowid = ?",
        args: [chunk.rowid],
      });
    }
  }

  // Drizzle cascading deletes will handle document_chunks and knowledge_documents
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
}

// ===== Document CRUD =====

export async function addDocument(
  knowledgeBaseId: string,
  userId: string,
  filename: string,
  content: string,
  contentType?: string
): Promise<KnowledgeDocument> {
  const db = getDb();
  const client = getClient();
  const now = Date.now();
  const docId = generateId();

  // Split content into chunks
  const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP);

  const doc: NewKnowledgeDocument = {
    id: docId,
    knowledgeBaseId,
    userId,
    filename,
    content,
    contentType: contentType ?? "text",
    chunkCount: chunks.length,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(knowledgeDocuments).values(doc);

  // Insert chunks
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = generateId();
    await db.insert(documentChunks).values({
      id: chunkId,
      documentId: docId,
      chunkIndex: i,
      content: chunks[i],
      createdAt: now,
    });
  }

  // Populate FTS index: read all inserted chunks and insert into FTS
  const insertedChunks = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, docId))
    .orderBy(documentChunks.chunkIndex);

  for (const chunk of insertedChunks) {
    try {
      await client.execute({
        sql: "INSERT INTO chunks_fts(rowid, content) SELECT rowid, content FROM document_chunks WHERE id = ?",
        args: [chunk.id],
      });
    } catch {
      // FTS insertion failure shouldn't block document creation
    }
  }

  return doc as KnowledgeDocument;
}

export async function listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
  const db = getDb();
  return db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
    .orderBy(desc(knowledgeDocuments.createdAt));
}

export async function getDocument(id: string): Promise<KnowledgeDocument | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb();
  const client = getClient();

  // Delete FTS entries for this document's chunks
  const chunks = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, id));
  for (const chunk of chunks) {
    try {
      await client.execute({
        sql: "DELETE FROM chunks_fts WHERE rowid IN (SELECT rowid FROM document_chunks WHERE id = ?)",
        args: [chunk.id],
      });
    } catch {
      // Silently skip FTS deletion failures
    }
  }

  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
}

// ===== Search =====

export interface SearchResult {
  documentId: string;
  knowledgeBaseId: string;
  filename: string;
  snippet: string;
  score: number;
}

export async function searchKnowledge(
  userId: string,
  query: string,
  topK: number = 5,
  baseIds?: string[]
): Promise<SearchResult[]> {
  const client = getClient();
  const db = getDb();

  // Use FTS5 MATCH via raw SQL
  let rows: { rowid: number; rank: number }[];
  try {
    const ftsResult = await client.execute({
      sql: "SELECT rowid, rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?",
      args: [query, topK * 20], // Get more results for post-filtering
    });
    rows = ftsResult.rows as unknown as { rowid: number; rank: number }[];
  } catch {
    // FTS5 query failed (e.g., invalid syntax), fall back to LIKE search
    return searchKnowledgeFallback(userId, query, topK, baseIds);
  }

  if (rows.length === 0) return [];

  // Get the chunk rowids
  const chunkRowIds = rows.map((r) => r.rowid);

  // Query document_chunks by internal rowid
  // We need to map rowid back to chunk rows via raw SQL since drizzle may not expose rowid
  let chunks: { id: string; document_id: string; content: string; chunk_index: number }[];
  try {
    const placeholders = chunkRowIds.map(() => "?").join(",");
    const chunkResult = await client.execute({
      sql: `SELECT id, document_id, content, chunk_index FROM document_chunks WHERE rowid IN (${placeholders}) ORDER BY CASE rowid ${chunkRowIds.map((rid, i) => `WHEN ${rid} THEN ${i}`).join(" ")} END`,
      args: chunkRowIds.map(String),
    });
    chunks = chunkResult.rows as unknown as { id: string; document_id: string; content: string; chunk_index: number }[];
  } catch {
    return searchKnowledgeFallback(userId, query, topK, baseIds);
  }

  if (chunks.length === 0) return [];

  // Get document metadata
  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  const docPlaceholders = docIds.map(() => "?").join(",");
  const docResult = await client.execute({
    sql: `SELECT id, knowledge_base_id, filename, user_id, content FROM knowledge_documents WHERE id IN (${docPlaceholders})`,
    args: docIds,
  });
  const docs = docResult.rows as unknown as { id: string; knowledge_base_id: string; filename: string; user_id: string; content: string }[];

  const docMap = new Map(docs.map((d) => [d.id, d]));
  const rankMap = new Map(rows.map((r) => [r.rowid, r.rank]));

  // Build results, filter by userId and baseIds
  const results: SearchResult[] = [];
  const seenDocs = new Set<string>();

  for (const chunk of chunks) {
    const doc = docMap.get(chunk.document_id);
    if (!doc) continue;
    if (doc.user_id !== userId) continue;
    if (baseIds && baseIds.length > 0 && !baseIds.includes(doc.knowledge_base_id)) continue;

    const docKey = doc.id;
    // Only include top result per document
    if (seenDocs.has(docKey)) continue;
    seenDocs.add(docKey);

    const rank = rankMap.get(chunks.findIndex((c) => c.id === chunk.id) + 1) ?? 0;
    // Convert rank to a score (lower rank = higher score)
    const score = Math.max(0, 1 - rank / 100);

    // Extract a meaningful snippet (around the matched text)
    const snippet = extractSnippet(chunk.content, query, 200);

    results.push({
      documentId: doc.id,
      knowledgeBaseId: doc.knowledge_base_id,
      filename: doc.filename,
      snippet,
      score,
    });

    if (results.length >= topK) break;
  }

  return results;
}

function extractSnippet(content: string, query: string, maxLen: number): string {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? "..." : "");

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, idx - half);
  let end = Math.min(content.length, idx + query.length + half);

  // Try to break at word boundaries
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

async function searchKnowledgeFallback(
  userId: string,
  query: string,
  topK: number,
  baseIds?: string[]
): Promise<SearchResult[]> {
  const db = getDb();

  const conditions = [eq(knowledgeDocuments.userId, userId)];
  if (baseIds && baseIds.length > 0) {
    conditions.push(
      eq(knowledgeDocuments.knowledgeBaseId, baseIds[0]) // Simplified fallback
    );
  }

  const docs = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(...conditions))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(topK);

  return docs.map((doc) => ({
    documentId: doc.id,
    knowledgeBaseId: doc.knowledgeBaseId,
    filename: doc.filename,
    snippet: doc.content.slice(0, 200) + (doc.content.length > 200 ? "..." : ""),
    score: 0.5,
  }));
}

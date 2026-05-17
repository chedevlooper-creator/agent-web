import { eq, and, gte, like } from "drizzle-orm";
import { getDb } from "./client.js";
import { memories, type Memory, type MemoryCategory } from "./schema.js";

export async function listMemoriesByCategory(
  userId: string,
  category: MemoryCategory
): Promise<Memory[]> {
  const db = getDb();
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.category, category)))
    .orderBy(memories.updatedAt);
}

export async function getImportantMemories(
  userId: string,
  minImportance: number
): Promise<Memory[]> {
  const db = getDb();
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), gte(memories.importance, minImportance)))
    .orderBy(memories.updatedAt);
}

export async function searchMemories(
  userId: string,
  query: string
): Promise<Memory[]> {
  const db = getDb();
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), like(memories.value, `%${query}%`)))
    .orderBy(memories.updatedAt);
}

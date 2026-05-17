export * from "./schema.js";
export * from "./client.js";
export { runMigrations, ensureMigrated } from "./migrate.js";
export { listMemoriesByCategory, getImportantMemories, searchMemories } from "./memories.js";
export {
  createKnowledgeBase,
  listKnowledgeBases,
  getKnowledgeBase,
  deleteKnowledgeBase,
  addDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  searchKnowledge,
} from "./knowledge.js";
export type { SearchResult } from "./knowledge.js";

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
export {
  seedDefaultAgents,
  listAgentPresets,
  getAgentPreset,
  installAgent,
  uninstallAgent,
  listInstalledAgents,
  updateInstalledAgent,
} from "./agents.js";
export type {
  AgentPreset,
  NewAgentPreset,
  InstalledAgent,
  NewInstalledAgent,
  AgentCategory,
  AgentGroup,
  NewAgentGroup,
} from "./schema.js";

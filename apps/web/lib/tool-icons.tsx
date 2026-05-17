import { Terminal, FileText, SquarePen, Globe, FolderOpen, Search, GlobeLock, Play, Wrench, GitBranch, Database, TestTube } from "lucide-react";

export const TOOL_ICONS: Record<string, React.ElementType> = {
  terminal: Terminal,
  read_file: FileText,
  write_file: SquarePen,
  web_search: Globe,
  list_directory: FolderOpen,
  search_files: Search,
  web_fetch: GlobeLock,
  execute_code: Play,
  git: GitBranch,
  db_query: Database,
  api_test: TestTube,
};

export function getToolIcon(toolName: string, fallback = Wrench) {
  return TOOL_ICONS[toolName] ?? fallback;
}

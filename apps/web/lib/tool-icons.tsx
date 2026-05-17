import { Terminal, FileText, SquarePen, Globe, FolderOpen, Search, Wrench } from "lucide-react";

export const TOOL_ICONS: Record<string, React.ElementType> = {
  terminal: Terminal,
  read_file: FileText,
  write_file: SquarePen,
  web_search: Globe,
  list_directory: FolderOpen,
  search_files: Search,
};

export function getToolIcon(toolName: string, fallback = Wrench) {
  return TOOL_ICONS[toolName] ?? fallback;
}

import { Terminal, FileText, SquarePen, Globe, Wrench } from "lucide-react";

export const TOOL_ICONS: Record<string, React.ElementType> = {
  terminal: Terminal,
  read_file: FileText,
  write_file: SquarePen,
  web_search: Globe,
};

export function getToolIcon(toolName: string, fallback = Wrench) {
  return TOOL_ICONS[toolName] ?? fallback;
}

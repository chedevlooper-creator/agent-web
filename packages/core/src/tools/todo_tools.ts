import { Tool } from "../types.js";

interface TodoItem {
  id: string;
  text: string;
  status: "pending" | "completed" | "in_progress";
}

let currentTodos: TodoItem[] = [];

export const todoTools: Tool[] = [
  {
    name: "todo_write",
    description:
      "Create, update, or mark complete a todo item. Use this to plan multi-step tasks. Format: 'action' (create, update, complete, list), 'text' (for create/update), 'id' (for update/complete).",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "complete", "list"],
          description: "Action to perform",
        },
        text: { type: "string", description: "Todo text (for create/update)" },
        id: { type: "string", description: "Todo item ID (for update/complete)" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
          description: "New status (for update)",
        },
      },
      required: ["action"],
    },
    handler: async (args) => {
      const action = args.action as string;

      if (action === "create") {
        const text = (args.text as string) || "Untitled task";
        const id = crypto.randomUUID().slice(0, 8);
        currentTodos.push({ id, text, status: "pending" });
        return `Todo created [${id}]: ${text}`;
      }

      if (action === "update") {
        const id = args.id as string;
        const todo = currentTodos.find((t) => t.id === id);
        if (!todo) return `Todo [${id}] not found.`;
        todo.text = (args.text as string) || todo.text;
        if (args.status) todo.status = args.status as TodoItem["status"];
        return `Todo [${id}] updated: ${todo.text} (${todo.status})`;
      }

      if (action === "complete") {
        const id = args.id as string;
        const todo = currentTodos.find((t) => t.id === id);
        if (!todo) return `Todo [${id}] not found.`;
        todo.status = "completed";
        return `Todo [${id}] completed: ${todo.text}`;
      }

      if (action === "list") {
        if (currentTodos.length === 0) return "No todos yet.";
        return currentTodos.map((t) => `[${t.id}] [${t.status}] ${t.text}`).join("\n");
      }

      return `Unknown action: ${action}`;
    },
    toolset: "todo",
  },
  {
    name: "todo_read",
    description: "Read the current todo list",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async () => {
      if (currentTodos.length === 0) return "No todos yet.";
      return currentTodos.map((t) => `[${t.id}] [${t.status}] ${t.text}`).join("\n");
    },
    toolset: "todo",
  },
];

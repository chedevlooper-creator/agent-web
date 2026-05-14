import { Tool } from "../types.js";
import { spawn, ChildProcess } from "child_process";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// SSE client (existing)
export class McpSseClient {
  private url: string;
  private sessionId: string | null = null;
  private messageEndpoint: string | null = null;
  private reqId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(url: string) {
    this.url = url.endsWith("/") ? url.slice(0, -1) : url;
  }

  async connect(): Promise<void> {
    const sseUrl = `${this.url}/sse`;
    const res = await fetch(sseUrl, { headers: { Accept: "text/event-stream" } });
    if (!res.ok || !res.body) throw new Error(`MCP SSE connection failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("event: endpoint")) {
          const dataLine = lines[i + 1];
          if (dataLine?.startsWith("data: ")) {
            this.messageEndpoint = dataLine.slice(6).trim();
            if (this.messageEndpoint?.startsWith("/")) {
              this.messageEndpoint = this.url + this.messageEndpoint;
            }
          }
        }
        if (line.startsWith("event: sessionId")) {
          const dataLine = lines[i + 1];
          if (dataLine?.startsWith("data: ")) {
            this.sessionId = dataLine.slice(6).trim();
          }
        }
      }
      if (this.messageEndpoint) break;
    }

    reader.cancel();
    if (!this.messageEndpoint) throw new Error("MCP SSE: no message endpoint received");

    const initRes = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "agent-web", version: "0.1.0" },
    });
    if ((initRes as any)?.error) throw new Error("MCP init error: " + JSON.stringify((initRes as any).error));
    await this.notify("notifications/initialized");
  }

  async listTools(): Promise<McpTool[]> {
    const res = await this.request("tools/list", {});
    const result = (res as any)?.result;
    if (!result?.tools) return [];
    return result.tools as McpTool[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await this.request("tools/call", { name, arguments: args });
    return (res as any)?.result;
  }

  disconnect() {
    this.pending.clear();
    this.sessionId = null;
    this.messageEndpoint = null;
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    if (!this.messageEndpoint) throw new Error("Not connected");
    const id = ++this.reqId;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });

    const res = await fetch(this.messageEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`MCP request failed: ${res.status}`);
    return res.json();
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    if (!this.messageEndpoint) return;
    const body = JSON.stringify({ jsonrpc: "2.0", method, params });
    await fetch(this.messageEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  }
}

// Stdio client (new for Phase 5)
export class McpStdioClient {
  private process: ChildProcess | null = null;
  private reqId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = "";
  private connected = false;

  async connect(command: string, args: string[], env?: Record<string, string>): Promise<void> {
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    this.process.stdout?.on("data", (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on("data", (data) => {
      console.error(`[MCP stdio stderr] ${data.toString()}`);
    });

    this.process.on("error", (err) => {
      for (const [, { reject }] of this.pending) {
        reject(err);
      }
      this.pending.clear();
    });

    // Initialize
    const initRes = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "agent-web", version: "0.1.0" },
    });

    if ((initRes as any)?.error) {
      throw new Error("MCP init error: " + JSON.stringify((initRes as any).error));
    }

    await this.notify("notifications/initialized");
    this.connected = true;
  }

  async listTools(): Promise<McpTool[]> {
    const res = await this.request("tools/list", {});
    const result = (res as any)?.result;
    if (!result?.tools) return [];
    return result.tools as McpTool[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await this.request("tools/call", { name, arguments: args });
    return (res as any)?.result;
  }

  disconnect() {
    this.pending.clear();
    this.process?.kill();
    this.process = null;
    this.connected = false;
  }

  private processBuffer() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);
        if (json.id && this.pending.has(json.id)) {
          const { resolve, reject } = this.pending.get(json.id)!;
          if (json.error) reject(new Error(JSON.stringify(json.error)));
          else resolve(json);
          this.pending.delete(json.id);
        }
      } catch {
        // Ignore non-JSON lines
      }
    }
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    if (!this.process || !this.connected) throw new Error("Not connected");
    const id = ++this.reqId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      this.process?.stdin?.write(body + "\n");

      // Timeout
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    if (!this.process) return;
    const body = JSON.stringify({ jsonrpc: "2.0", method, params });
    this.process.stdin?.write(body + "\n");
  }
}

export class McpManager {
  private sseClients = new Map<string, McpSseClient>();
  private stdioClients = new Map<string, McpStdioClient>();
  private refreshLocks = new Map<string, boolean>();

  async connectSseServer(id: string, url: string): Promise<McpTool[]> {
    const client = new McpSseClient(url);
    await client.connect();
    this.sseClients.set(id, client);
    return client.listTools();
  }

  async connectStdioServer(id: string, command: string, args: string[], env?: Record<string, string>): Promise<McpTool[]> {
    const client = new McpStdioClient();
    await client.connect(command, args, env);
    this.stdioClients.set(id, client);
    return client.listTools();
  }

  getSseClient(id: string): McpSseClient | undefined {
    return this.sseClients.get(id);
  }

  getStdioClient(id: string): McpStdioClient | undefined {
    return this.stdioClients.get(id);
  }

  getClient(id: string): McpSseClient | McpStdioClient | undefined {
    return this.sseClients.get(id) ?? this.stdioClients.get(id);
  }

  disconnectSseServer(id: string) {
    const client = this.sseClients.get(id);
    if (client) {
      client.disconnect();
      this.sseClients.delete(id);
    }
  }

  disconnectStdioServer(id: string) {
    const client = this.stdioClients.get(id);
    if (client) {
      client.disconnect();
      this.stdioClients.delete(id);
    }
  }

  disconnectServer(id: string) {
    this.disconnectSseServer(id);
    this.disconnectStdioServer(id);
  }

  disconnectAll() {
    for (const [id] of this.sseClients) this.disconnectSseServer(id);
    for (const [id] of this.stdioClients) this.disconnectStdioServer(id);
  }

  /**
   * Handle dynamic tool discovery notification from MCP server
   */
  async handleToolsListChanged(serverId: string, onRefresh: (tools: McpTool[]) => Promise<void>) {
    if (this.refreshLocks.get(serverId)) return;
    this.refreshLocks.set(serverId, true);

    try {
      const client = this.getClient(serverId);
      if (client instanceof McpSseClient) {
        const tools = await client.listTools();
        await onRefresh(tools);
      } else if (client instanceof McpStdioClient) {
        const tools = await client.listTools();
        await onRefresh(tools);
      }
    } catch (e) {
      console.error(`[MCP] Failed to refresh tools for ${serverId}:`, e);
    } finally {
      this.refreshLocks.delete(serverId);
    }
  }
}

export const mcpManager = new McpManager();

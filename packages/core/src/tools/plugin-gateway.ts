import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const CONFIG_PATH = join(process.cwd(), "data", "plugins.json");
const PLUGINS_DIR = join(process.cwd(), "data", "plugins");

// ===== Types =====

export interface PluginToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  entrypoint: string; // URL
  tools: PluginToolDef[];
  settings?: Record<string, { type: string; required: boolean; default?: unknown }>;
}

export interface PluginConfig {
  id: string;
  enabled: boolean;
}

export interface PluginToolDescription {
  pluginId: string;
  pluginName: string;
  toolName: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface PluginInfo {
  config: PluginConfig;
  manifest: PluginManifest;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);
}

// ===== Config I/O =====

async function loadConfig(): Promise<PluginConfig[]> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as PluginConfig[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(CONFIG_PATH), { recursive: true });
      await writeFile(CONFIG_PATH, "[]", "utf-8");
      return [];
    }
    throw err;
  }
}

async function saveConfig(configs: PluginConfig[]): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(configs, null, 2), "utf-8");
}

async function loadManifest(pluginId: string): Promise<PluginManifest | null> {
  try {
    const manifestPath = join(PLUGINS_DIR, pluginId, "plugin.json");
    const raw = await readFile(manifestPath, "utf-8");
    return JSON.parse(raw) as PluginManifest;
  } catch {
    return null;
  }
}

async function saveManifest(manifest: PluginManifest): Promise<void> {
  const dir = join(PLUGINS_DIR, manifest.id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "plugin.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
}

async function removeManifestDir(pluginId: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  const dir = join(PLUGINS_DIR, pluginId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore removal errors
  }
}

// ===== JSON Schema → Zod =====

function jsonSchemaToZod(
  params: Record<string, unknown>
): z.ZodTypeAny {
  const properties = (params as { properties?: Record<string, { type?: string; description?: string }> }).properties;
  const required = (params as { required?: string[] }).required ?? [];
  const type = (params as { type?: string }).type;

  // If it's a single top-level type (not an object with properties)
  if (!properties || Object.keys(properties).length === 0) {
    if (type === "string") return z.string();
    if (type === "number") return z.number();
    if (type === "integer") return z.number().int();
    if (type === "boolean") return z.boolean();
    return z.object({}).describe("No parameters");
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        fieldSchema = z.string();
        break;
      case "number":
        fieldSchema = z.number();
        break;
      case "integer":
        fieldSchema = z.number().int();
        break;
      case "boolean":
        fieldSchema = z.boolean();
        break;
      case "array":
        fieldSchema = z.array(z.unknown());
        break;
      case "object":
        fieldSchema = z.record(z.unknown());
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (prop.description) {
      fieldSchema = fieldSchema.describe(prop.description);
    }

    if (!required.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  return z.object(shape);
}

// ===== PluginManager =====

export class PluginManager {
  private configs: PluginConfig[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.configs = await loadConfig();
    this.loaded = true;
  }

  async reload(): Promise<void> {
    this.configs = await loadConfig();
  }

  async listPlugins(): Promise<PluginInfo[]> {
    await this.load();
    const results: PluginInfo[] = [];

    for (const config of this.configs) {
      const manifest = await loadManifest(config.id);
      if (manifest) {
        results.push({ config, manifest });
      }
    }

    return results;
  }

  async installPlugin(manifest: PluginManifest): Promise<PluginConfig> {
    await this.load();

    // Save manifest to disk
    await saveManifest(manifest);

    // Add to config (or update existing)
    const existing = this.configs.find((c) => c.id === manifest.id);
    if (existing) {
      existing.enabled = true;
    } else {
      this.configs.push({ id: manifest.id, enabled: true });
    }

    await saveConfig(this.configs);
    return { id: manifest.id, enabled: true };
  }

  async uninstallPlugin(id: string): Promise<boolean> {
    await this.load();

    const idx = this.configs.findIndex((c) => c.id === id);
    if (idx === -1) return false;

    this.configs.splice(idx, 1);
    await saveConfig(this.configs);
    await removeManifestDir(id);

    return true;
  }

  async getPlugin(id: string): Promise<PluginInfo | null> {
    await this.load();

    const config = this.configs.find((c) => c.id === id);
    if (!config) return null;

    const manifest = await loadManifest(id);
    if (!manifest) return null;

    return { config, manifest };
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    await this.load();

    const config = this.configs.find((c) => c.id === id);
    if (!config) return false;

    config.enabled = enabled;
    await saveConfig(this.configs);
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadAllTools(): Promise<Record<string, any>> {
    await this.load();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolMap: Record<string, any> = {};

    for (const config of this.configs) {
      if (!config.enabled) continue;

      const manifest = await loadManifest(config.id);
      if (!manifest) continue;

      for (const pluginTool of manifest.tools) {
        const toolKey = `plugin__${config.id}__${pluginTool.name}`;
        const entrypoint = manifest.entrypoint;
        const zodSchema = jsonSchemaToZod(pluginTool.parameters);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolDef: any = {
          description:
            pluginTool.description ??
            `Plugin tool from ${manifest.name}: ${pluginTool.name}`,
          parameters: zodSchema,
          execute: async (args: Record<string, unknown>) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);

              const response = await fetch(entrypoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tool: pluginTool.name,
                  args,
                }),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (!response.ok) {
                const errText = await response.text().catch(() => "Unknown error");
                return `[Plugin Error from ${manifest.name}/${pluginTool.name}]: HTTP ${response.status} - ${errText}`;
              }

              const result = await response.text();
              return result;
            } catch (err) {
              return `[Plugin Error from ${manifest.name}/${pluginTool.name}]: ${(err as Error).message}`;
            }
          },
        };

        toolMap[toolKey] = tool(toolDef);
      }
    }

    return toolMap;
  }

  async getPluginToolDefinitions(): Promise<PluginToolDescription[]> {
    const defs: PluginToolDescription[] = [];

    for (const config of this.configs) {
      if (!config.enabled) continue;

      const manifest = await loadManifest(config.id);
      if (!manifest) continue;

      for (const pluginTool of manifest.tools) {
        defs.push({
          pluginId: config.id,
          pluginName: manifest.name,
          toolName: pluginTool.name,
          description: pluginTool.description,
          parameters: pluginTool.parameters,
        });
      }
    }

    return defs;
  }
}

/** Singleton instance */
export const pluginManager = new PluginManager();

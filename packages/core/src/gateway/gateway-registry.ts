import type { GatewayConfig, GatewayStatus } from "./gateway-types.js";

interface GatewayHandler {
  platform: string;
  connect: (config: GatewayConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (channelId: string, text: string) => Promise<void>;
  getStatus: () => GatewayStatus;
}

class GatewayRegistry {
  private handlers: Map<string, GatewayHandler> = new Map();
  private configs: GatewayConfig[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const configPath = path.join(process.cwd(), "data", "gateway-config.json");
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      this.configs = JSON.parse(raw);
    } catch {
      this.configs = [];
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const configPath = path.join(process.cwd(), "data", "gateway-config.json");
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.configs, null, 2), "utf-8");
  }

  register(handler: GatewayHandler): void {
    this.handlers.set(handler.platform, handler);
  }

  async connectAll(): Promise<void> {
    await this.load();
    for (const config of this.configs) {
      if (config.enabled) {
        await this.connect(config.platform);
      }
    }
  }

  async connect(platform: string): Promise<void> {
    const config = this.configs.find(c => c.platform === platform);
    if (!config) throw new Error(`Gateway not configured: ${platform}`);
    const handler = this.handlers.get(platform);
    if (!handler) throw new Error(`No handler for platform: ${platform}`);
    await handler.connect(config);
  }

  async disconnect(platform: string): Promise<void> {
    const handler = this.handlers.get(platform);
    if (handler) await handler.disconnect();
  }

  async sendMessage(platform: string, channelId: string, text: string): Promise<void> {
    const handler = this.handlers.get(platform);
    if (!handler) throw new Error(`No handler for platform: ${platform}`);
    await handler.sendMessage(channelId, text);
  }

  getStatuses(): GatewayStatus[] {
    return Array.from(this.handlers.values()).map(h => h.getStatus());
  }

  async getConfigs(): Promise<GatewayConfig[]> {
    await this.load();
    return [...this.configs];
  }

  async saveConfig(config: GatewayConfig): Promise<void> {
    await this.load();
    const idx = this.configs.findIndex(c => c.platform === config.platform);
    if (idx >= 0) {
      this.configs[idx] = config;
    } else {
      this.configs.push(config);
    }
    await this.save();
  }

  async removeConfig(platform: string): Promise<void> {
    await this.load();
    await this.disconnect(platform);
    this.configs = this.configs.filter(c => c.platform !== platform);
    await this.save();
  }
}

export const gatewayRegistry = new GatewayRegistry();

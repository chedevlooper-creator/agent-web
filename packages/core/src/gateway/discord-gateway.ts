import type { GatewayConfig, GatewayStatus } from "./gateway-types.js";
import { gatewayRegistry } from "./gateway-registry.js";

class DiscordGatewayHandler {
  platform = "discord";
  private connected = false;
  private error: string | undefined;
  private lastActivity: number | undefined;
  private config: GatewayConfig | null = null;

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config;
    // In production: use discord.js to connect
    // const { Client, GatewayIntentBits } = await import("discord.js");
    // const client = new Client({ intents: [...] });
    // await client.login(config.credentials.token);
    this.connected = true;
    this.lastActivity = Date.now();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    if (!this.connected) throw new Error("Discord gateway not connected");
    // In production: use discord.js client.channels
    // await client.channels.cache.get(channelId)?.send(text);
    this.lastActivity = Date.now();
  }

  getStatus(): GatewayStatus {
    return {
      platform: "discord",
      connected: this.connected,
      error: this.error,
      lastActivity: this.lastActivity,
    };
  }
}

// Register singleton
const discordHandler = new DiscordGatewayHandler();
gatewayRegistry.register(discordHandler);
export { discordHandler };

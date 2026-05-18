import type { GatewayConfig, GatewayStatus } from "./gateway-types.js";
import { gatewayRegistry } from "./gateway-registry.js";

class WhatsAppGatewayHandler {
  platform = "whatsapp";
  private connected = false;
  private error: string | undefined;
  private lastActivity: number | undefined;
  private config: GatewayConfig | null = null;

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config;
    // In production: use whatsapp-web.js or WhatsApp Business API
    this.connected = true;
    this.lastActivity = Date.now();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    if (!this.connected) throw new Error("WhatsApp gateway not connected");
    // In production: use WhatsApp API
    this.lastActivity = Date.now();
  }

  getStatus(): GatewayStatus {
    return {
      platform: "whatsapp",
      connected: this.connected,
      error: this.error,
      lastActivity: this.lastActivity,
    };
  }
}

const whatsappHandler = new WhatsAppGatewayHandler();
gatewayRegistry.register(whatsappHandler);
export { whatsappHandler };

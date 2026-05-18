export interface GatewayMessage {
  id: string;
  platform: "discord" | "whatsapp" | "telegram";
  channelId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface GatewayResponse {
  text: string;
  platform: string;
  channelId: string;
}

export interface GatewayConfig {
  platform: string;
  enabled: boolean;
  credentials: Record<string, string>;
  agentId: string | null;
}

export interface GatewayStatus {
  platform: string;
  connected: boolean;
  error?: string;
  lastActivity?: number;
}

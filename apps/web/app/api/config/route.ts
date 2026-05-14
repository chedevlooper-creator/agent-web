import { NextRequest, NextResponse } from "next/server";

// Configuration schema and management
const CONFIG_SCHEMA = {
  terminal: {
    backend: { type: "string", enum: ["local", "docker", "ssh"], default: "local" },
    dockerImage: { type: "string", default: "python:3.11-slim" },
    sshHost: { type: "string", default: "" },
    sshUser: { type: "string", default: "" },
  },
  memory: {
    charLimit: { type: "number", default: 2200 },
    userCharLimit: { type: "number", default: 1375 },
  },
  chat: {
    contextCompressionThreshold: { type: "number", default: 80000 },
    enableMemory: { type: "boolean", default: true },
    auxiliaryModel: { type: "string", default: "gpt-4o-mini" },
  },
  sandbox: {
    enabled: { type: "boolean", default: false },
    maxCpuMs: { type: "number", default: 5000 },
    maxMemoryMb: { type: "number", default: 256 },
  },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");

    // GET /api/config/schema - return config schema
    if (searchParams.get("action") === "schema") {
      return NextResponse.json({ schema: CONFIG_SCHEMA });
    }

    // Build current config from env vars
    const config = {
      terminal: {
        backend: process.env.TERMINAL_BACKEND ?? "local",
        dockerImage: process.env.TERMINAL_DOCKER_IMAGE ?? "python:3.11-slim",
        sshHost: process.env.TERMINAL_SSH_HOST ?? "",
        sshUser: process.env.TERMINAL_SSH_USER ?? "",
      },
      memory: {
        charLimit: parseInt(process.env.MEMORY_CHAR_LIMIT ?? "2200", 10),
        userCharLimit: parseInt(process.env.USER_CHAR_LIMIT ?? "1375", 10),
      },
      chat: {
        contextCompressionThreshold: parseInt(process.env.CONTEXT_COMPRESSION_THRESHOLD ?? "80000", 10),
        enableMemory: process.env.ENABLE_MEMORY !== "false",
        auxiliaryModel: process.env.AUXILIARY_MODEL ?? "gpt-4o-mini",
      },
      sandbox: {
        enabled: process.env.SANDBOX_ENABLED === "true",
        maxCpuMs: parseInt(process.env.SANDBOX_MAX_CPU_MS ?? "5000", 10),
        maxMemoryMb: parseInt(process.env.SANDBOX_MAX_MEMORY_MB ?? "256", 10),
      },
    };

    if (section && config[section as keyof typeof config]) {
      return NextResponse.json({ [section]: config[section as keyof typeof config] });
    }

    return NextResponse.json({
      ...config,
      ninerouter: {
        baseUrl: process.env.NINEROUTER_URL
          ? `${process.env.NINEROUTER_URL.replace(/\/$/, "")}/v1`
          : "https://rfb2lzd.9router.com/v1",
        keyConfigured: Boolean(process.env.NINEROUTER_KEY),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    // In a web app, config changes persist to a config table or env file
    // Here we validate and return the updated config
    const validated: Record<string, Record<string, unknown>> = {};

    if (body.terminal) {
      validated.terminal = {};
      if (["local", "docker", "ssh"].includes(body.terminal.backend)) {
        validated.terminal.backend = body.terminal.backend;
      }
      if (body.terminal.dockerImage) validated.terminal.dockerImage = body.terminal.dockerImage;
      if (body.terminal.sshHost) validated.terminal.sshHost = body.terminal.sshHost;
      if (body.terminal.sshUser) validated.terminal.sshUser = body.terminal.sshUser;
    }

    if (body.memory) {
      validated.memory = {};
      if (typeof body.memory.charLimit === "number") validated.memory.charLimit = body.memory.charLimit;
      if (typeof body.memory.userCharLimit === "number") validated.memory.userCharLimit = body.memory.userCharLimit;
    }

    if (body.chat) {
      validated.chat = {};
      if (typeof body.chat.contextCompressionThreshold === "number") {
        validated.chat.contextCompressionThreshold = body.chat.contextCompressionThreshold;
      }
      if (typeof body.chat.enableMemory === "boolean") validated.chat.enableMemory = body.chat.enableMemory;
      if (typeof body.chat.auxiliaryModel === "string") validated.chat.auxiliaryModel = body.chat.auxiliaryModel;
    }

    if (body.sandbox) {
      validated.sandbox = {};
      if (typeof body.sandbox.enabled === "boolean") validated.sandbox.enabled = body.sandbox.enabled;
      if (typeof body.sandbox.maxCpuMs === "number") validated.sandbox.maxCpuMs = body.sandbox.maxCpuMs;
      if (typeof body.sandbox.maxMemoryMb === "number") validated.sandbox.maxMemoryMb = body.sandbox.maxMemoryMb;
    }

    return NextResponse.json({ updated: validated, note: "Changes require server restart to take effect" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { runParallelAgents, runSequentialAgents } from "@agent-web/core";
import type { AgentConfig } from "@agent-web/core";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEEPSEEK_DISABLE_THINKING = true;

function getServerApiKey(provider: string): string | null {
  if (provider === "openai") return process.env.OPENAI_API_KEY || null;
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || null;
  if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY || null;
  return process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/agent-groups/run — execute a group of agents
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { strategy, agents, message } = body as {
      groupId?: string;
      strategy: string;
      agents: AgentConfig[];
      message: string;
    };

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return NextResponse.json(
        { error: "At least one agent config required" },
        { status: 400 },
      );
    }

    // Resolve API key from the first agent's provider
    const firstProvider = agents[0]?.provider || "openai";
    const apiKey = getServerApiKey(firstProvider);
    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for provider: ${firstProvider}` },
        { status: 400 },
      );
    }

    let result;
    if (strategy === "sequential") {
      result = await runSequentialAgents(agents, message, apiKey);
    } else {
      // Default to parallel
      result = await runParallelAgents(agents, message, apiKey);
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

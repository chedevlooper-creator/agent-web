import { NextRequest, NextResponse } from "next/server";
import { listProviders, getProviderConfig, createModelClient, resolveProvider } from "@agent-web/core";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "test") {
      const provider = searchParams.get("provider") ?? "openai";
      const model = searchParams.get("model") ?? "gpt-4o-mini";
      const apiKey =
        searchParams.get("apiKey") ||
        (provider === "9router" ? process.env.NINEROUTER_KEY : "") ||
        "";
      const baseUrl = searchParams.get("baseUrl") || undefined;

      const config = getProviderConfig(provider);
      if (!config) {
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }

      try {
        const resolved = await resolveProvider(provider, model, { apiKey, baseUrl });
        const client = createModelClient(resolved);
        return NextResponse.json({ success: true, provider, model, contextLength: resolved.contextLength });
      } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message });
      }
    }

    const providers = listProviders();
    return NextResponse.json({ providers });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // POST /api/provider { action: "switch", provider, model }
    if (action === "switch") {
      const { provider, model, apiKey, baseUrl } = body;
      if (!provider || !model) {
        return NextResponse.json({ error: "provider and model required" }, { status: 400 });
      }

      const config = getProviderConfig(provider);
      if (!config) {
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
      }

      const resolved = await resolveProvider(provider, model, {
        apiKey: apiKey ?? "",
        baseUrl: baseUrl ?? config.defaultBase,
      });

      return NextResponse.json({
        success: true,
        provider,
        model,
        apiMode: resolved.apiMode,
        contextLength: resolved.contextLength,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

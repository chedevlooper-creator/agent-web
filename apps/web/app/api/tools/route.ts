import { NextRequest, NextResponse } from "next/server";
import { registry } from "@agent-web/core";

export async function GET() {
  try {
    const tools = registry.getToolStatus();
    const toolsets = registry.getToolsets();
    return NextResponse.json({ tools, toolsets });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, enabled, toolset } = body;

    if (name !== undefined) {
      if (enabled) registry.enableTool(name);
      else registry.disableTool(name);
    }
    if (toolset !== undefined) {
      if (enabled) registry.enableToolset(toolset);
      else registry.disableToolset(toolset);
    }

    const tools = registry.getToolStatus();
    return NextResponse.json({ tools });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

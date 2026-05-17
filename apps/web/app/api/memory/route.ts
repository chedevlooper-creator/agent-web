import { NextRequest, NextResponse } from "next/server";
import {
  listMemories,
  upsertMemory,
  deleteMemory,
  updateMemoryImportance,
} from "@/lib/db";
import type { MemoryCategory } from "@agent-web/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const memories = await listMemories(category ?? undefined);
    return NextResponse.json({ memories });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      key,
      value,
      userId,
      category,
      importance,
      context,
    } = body as {
      key?: string;
      value?: string;
      userId?: string;
      category?: MemoryCategory;
      importance?: number;
      context?: string | null;
    };

    if (!key || typeof value !== "string") {
      return NextResponse.json(
        { error: "key and value required" },
        { status: 400 }
      );
    }

    const memory = await upsertMemory({
      key,
      value,
      userId,
      category,
      importance,
      context,
    });
    return NextResponse.json({ memory });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, importance } = body as {
      key?: string;
      importance?: number;
    };

    if (!key || typeof importance !== "number") {
      return NextResponse.json(
        { error: "key and importance required" },
        { status: 400 }
      );
    }

    if (importance < 1 || importance > 5) {
      return NextResponse.json(
        { error: "importance must be between 1 and 5" },
        { status: 400 }
      );
    }

    const memory = await updateMemoryImportance(key, importance);
    if (!memory) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ memory });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    await deleteMemory(key);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

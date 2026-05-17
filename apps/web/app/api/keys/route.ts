import { NextRequest } from "next/server";
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveKeySchema = z.object({
  provider: z.string().min(1).max(100),
  key: z.string().min(1).max(2000),
});

const DeleteKeySchema = z.object({
  provider: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const keys = await listApiKeys(userId);
    return Response.json({ keys });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("GET /api/keys error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const raw = await req.json();
    const parsed = SaveKeySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const { provider, key } = parsed.data;
    await saveApiKey(provider, key, userId);
    return Response.json({
      success: true,
      provider,
      keyPreview: key.slice(0, 8) + "...",
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("POST /api/keys error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const raw = await req.json();
    const parsed = DeleteKeySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const { provider } = parsed.data;
    await deleteApiKey(provider, userId);
    return Response.json({ success: true, provider });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("DELETE /api/keys error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

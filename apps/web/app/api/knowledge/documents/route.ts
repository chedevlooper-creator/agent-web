import { NextRequest, NextResponse } from "next/server";
import {
  addDocument,
  listDocuments,
  deleteDocument,
} from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const baseId = searchParams.get("baseId");
    if (!baseId) {
      return NextResponse.json({ error: "baseId required" }, { status: 400 });
    }

    const docs = await listDocuments(baseId);
    return NextResponse.json({ documents: docs });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { baseId, filename, content, contentType } = body as {
      baseId?: string;
      filename?: string;
      content?: string;
      contentType?: string;
    };

    if (!baseId || !filename || typeof content !== "string") {
      return NextResponse.json(
        { error: "baseId, filename, and content are required" },
        { status: 400 }
      );
    }

    const doc = await addDocument(baseId, userId, filename, content, contentType);
    return NextResponse.json({ document: doc });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

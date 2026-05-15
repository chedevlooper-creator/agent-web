import { NextRequest, NextResponse } from "next/server";
import { getDocument, deleteDocument } from "@agent-web/db";
import * as fs from "fs/promises";

/**
 * GET /api/documents/[id]
 * Get a single document's metadata
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document and its file from disk
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete file from disk
    try {
      await fs.unlink(doc.storagePath);
    } catch (e) {
      // File might already be deleted, continue
      console.warn(`[Documents API] Could not delete file for doc ${id}:`, (e as Error).message);
    }

    // Delete from database
    await deleteDocument(id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

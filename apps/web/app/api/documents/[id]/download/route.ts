import { NextRequest, NextResponse } from "next/server";
import { getDocument } from "@agent-web/db";
import * as fs from "fs/promises";

/**
 * GET /api/documents/[id]/download
 * Download the original file
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Read file from disk
    let raw: Buffer;
    try {
      raw = await fs.readFile(doc.storagePath);
    } catch {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    // Return file with proper headers
    const blob = new Blob([raw.buffer as ArrayBuffer], { type: doc.mimeType });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.originalName}"`,
        "Content-Length": String(raw.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

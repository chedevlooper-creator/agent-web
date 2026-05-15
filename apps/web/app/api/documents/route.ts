import { NextRequest, NextResponse } from "next/server";
import { createDocument, listDocuments, getDocument } from "@agent-web/db";
import * as fs from "fs/promises";
import * as path from "path";

// Maximum file size: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Extension to MIME type mapping (server-side, not trusting client)
const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  return ext || "";
}

function getMimeType(extension: string): string {
  return EXT_TO_MIME[extension] || "";
}

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME));

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads/documents");

// Ensure uploads directory exists
async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * POST /api/documents
 * Upload a file (multipart/form-data)
 * Fields: file (required), sessionId (optional)
 */
export async function POST(req: NextRequest) {
  try {
    await ensureUploadsDir();

    const formData = await req.formData();
    const fileField = formData.get("file");

    if (!fileField || !(fileField instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const file = fileField as File;
    const sessionId = formData.get("sessionId") as string | null;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Validate file extension (server-side, not trusting client MIME)
    const ext = getExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file extension: .${ext}. Supported: PDF, Word, Excel, PowerPoint, images, text` },
        { status: 415 }
      );
    }

    const mimeType = getMimeType(ext);
    const id = crypto.randomUUID();
    const filename = `${id}.${ext}`;
    const storagePath = path.join(UPLOADS_DIR, filename);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(storagePath, buffer);

    // Store metadata in DB
    await createDocument({
      id,
      sessionId: sessionId || undefined,
      filename,
      originalName: file.name,
      mimeType,
      extension: ext,
      fileSize: file.size,
      storagePath,
    });

    const doc = await getDocument(id);
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    console.error("[Documents API] Upload error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/documents
 * List documents
 * Query params: sessionId, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const rows = await listDocuments({ sessionId, limit, offset });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

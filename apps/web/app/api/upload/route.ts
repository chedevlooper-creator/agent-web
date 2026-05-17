import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md",
  ".json", ".xml", ".html", ".htm", ".log", ".py", ".js", ".ts",
  ".tsx", ".jsx", ".css", ".yaml", ".yml", ".toml", ".ini", ".cfg",
  ".sh", ".bat", ".ps1", ".sql", ".env", ".gitignore",
]);

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

// Best-effort cleanup of files older than 24 hours (runs on upload)
const UPLOAD_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

async function cleanupStaleUploads(): Promise<void> {
  try {
    const dir = UPLOAD_DIR;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = join(dir, entry.name);
        const stat = await fs.stat(fullPath).catch(() => null);
        if (stat && now - stat.mtimeMs > UPLOAD_CLEANUP_AGE_MS) {
          await fs.unlink(fullPath).catch(() => {});
        }
      }
    }
  } catch { /* best-effort */ }
}

async function extractText(buffer: Buffer, ext: string, originalName: string): Promise<string> {
  const lower = ext.toLowerCase();

  // PDF
  if (lower === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text || "(PDF contained no extractable text)";
  }

  // Word DOCX
  if (lower === ".docx" || lower === ".doc") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "(Document contained no extractable text)";
  }

  // Excel / CSV
  if (lower === ".xlsx" || lower === ".xls" || lower === ".csv") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
    return sheets.join("\n\n") || "(Spreadsheet contained no data)";
  }

  // Text-based files
  const text = buffer.toString("utf-8");
  if (text.length === 0) return `(File ${originalName} is empty)`;
  return text;
}

// GET — list uploaded files
export async function GET() {
  try {
    await ensureUploadDir();
    const entries = await fs.readdir(UPLOAD_DIR);
    const files = [];
    for (const name of entries) {
      const filePath = join(UPLOAD_DIR, name);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        files.push({
          name,
          size: stat.size,
          uploadedAt: stat.mtimeMs,
        });
      }
    }
    files.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

// POST — upload and parse file
export async function POST(req: NextRequest) {
  try {
    await ensureUploadDir();
    cleanupStaleUploads().catch(() => {});

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const ext = extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = sanitizeFilename(file.name);
    const storedName = `${timestamp}_${safeName}`;
    const filePath = join(UPLOAD_DIR, storedName);

    // Save original file to disk
    await fs.writeFile(filePath, buffer);

    // Extract text content
    const textContent = await extractText(buffer, ext, file.name);

    // Truncate for LLM if too long (max ~60k chars ≈ 15k tokens)
    const MAX_CONTENT = 60_000;
    const truncated = textContent.length > MAX_CONTENT;
    const content = truncated
      ? textContent.slice(0, MAX_CONTENT) + `\n\n[... truncated, ${textContent.length - MAX_CONTENT} chars remaining ...]`
      : textContent;

    return NextResponse.json({
      ok: true,
      file: {
        name: file.name,
        storedName,
        size: file.size,
        type: ext,
        uploadedAt: timestamp,
      },
      content,
      truncated,
      totalChars: textContent.length,
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process file" },
      { status: 500 }
    );
  }
}

// DELETE — remove an uploaded file
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Missing file name" }, { status: 400 });
    }
    const filePath = join(UPLOAD_DIR, sanitizeFilename(name));
    await fs.unlink(filePath).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

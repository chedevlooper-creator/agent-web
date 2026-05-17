import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024; // 10MB

interface PreviewResult {
  type: "excel" | "csv" | "json" | "text" | "unsupported";
  filename: string;
  /** Row count (for tabular previews) */
  rows?: number;
  /** Column headers (for tabular previews) */
  headers?: string[];
  /** Data rows (for tabular previews, max 100) */
  data?: Record<string, unknown>[];
  /** Raw text content (for text/json previews) */
  content?: string;
  error?: string;
}

function isSafePath(p: string): boolean {
  const resolved = join(UPLOAD_DIR, p);
  return resolved.startsWith(UPLOAD_DIR) && !p.includes("..");
}

async function previewExcel(filePath: string): Promise<PreviewResult> {
  const XLSX = await import("xlsx");
  const buf = await readFile(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { type: "excel", filename: "", error: "No sheets found" };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return {
    type: "excel",
    filename: "",
    rows: rows.length,
    headers,
    data: rows.slice(0, 100),
  };
}

async function previewCSV(filePath: string): Promise<PreviewResult> {
  const text = await readFile(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { type: "csv", filename: "", headers: [], data: [], rows: 0 };
  const headers = parseCSVLine(lines[0]);
  const data = lines.slice(1, 101).map((line) => {
    const vals = parseCSVLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
  return { type: "csv", filename: "", rows: lines.length - 1, headers, data };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

async function previewJSON(filePath: string): Promise<PreviewResult> {
  const text = await readFile(filePath, "utf-8");
  const MAX_CHARS = 50_000;
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n... (truncated)" : text;
  let prettified: string;
  try {
    prettified = JSON.stringify(JSON.parse(truncated), null, 2);
  } catch {
    prettified = truncated;
  }
  return { type: "json", filename: "", content: prettified };
}

async function previewText(filePath: string): Promise<PreviewResult> {
  const MAX_CHARS = 50_000;
  const text = await readFile(filePath, "utf-8");
  return {
    type: "text",
    filename: "",
    content: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n... (truncated)" : text,
  };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { path: filePath } = (await req.json()) as { path?: string };
    if (!filePath) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }
    if (!isSafePath(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const fullPath = join(UPLOAD_DIR, filePath);

    // Verify file exists and is within size limit
    try {
      const st = await stat(fullPath);
      if (st.size > MAX_PREVIEW_BYTES) {
        return NextResponse.json(
          { type: "unsupported", filename: filePath, error: "File too large to preview" },
          { status: 200 }
        );
      }
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = filePath.split(".").pop()?.toLowerCase();
    let result: PreviewResult;

    if (ext === "xlsx" || ext === "xls" || ext === "numbers") {
      result = await previewExcel(fullPath);
    } else if (ext === "csv" || ext === "tsv") {
      result = await previewCSV(fullPath);
    } else if (ext === "json") {
      result = await previewJSON(fullPath);
    } else if (
      ext &&
      ["txt", "md", "log", "yaml", "yml", "toml", "ini", "cfg", "env", "xml", "html", "css", "js", "ts", "py", "sh"].includes(ext)
    ) {
      result = await previewText(fullPath);
    } else {
      result = { type: "unsupported", filename: filePath };
    }

    result.filename = filePath;
    return NextResponse.json(result);
  } catch (e: unknown) {
    return handleApiError(e, req);
  }
}

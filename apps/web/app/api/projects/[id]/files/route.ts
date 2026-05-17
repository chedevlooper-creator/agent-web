import { NextRequest, NextResponse } from "next/server";
import { getDb, projects } from "@agent-web/db";
import { eq } from "drizzle-orm";
import { ensureMigrated } from "@agent-web/db";
import { promises as fs } from "node:fs";
import { join, relative, extname } from "node:path";
import { getUserIdFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface FileEntry {
  name: string;
  path: string;
  size: number;
  ext: string;
  modifiedAt: number;
}

async function listFilesRecursive(dir: string, baseDir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.name.startsWith(".")) continue; // skip hidden
      if (item.isDirectory()) {
        const nested = await listFilesRecursive(fullPath, baseDir);
        entries.push(...nested);
      } else if (item.isFile()) {
        const stat = await fs.stat(fullPath);
        entries.push({
          name: item.name,
          path: relative(baseDir, fullPath).replace(/\\/g, "/"),
          size: stat.size,
          ext: extname(item.name),
          modifiedAt: stat.mtimeMs,
        });
      }
    }
  } catch {}
  return entries;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await params;
    await ensureMigrated();
    const db = getDb();

    const rows = await db.select().from(projects).where(eq(projects.id, id));
    const project = rows[0];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If a specific file path is requested, read its content
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");
    if (filePath) {
      const absPath = join(project.rootPath, filePath);
      // Security: ensure resolved path is within project
      if (!absPath.startsWith(project.rootPath)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      try {
        const stat = await fs.stat(absPath);
        if (stat.isFile() && stat.size < 500_000) {
          const content = await fs.readFile(absPath, "utf-8");
          return NextResponse.json({ content });
        }
        return NextResponse.json({ content: "[binary or too large]" });
      } catch {
        return NextResponse.json({ content: "[error reading file]" });
      }
    }

    const files = await listFilesRecursive(project.rootPath, project.rootPath);
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return NextResponse.json({ files });
  } catch (e) {
    console.error("GET /api/projects/[id]/files failed:", e);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

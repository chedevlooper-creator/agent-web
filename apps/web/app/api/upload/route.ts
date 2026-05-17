import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

// Ensure upload dir exists
async function ensureDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDir();

    const formData = await req.formData();
    const files: { name: string; path: string; size: number }[] = [];

    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const name = value.name;
        const buffer = Buffer.from(await value.arrayBuffer());
        const safeName = name.replace(/[<>:"/\\|?*]/g, "_");
        const filePath = join(UPLOAD_DIR, safeName);

        // Append timestamp if file exists
        let finalPath = filePath;
        let counter = 1;
        while (await fileExists(finalPath)) {
          const dot = safeName.lastIndexOf(".");
          const base = dot > 0 ? safeName.slice(0, dot) : safeName;
          const ext = dot > 0 ? safeName.slice(dot) : "";
          finalPath = join(UPLOAD_DIR, `${base}_${counter}${ext}`);
          counter++;
        }

        await writeFile(finalPath, buffer);
        files.push({ name: safeName, path: finalPath, size: buffer.length });
      }
    }

    return NextResponse.json({ files });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

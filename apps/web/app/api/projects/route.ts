import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject, updateProject, deleteProject } from "@/lib/db";
import { genId } from "@/lib/store";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("GET /api/projects failed:", e);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "New Project").trim().slice(0, 100) || "New Project";

    const id = genId();
    const rootPath = join(process.cwd(), "data", "projects", id);

    await mkdir(rootPath, { recursive: true });

    const project = await createProject({ id, name, rootPath });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects failed:", e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await updateProject(id, { name: String(name || "").trim().slice(0, 100) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/projects failed:", e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects failed:", e);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}

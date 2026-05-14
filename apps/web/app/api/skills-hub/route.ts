import { NextRequest, NextResponse } from "next/server";
import { db, skills_new } from "@agent-web/db";
import { eq, like, desc, or } from "drizzle-orm";
import { skillManager } from "@agent-web/core";

// Skills Hub: browse, search, install, inspect, check updates, update

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "list";

    // GET /api/skills-hub?action=browse&source=official
    if (action === "browse") {
      const source = searchParams.get("source") || "all";
      const category = searchParams.get("category") || undefined;

      let skills = await db.select().from(skills_new).orderBy(desc(skills_new.createdAt));

      if (source !== "all") {
        skills = skills.filter((s) => s.source === source);
      }
      if (category) {
        skills = skills.filter((s) => s.category === category);
      }

      return NextResponse.json({ skills, source, category });
    }

    // GET /api/skills-hub?action=search&q=kubernetes
    if (action === "search") {
      const query = searchParams.get("q") || "";
      const skills = await db
        .select()
        .from(skills_new)
        .where(
          or(
            like(skills_new.name, `%${query}%`),
            like(skills_new.description, `%${query}%`)
          )
        )
        .orderBy(desc(skills_new.usageCount));

      return NextResponse.json({ skills, query, count: skills.length });
    }

    // GET /api/skills-hub?action=inspect&identifier=git-pr-workflow
    if (action === "inspect") {
      const identifier = searchParams.get("identifier") || "";
      if (!identifier) {
        return NextResponse.json({ error: "identifier is required" }, { status: 400 });
      }
      const rows = await db
        .select()
        .from(skills_new)
        .where(eq(skills_new.name, identifier))
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }
      return NextResponse.json(rows[0]);
    }

    // Default: list all skills with hub metadata
    const skills = await db.select().from(skills_new).orderBy(desc(skills_new.createdAt));
    return NextResponse.json({ skills });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // POST { action: "install", source, identifier }
    if (action === "install") {
      const source = body.source || "local";
      const identifier = body.identifier;
      if (!identifier) {
        return NextResponse.json({ error: "identifier is required" }, { status: 400 });
      }

      // Install from hub with security scan
      const installedPath = await skillManager.installSkill(source, identifier, { force: body.force });
      return NextResponse.json({ installed: installedPath, identifier });
    }

    // POST { action: "check" } - check for upstream updates
    if (action === "check") {
      const localSkills = await db.select().from(skills_new).where(eq(skills_new.source, "hub"));
      const updates = [];
      for (const skill of localSkills) {
        // Check if there's a newer version upstream
        const upstream = await skillManager.scanForSkillsFromHub(skill.source ?? "hub", skill.name);
        if (upstream.length > 0 && upstream[0].version !== skill.version) {
          updates.push({
            name: skill.name,
            currentVersion: skill.version,
            latestVersion: upstream[0].version,
          });
        }
      }
      return NextResponse.json({ updates, count: updates.length });
    }

    // POST { action: "update", name }
    if (action === "update") {
      const name = body.name;
      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      const upstream = await skillManager.scanForSkillsFromHub("official", name);
      if (upstream.length === 0) {
        return NextResponse.json({ error: "No upstream version found" }, { status: 404 });
      }
      const result = await skillManager.installSkill("official", name, { force: true });
      return NextResponse.json({ updated: name, installedAt: result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

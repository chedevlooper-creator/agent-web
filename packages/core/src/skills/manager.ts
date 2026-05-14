import { db, skills_new, skillFiles } from "@agent-web/db";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { parseSkillMarkdown, type SkillFrontmatter } from "./parser.js";

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  content: string;
  frontmatter: SkillFrontmatter;
  category: string;
  usageCount: number;
  successCount: number;
  version: string;
  source: string;
  sourceUrl: string | null;
  trustLevel: "builtin" | "official" | "trusted" | "community";
  enabled: boolean;
}

export interface CreateSkillOpts {
  name: string;
  description: string;
  content: string;
  category?: string;
  tags?: string[];
  platforms?: string[];
  source?: string;
  sourceUrl?: string;
  trustLevel?: "builtin" | "official" | "trusted" | "community";
}

export interface HubSkill {
  identifier: string;
  name: string;
  description: string;
  category: string;
  version: string;
  source: string;
  weeklyInstalls?: number;
}

export interface ScanResult {
  safe: boolean;
  verdict: "safe" | "caution" | "dangerous";
  findings: string[];
}

export class SkillManager {
  async loadAll(): Promise<SkillMetadata[]> {
    const rows = await db.select().from(skills_new).orderBy(desc(skills_new.usageCount));
    return rows
      .filter((r) => r.enabled)
      .map((row) => this.rowToMetadata(row));
  }

  async getSkillContent(name: string): Promise<{ metadata: SkillMetadata; content: string } | null> {
    const rows = await db.select().from(skills_new).where(eq(skills_new.name, name)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    if (!row.enabled) return null;
    return {
      metadata: this.rowToMetadata(row),
      content: row.content,
    };
  }

  async getSkillReference(skillName: string, refPath: string): Promise<string | null> {
    const skillRows = await db.select().from(skills_new).where(eq(skills_new.name, skillName)).limit(1);
    if (skillRows.length === 0) return null;
    const skill = skillRows[0];
    const fileRows = await db.select().from(skillFiles).where(
      and(
        eq(skillFiles.skillId, skill.id),
        like(skillFiles.path, `%${refPath}%`)
      )
    ).limit(1);
    if (fileRows.length === 0) return null;
    return fileRows[0].content;
  }

  async loadForPrompt(name: string): Promise<string> {
    const content = await this.getSkillContent(name);
    if (!content) return "";
    return `\n\n[Skill: ${content.metadata.name}]\n${content.metadata.description}\n\nInstructions:\n${content.content}`;
  }

  async createSkill(opts: CreateSkillOpts): Promise<string> {
    const id = crypto.randomUUID();
    const frontmatter: SkillFrontmatter = {
      name: opts.name,
      description: opts.description,
      version: "1.0.0",
      platforms: opts.platforms,
      metadata: {
        hermes: {
          tags: opts.tags ?? [],
          category: opts.category ?? "general",
        },
      },
    };

    await db.insert(skills_new).values({
      id,
      name: opts.name,
      description: opts.description,
      content: opts.content,
      frontmatter: JSON.stringify(frontmatter),
      category: opts.category ?? "general",
      source: opts.source ?? "local",
      sourceUrl: opts.sourceUrl ?? null,
      trustLevel: opts.trustLevel ?? "community",
    });
    return id;
  }

  async patchSkill(name: string, oldString: string, newString: string): Promise<void> {
    const rows = await db.select().from(skills_new).where(eq(skills_new.name, name)).limit(1);
    if (rows.length === 0) throw new Error(`Skill "${name}" not found`);
    const skill = rows[0];
    if (!skill.content.includes(oldString)) {
      throw new Error(`Old string not found in skill "${name}"`);
    }
    const updatedContent = skill.content.replace(oldString, newString);
    await db.update(skills_new).set({
      content: updatedContent,
      updatedAt: new Date(),
      version: incrementVersion(skill.version ?? "1.0.0"),
    }).where(eq(skills_new.id, skill.id));
  }

  async editSkill(name: string, newContent: string): Promise<void> {
    const parsed = parseSkillMarkdown(newContent);
    if (!parsed) throw new Error("Invalid SKILL.md format - missing frontmatter");
    const rows = await db.select().from(skills_new).where(eq(skills_new.name, name)).limit(1);
    if (rows.length === 0) throw new Error(`Skill "${name}" not found`);
    await db.update(skills_new).set({
      content: parsed.body,
      description: parsed.frontmatter.description,
      frontmatter: JSON.stringify(parsed.frontmatter),
      updatedAt: new Date(),
      version: incrementVersion(rows[0].version ?? "1.0.0"),
    }).where(eq(skills_new.id, rows[0].id));
  }

  async deleteSkill(name: string): Promise<void> {
    await db.delete(skills_new).where(eq(skills_new.name, name));
  }

  async toggleSkill(name: string, enabled: boolean): Promise<void> {
    await db.update(skills_new).set({ enabled }).where(eq(skills_new.name, name));
  }

  async incrementUsage(name: string, success: boolean): Promise<void> {
    await db.update(skills_new).set({
      usageCount: sql`${skills_new.usageCount} + 1`,
      successCount: sql`${skills_new.successCount} + ${success ? 1 : 0}`,
      updatedAt: new Date(),
    }).where(eq(skills_new.name, name));
  }

  securityScan(content: string): ScanResult {
    const findings: string[] = [];
    const dangerousPatterns = [
      /fetch\s*\(\s*['"]https?:\/\/[^'"]*\/exfil/i,
      /document\.cookie/i,
      /localStorage\.getItem/i,
      /process\.env/i,
      /require\s*\(\s*['"]child_process['"]\)/i,
      /exec\s*\(/i,
      /eval\s*\(/i,
      /new\s+Function\s*\(/i,
      /__proto__/i,
      /constructor\[['"]/,
    ];
    let verdict: "safe" | "caution" | "dangerous" = "safe";
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        verdict = "dangerous";
        findings.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }
    if (/ignore.*previous.*instructions/i.test(content) || /you are now/i.test(content)) {
      verdict = "caution";
      findings.push("Potential prompt injection pattern detected");
    }
    if (/[\u200B-\u200D\uFEFF\u202A-\u202E]/.test(content)) {
      findings.push("Hidden unicode characters detected");
      if (verdict === "safe") verdict = "caution";
    }
    return { safe: verdict !== "dangerous", verdict, findings };
  }

  applyConditionalActivation(skill: SkillMetadata, availableToolsets?: Set<string>): boolean {
    const hermes = skill.frontmatter.metadata?.hermes;
    if (!hermes) return true;
    if (hermes.requires_toolsets && availableToolsets) {
      for (const ts of hermes.requires_toolsets) {
        if (!availableToolsets.has(ts)) return false;
      }
    }
    if (hermes.fallback_for_toolsets && availableToolsets) {
      for (const ts of hermes.fallback_for_toolsets) {
        if (availableToolsets.has(ts)) return false;
      }
    }
    return true;
  }

  async getSkillsList(): Promise<string> {
    const skills = await this.loadAll();
    return skills.map((s) => `- ${s.name}: ${s.description} [category: ${s.frontmatter.metadata?.hermes?.category ?? s.category}]`).join("\n");
  }

  async installSkill(source: string, identifier: string, opts?: { force?: boolean }): Promise<string> {
    const existing = await db.select().from(skills_new).where(eq(skills_new.name, identifier)).limit(1);
    if (existing.length > 0 && !opts?.force) {
      return existing[0].id;
    }
    throw new Error(
      `Hub install for "${identifier}" from "${source}" is not available offline. Import via /api/skills-new instead.`
    );
  }

  async scanForSkillsFromHub(_source: string, _query?: string): Promise<HubSkill[]> {
    return [];
  }

  private rowToMetadata(row: typeof skills_new.$inferSelect): SkillMetadata {
    let frontmatter: SkillFrontmatter;
    try {
      frontmatter = row.frontmatter ? JSON.parse(row.frontmatter) : {
        name: row.name,
        description: row.description,
        version: row.version ?? "1.0.0",
        metadata: { hermes: { tags: [], category: row.category ?? "general" } },
      };
    } catch {
      frontmatter = {
        name: row.name,
        description: row.description,
        version: row.version ?? "1.0.0",
        metadata: { hermes: { tags: [], category: row.category ?? "general" } },
      };
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      frontmatter,
      category: row.category ?? "general",
      usageCount: row.usageCount ?? 0,
      successCount: row.successCount ?? 0,
      version: row.version ?? "1.0.0",
      source: row.source ?? "local",
      sourceUrl: row.sourceUrl,
      trustLevel: (row.trustLevel as SkillMetadata["trustLevel"]) ?? "community",
      enabled: row.enabled ?? true,
    };
  }
}

function incrementVersion(version: string): string {
  const parts = version.split(".");
  const patch = parseInt(parts[2] ?? "0", 10) + 1;
  return `${parts[0]}.${parts[1] ?? "0"}.${patch}`;
}

export const skillManager = new SkillManager();

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";

interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

function parseSkillMd(filePath: string): { name: string; description: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);

    const name = nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    let description = descMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (description.length > 200) {
      description = description.slice(0, 197) + "...";
    }

    return name ? { name, description } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const skills: SkillInfo[] = [];

    // Scan .verdent/skills in project root
    const projectRoot = process.cwd();
    const skillsDirs = [
      path.join(projectRoot, ".verdent", "skills"),
    ];

    // Also check user home
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    if (homeDir) {
      skillsDirs.push(path.join(homeDir, ".verdent", "skills"));
      skillsDirs.push(path.join(homeDir, ".agents", "skills"));
    }

    for (const skillsDir of skillsDirs) {
      let exists = false;
      try {
        exists = fs.existsSync(skillsDir);
      } catch {
        continue;
      }
      if (!exists) continue;

      try {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
          if (!fs.existsSync(skillMdPath)) continue;

          const parsed = parseSkillMd(skillMdPath);
          if (parsed && !skills.some((s) => s.name === parsed.name)) {
            skills.push({
              name: parsed.name,
              description: parsed.description,
              path: path.relative(projectRoot, path.join(skillsDir, entry.name)),
            });
          }
        }
      } catch {
        // Skip dirs we can't read
      }
    }

    return NextResponse.json(skills);
  } catch (e: unknown) {
    return handleApiError(e);
  }
}

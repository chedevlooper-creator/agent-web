import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import {
  getObsidianConfig,
  setObsidianConfig,
  deleteObsidianConfig,
} from "@/lib/db";
import { resolveVaultPath, validateVaultPath } from "@/lib/obsidian";

export const dynamic = "force-dynamic";

const SetConfigSchema = z.object({
  vaultPath: z.string().min(1).max(2000),
});

/**
 * GET /api/obsidian/config
 * Returns the current Obsidian vault configuration.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const envVaultPath = resolveVaultPath();
    let vaultPath = envVaultPath;

    // Per-user override takes precedence
    const userConfig = await getObsidianConfig(userId);
    if (userConfig?.vaultPath) {
      vaultPath = userConfig.vaultPath;
    }

    return NextResponse.json({
      vaultPath: vaultPath || "",
      configured: !!vaultPath,
      configuredInEnv: !!envVaultPath,
      configuredPerUser: !!userConfig?.vaultPath,
    });
  } catch (e: unknown) {
    console.error("Obsidian config GET error:", e);
    return handleApiError(e, req);
  }
}

/**
 * POST /api/obsidian/config
 * Body: { vaultPath: string }
 * Sets the user's per-user vault path override.
 * Validates that the path exists before saving.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SetConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { vaultPath } = parsed.data;

    // Validate the path exists
    const validationError = await validateVaultPath(vaultPath);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await setObsidianConfig(userId, vaultPath);

    return NextResponse.json({ ok: true, vaultPath });
  } catch (e: unknown) {
    console.error("Obsidian config POST error:", e);
    return handleApiError(e, req);
  }
}

/**
 * DELETE /api/obsidian/config
 * Clears the per-user vault path override.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    await deleteObsidianConfig(userId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("Obsidian config DELETE error:", e);
    return handleApiError(e, req);
  }
}

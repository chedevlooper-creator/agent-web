import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  getSession,
  listMessages,
  getObsidianConfig,
} from "@/lib/db";
import {
  syncSessionToVault,
  deleteSessionFromVault,
  resolveVaultPath,
  validateVaultPath,
} from "@/lib/obsidian";

export const dynamic = "force-dynamic";

/**
 * POST /api/obsidian/sync
 * Body: { sessionId: string, vaultPath?: string }
 * Syncs a single session to the Obsidian vault.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, vaultPath: explicitVaultPath } = body;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Resolve vault path: explicit > DB per-user > env var
    let vaultPath = explicitVaultPath || null;
    if (!vaultPath) {
      const config = await getObsidianConfig(userId);
      vaultPath = config?.vaultPath || resolveVaultPath();
    }

    if (!vaultPath) {
      return NextResponse.json(
        { error: "Obsidian vault path not configured. Set OBSIDIAN_VAULT_PATH in env or configure in settings." },
        { status: 400 }
      );
    }

    // Validate vault path
    const validationError = await validateVaultPath(vaultPath);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Fetch session and messages
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await listMessages(sessionId);

    // Sync to vault
    const writtenPath = await syncSessionToVault(session, messages, vaultPath);

    return NextResponse.json({
      ok: true,
      path: writtenPath,
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("Obsidian sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/obsidian/sync?sessionId=xxx&vaultPath=xxx
 * Deletes a session's note from the Obsidian vault.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId query parameter is required" }, { status: 400 });
    }

    // Resolve vault path
    let vaultPath: string | null = null;
    const config = await getObsidianConfig(userId);
    vaultPath = config?.vaultPath || resolveVaultPath();

    if (!vaultPath) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Vault not configured" });
    }

    // Fetch session for filename generation
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Session not found in DB" });
    }

    const deletedPath = await deleteSessionFromVault(session, vaultPath);

    return NextResponse.json({
      ok: true,
      deleted: deletedPath !== null,
      path: deletedPath,
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("Obsidian delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

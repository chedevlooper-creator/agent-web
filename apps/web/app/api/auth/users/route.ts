import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, listAllUsers } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const userId = await validateSession(token);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const users = await listAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

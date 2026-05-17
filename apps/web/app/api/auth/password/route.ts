import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, updateUserPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const userId = await validateSession(token);
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    await updateUserPassword(userId, newPassword);

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}

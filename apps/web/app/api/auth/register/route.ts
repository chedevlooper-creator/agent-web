import { NextResponse } from "next/server";
import {
  createUser,
  findUserByUsername,
  validateUsername,
  validatePassword,
  isReservedUsername,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (isReservedUsername(username)) {
      return NextResponse.json({ error: "This username is reserved" }, { status: 400 });
    }

    const existing = await findUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    const user = await createUser(username, password);

    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}

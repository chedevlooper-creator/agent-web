import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@agent-web/db";
import { users } from "@agent-web/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const db = getDb();
        const userRows = await db
          .select()
          .from(users)
          .where(eq(users.username, credentials.username as string))
          .limit(1);

        if (userRows.length === 0) return null;

        const valid = await compare(credentials.password as string, userRows[0].passwordHash);
        if (!valid) return null;

        return {
          id: userRows[0].id,
          name: userRows[0].username,
          email: userRows[0].email || null,
          image: userRows[0].avatarUrl || null,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.AUTH_GITHUB_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;

      if (!user.email) return false;

      const db = getDb();

      // Check if user exists by email
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (existing.length > 0) {
        // Link OAuth provider to existing user
        await db
          .update(users)
          .set({
            provider: (account?.provider as "google" | "github") || "credentials",
            providerId: account?.providerAccountId || null,
            avatarUrl: user.image || existing[0].avatarUrl,
          })
          .where(eq(users.id, existing[0].id));
        return true;
      }

      // Create new user via OAuth
      const bcrypt = await import("bcryptjs");
      const crypto = await import("node:crypto");
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      await db.insert(users).values({
        id: crypto.randomUUID().slice(0, 12),
        username: user.email.split("@")[0],
        email: user.email,
        avatarUrl: user.image || null,
        passwordHash: hashedPassword,
        provider: (account?.provider as "google" | "github") || "credentials",
        providerId: account?.providerAccountId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
      }
      return session;
    },
    async jwt({ token, account, user }) {
      if (account) {
        token.provider = account.provider;
      }
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});

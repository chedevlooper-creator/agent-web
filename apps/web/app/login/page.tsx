"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push(redirectTo);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[--void-deep] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <h1 className="text-2xl font-semibold text-[--fg-primary] mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-[--fg-secondary] mb-8">
          Log in to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm animate-slide-down">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[--fg-secondary]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] placeholder-[--fg-muted] focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[--fg-secondary]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] placeholder-[--fg-muted] focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[--electric] text-[--void-deep] font-medium hover:bg-[--electric-hover] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[--fg-muted]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[--electric] hover:text-[--electric-hover] transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

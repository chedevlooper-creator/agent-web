"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[--void-deep] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {success ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-[--fg-primary]">
              Account created!
            </h1>
            <p className="text-[--fg-secondary]">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-[--fg-primary] mb-2">
              Create Account
            </h1>
            <p className="text-sm text-[--fg-secondary] mb-8">
              Enter a username and password to get started
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
                  placeholder="Choose a username"
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
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] placeholder-[--fg-muted] focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all duration-200"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-[--electric] text-[--void-deep] font-medium hover:bg-[--electric-hover] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[--fg-muted]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[--electric] hover:text-[--electric-hover] transition-colors"
              >
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

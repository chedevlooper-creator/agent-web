"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const currentUser = useChatStore((s) => s.currentUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) router.push("/login");
  }, [currentUser, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Şifre güncellenemedi");
        return;
      }
      setMessage("Şifre başarıyla güncellendi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Ağ hatası");
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-dvh bg-[--void-deep] p-4">
      <div className="max-w-md mx-auto pt-12">
        <button onClick={() => router.push("/")} className="text-sm text-[--fg-secondary] hover:text-[--electric] mb-6 transition-colors">
          &larr; Sohbete Dön
        </button>

        <h1 className="text-2xl font-semibold text-[--fg-primary] mb-2">Profil</h1>
        <p className="text-sm text-[--fg-secondary] mb-8">
          Giriş yapan: <span className="text-[--electric] font-medium">{currentUser.username}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {message && (
            <div className="p-3 rounded-lg bg-green-950/50 border border-green-900/50 text-green-400 text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="currentPassword" className="block text-sm font-medium text-[--fg-secondary]">
              Mevcut Şifre
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] focus:outline-none focus:ring-2 focus:ring-[--electric]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-sm font-medium text-[--fg-secondary]">
              Yeni Şifre
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] focus:outline-none focus:ring-2 focus:ring-[--electric]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[--fg-secondary]">
              Yeni Şifreyi Onayla
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[--chrome] border border-[--border] text-[--fg-primary] focus:outline-none focus:ring-2 focus:ring-[--electric]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[--electric] text-[--void-deep] font-medium hover:bg-[--electric-hover] disabled:opacity-50 transition-all"
          >
            {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store";

export default function AdminPage() {
  const router = useRouter();
  const currentUser = useChatStore((s) => s.currentUser);
  const [users, setUsers] = useState<{ id: string; username: string; createdAt: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser, router]);

  if (!currentUser) return null;

  return (
    <div className="min-h-dvh bg-[--void-deep] p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <button onClick={() => router.push("/")} className="text-sm text-[--fg-secondary] hover:text-[--electric] mb-6 transition-colors">
          &larr; Sohbete Dön
        </button>

        <h1 className="text-2xl font-semibold text-[--fg-primary] mb-2">Yönetici Paneli</h1>
        <p className="text-sm text-[--fg-secondary] mb-8">
          Kayıtlı kullanıcılar
        </p>

        {loading ? (
          <p className="text-[--fg-muted]">Yükleniyor...</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[--chrome] border border-[--border]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-electric/20 border border-electric/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-electric">
                      {u.username[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[--fg-primary]">{u.username}</p>
                    <p className="text-xs text-[--fg-muted]">
                      Katılma {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {u.id === currentUser.id && (
                  <span className="text-xs px-2 py-1 rounded bg-electric/10 text-electric">Sen</span>
                )}
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-[--fg-muted] text-sm">Kullanıcı bulunamadı.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

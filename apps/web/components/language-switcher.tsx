"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";

const LOCALES = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  const switchLocale = (next: string) => {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5">
      <Languages size={12} className="text-[var(--ink-faint)]" />
      <select
        value={locale}
        onChange={(e) => switchLocale(e.target.value)}
        className="h-6 rounded border border-[var(--rule-soft)] bg-[var(--bg-subtle)] px-1.5 text-[11px] text-[var(--ink)] outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

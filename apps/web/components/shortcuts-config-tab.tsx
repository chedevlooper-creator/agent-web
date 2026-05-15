"use client";

import { useMemo } from "react";
import { useChatStore } from "@/lib/store";
import {
  getCategoriesWithShortcuts,
  getShortcutDef,
  getShortcutKeys,
  SHORTCUT_DEFINITIONS,
} from "@/lib/shortcuts-config";
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder";
import { Separator } from "@/components/ui/separator";
import { Keyboard, RotateCcw, Info } from "lucide-react";

export function ShortcutsConfigTab() {
  const { shortcutOverrides, updateShortcut, resetShortcut } = useChatStore();
  const categories = useMemo(
    () => getCategoriesWithShortcuts(shortcutOverrides),
    [shortcutOverrides]
  );

  const handleResetAll = () => {
    for (const def of SHORTCUT_DEFINITIONS) {
      resetShortcut(def.id);
    }
  };

  const totalOverrides = Object.keys(shortcutOverrides).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold">Kısayol Ayarları</h3>
          {totalOverrides > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2.5 h-7 rounded-lg hover:bg-surface-muted transition-all"
            >
              <RotateCcw size={11} />
              Tümünü sıfırla
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Klavye kısayollarını özelleştirmek için bir kısayola tıklayın
          ve ardından yeni tuş kombinasyonuna basın.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-info/5 border border-info/20">
        <Info size={14} className="text-info shrink-0 mt-0.5" />
        <p className="text-[11px] text-info/80 leading-relaxed">
          Değişiklikler otomatik olarak kaydedilir. Aynı tuş kombinasyonunu birden
          fazla kısayola atamaktan kaçının. Kısayollar yalnızca bir metin alanı odakta
          değilken çalışır.
        </p>
      </div>

      <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
        {categories.map((category) => (
          <div key={category.title}>
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Keyboard size={10} />
              {category.title}
            </h4>
            <div className="space-y-2.5">
              {category.shortcuts.map((shortcut) => {
                const def = getShortcutDef(shortcut.id);
                if (!def) return null;

                const currentKeys =
                  shortcutOverrides[shortcut.id] ?? def.defaultKeys;

                // Check for conflicts (including other customized shortcuts)
                const conflictIds = SHORTCUT_DEFINITIONS.filter((other) => {
                  if (other.id === shortcut.id) return false;
                  if (other.handler !== def.handler) return false;
                  const otherKeys = getShortcutKeys(other.id, shortcutOverrides);
                  return currentKeys.some((key) => otherKeys.includes(key as any));
                }).map((o) => o.id);

                return (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between text-xs gap-3 p-2.5 rounded-xl bg-surface-muted/30 hover:bg-surface-muted/50 transition-colors border border-transparent hover:border-border/30"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground">
                        {shortcut.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {shortcut.description}
                      </span>
                    </div>
                    <ShortcutKeyRecorder
                      currentKeys={currentKeys}
                      defaultKeys={def.defaultKeys}
                      onSave={(keys) => updateShortcut(shortcut.id, keys)}
                      onReset={() => resetShortcut(shortcut.id)}
                      hasConflict={conflictIds.length > 0}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
        Özelleştirilmiş kısayollar tarayıcıda kaydedilir ve tüm oturumlarda geçerlidir.
        <br />
        Tarayıcı varsayılan kısayollarıyla çakışan bazı kombinasyonlar
        çalışmayabilir.
      </p>
    </div>
  );
}

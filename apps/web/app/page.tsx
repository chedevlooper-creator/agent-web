"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SettingsPanel } from "@/components/settings-panel";
import { ContextPanel } from "@/components/layout/context-panel";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { useChatStore, useActiveSession } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  PanelLeft,
  PanelRight,
  Cloud,
  CloudUpload,
  Trash2,
  Activity,
  Box,
  ChevronDown,
  Database,
  FolderOpen,
  GitBranch,
  Globe,
  ListTodo,
  Monitor,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

function SyncIndicator() {
  const syncing = useChatStore((s) => s.syncing);
  return (
    <div
      className={cn(
        "flex min-h-[40px] items-center gap-2 rounded-none border-l border-border/70 px-4 text-[11px] font-semibold uppercase transition-[background-color,border-color,color] duration-300",
        syncing
          ? "bg-electric-muted/60 text-electric"
          : "bg-chrome-muted/40 text-fg-secondary"
      )}
    >
      {syncing ? (
        <>
          <CloudUpload size={12} className="animate-pulse" />
          <span className="hidden sm:inline">Senkronize ediliyor</span>
        </>
      ) : (
        <>
          <Cloud size={12} />
          <span className="hidden sm:inline">Hazır</span>
        </>
      )}
    </div>
  );
}

function ModelBadge() {
  const provider = useChatStore((s) => s.provider);
  const model = useChatStore((s) => s.model);
  const compareMode = useChatStore((s) => s.compareMode);
  const selectedModels = useChatStore((s) => s.selectedModels);

  const displayModel =
    compareMode && selectedModels.length > 1
      ? selectedModels.join(" vs ")
      : model;

  return (
    <div
      className="hidden sm:flex min-h-[48px] min-w-[318px] shrink-0 items-center gap-3 border-l border-r border-border/70 bg-chrome-muted/40 px-5 text-[11px] transition-all duration-300 group cursor-default"
      title={`${provider} / ${displayModel}`}
    >
      <span className="section-label">Model</span>
      <span className="min-w-0 truncate whitespace-nowrap font-mono text-fg-primary">
        <span className="text-fg-secondary">{provider} / </span>
        {displayModel}
      </span>
      <div className="h-1.5 w-1.5 rounded-full bg-electric shadow-[0_0_16px_rgba(176,226,39,0.8)] group-hover:animate-pulse" />
      <ChevronDown size={14} className="ml-auto text-electric" aria-hidden="true" />
    </div>
  );
}

function SessionTitle() {
  const session = useActiveSession();
  const title = session?.title || "Yeni Sohbet";

  return (
    <h1 className="text-sm font-semibold truncate max-w-[180px] sm:max-w-[300px] text-fg-primary">
      {title}
    </h1>
  );
}

type CommandMode = "Term" | "Files" | "Web" | "DB" | "Git" | "Tasks";

const COMMANDS: { label: CommandMode; display: string; icon: typeof Terminal }[] = [
  { label: "Term", display: "Terminal", icon: Terminal },
  { label: "Files", display: "Dosyalar", icon: FolderOpen },
  { label: "Web", display: "Web", icon: Globe },
  { label: "DB", display: "DB", icon: Database },
  { label: "Git", display: "Git", icon: GitBranch },
  { label: "Tasks", display: "Görevler", icon: ListTodo },
];

const COMMAND_MODE_META: Record<
  CommandMode,
  {
    title: string;
    eyebrow: string;
    description: string;
    status: string;
    prompt: string;
    lines: string[];
    actions: { label: string; prompt: string }[];
  }
> = {
  Term: {
    title: "Terminal Modu",
    eyebrow: "Yerel komut kanalı",
    description: "Terminal destekli talimatlar hazırlayın ve aktif komut hattını görünür tutun.",
    status: "Hazır",
    prompt: "Sistem bilgilerini göstermek için terminali kullan",
    lines: ["Shell köprüsü etkin", "Çalışma alanı kapsamında", "Komut onayı bekleniyor"],
    actions: [
      { label: "Sistem bilgisi", prompt: "Sistem bilgilerini göstermek için terminali kullan" },
      { label: "Git durumu", prompt: "Git status çalıştır ve mevcut dal durumunu özetle" },
      { label: "Proje listele", prompt: "Proje kök dosyalarını listelemek için terminali kullan" },
    ],
  },
  Files: {
    title: "Dosya Modu",
    eyebrow: "Çalışma alanı dosya gezgini",
    description: "Dosya inceleme görevlerini hazırlayın ve göndermeden önce çalışma alanı bağlamını gösterin.",
    status: "Dizinlendi",
    prompt: "Proje dosyalarını göster: ",
    lines: ["Proje kökü seçildi", "Okuma/yazma araçları mevcut", "Yol koruması etkin"],
    actions: [
      { label: "Kökü göster", prompt: "Proje dosyalarını göster: " },
      { label: "UI dosyalarını bul", prompt: "UI düzen bileşenleri için dosyaları ara" },
      { label: "Tasarım sistemini oku", prompt: "apps/web/DESIGN_SYSTEM.md dosyasını oku ve ilgili UI kurallarını özetle" },
    ],
  },
  Web: {
    title: "Web Modu",
    eyebrow: "Araştırma ve getirme hattı",
    description: "Tarayıcı veya web arama görevlerini mevcut kokpit durumuyla görünür şekilde hazırlayın.",
    status: "Beklemede",
    prompt: "Web'de ara: ",
    lines: ["Tarayıcı hedefi hazır", "Getirme/arama araçları mevcut", "Sonuçlar sohbete döner"],
    actions: [
      { label: "Ara", prompt: "Web'de ara: " },
      { label: "URL getir", prompt: "Bu URL'yi getir ve özetle: " },
      { label: "Dokümanları karşılaştır", prompt: "Bu ön yüz sorunu için güncel resmi dokümanları ara: " },
    ],
  },
  DB: {
    title: "Veritabanı Modu",
    eyebrow: "SQLite/libsql çalışma alanı",
    description: "Kokpitten ayrılmadan veritabanı inceleme görevlerini hazırlayın.",
    status: "Yerel",
    prompt: "Bir veritabanı sorgusu çalıştır: ",
    lines: ["Şema destekli bağlam", "Salt okunur inceleme önerilir", "Oturum verileri bağlı"],
    actions: [
      { label: "Şema", prompt: "Veritabanı şemasını incele ve tabloları özetle" },
      { label: "Oturumlar", prompt: "Son oturumları incelemek için bir veritabanı sorgusu çalıştır" },
      { label: "Sağlık", prompt: "Yerel veritabanı sağlığını ve bağlantı yapılandırmasını kontrol et" },
    ],
  },
  Git: {
    title: "Git Modu",
    eyebrow: "Depo durum hattı",
    description: "Dal durumunu, değiştirilen dosyaları ve son commitleri açık bir komut modu olarak tutun.",
    status: "İzleniyor",
    prompt: "Git durumunu ve son commitleri göster",
    lines: ["Kirli ağaç farkında", "Yıkıcı işlem yok", "Önce inceleme iş akışı"],
    actions: [
      { label: "Durum", prompt: "Git durumunu ve son commitleri göster" },
      { label: "Diff özeti", prompt: "Mevcut git diff'ini dosyaya göre özetle" },
      { label: "Değişen dosyalar", prompt: "Değişen dosyaları listele ve UI ile ilgili olanları belirle" },
    ],
  },
  Tasks: {
    title: "Görev Modu",
    eyebrow: "Yürütme kontrol listesi",
    description: "Mevcut çalışmayı görünür durumda olan açık bir görev hattına dönüştürün.",
    status: "Sırada",
    prompt: "Görev listesini göster: ",
    lines: ["Plan durumu görünür", "Sonraki eylem vurgulanmış", "Tamamlanmadan önce QA gerekli"],
    actions: [
      { label: "Görev listesi", prompt: "Görev listesini göster: " },
      { label: "Sonraki eylem", prompt: "Sonraki uygulama eylemini belirle ve yap" },
      { label: "QA kontrolü", prompt: "Bu UI değişikliği için odaklı bir QA kontrolü yap" },
    ],
  },
};

function CommandRail({
  activeCommand,
  panelOpen,
  onOpenCommand,
}: {
  activeCommand: CommandMode;
  panelOpen: boolean;
  onOpenCommand: (mode: CommandMode) => void;
}) {

  return (
    <nav
      className="command-rail-shell relative z-20 hidden w-[128px] shrink-0 flex-col items-center py-3 lg:flex"
      aria-label="Komuta matrisi"
    >
      <div className="command-rail-inner flex h-full w-full flex-col items-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center border border-border-strong bg-chrome-muted/70 text-fg-muted">
          <Box size={18} aria-hidden="true" />
        </div>
        <div className="mb-3 flex min-h-[158px] w-14 items-center justify-center border border-border/70 bg-black/25">
          <span className="vertical-command-label font-mono text-[10px] uppercase text-fg-muted">
            Komuta Matrisi
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          {COMMANDS.map((item) => {
            const Icon = item.icon;
            const active = panelOpen && activeCommand === item.label;
            return (
              <button
                key={item.label}
                type="button"
                className={cn(
                  "flex min-h-[54px] w-14 flex-col items-center justify-center gap-1 border text-[9px] font-mono uppercase transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-electric/70 bg-electric-muted/70 text-electric shadow-[0_0_24px_rgba(176,226,39,0.22)]"
                    : "border-border/60 bg-black/10 text-fg-secondary hover:border-cyan/40 hover:text-cyan"
                )}
                aria-pressed={active ? "true" : "false"}
                aria-expanded={active}
                aria-controls="command-mode-panel"
                aria-label={`${item.display} komut modu${active ? " açık" : ""}`}
                data-tooltip={`${item.display} modu`}
                title={`${item.display} modu`}
                onClick={() => onOpenCommand(item.label)}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="text-[7px] font-bold tracking-[0.14em]">{item.display}</span>
              </button>
            );
          })}
        </div>
        <div className="command-radar mt-4 grid h-16 w-16 place-items-center rounded-full border border-electric/30 bg-electric-muted/30">
          <div className="h-3 w-3 rounded-full bg-electric shadow-[0_0_18px_rgba(176,226,39,0.95)] animate-signal-pulse" />
        </div>
      </div>
    </nav>
  );
}

function CommandModePanel({
  mode,
  onClose,
  onPrime,
}: {
  mode: CommandMode;
  onClose: () => void;
  onPrime: (prompt: string) => void;
}) {
  const command = COMMANDS.find((item) => item.label === mode) ?? COMMANDS[0];
  const meta = COMMAND_MODE_META[mode];
  const Icon = command.icon;

  return (
    <section
      id="command-mode-panel"
      role="region"
      aria-label={`${meta.title} paneli`}
      className="command-mode-panel pointer-events-auto"
    >
      <div className="command-mode-header flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-electric/35 bg-electric-muted/40 text-electric shadow-[0_0_22px_rgba(176,226,39,0.16)]">
          <Icon size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="section-label">{meta.eyebrow}</p>
          <h2 className="mt-1 truncate text-sm font-semibold text-fg-primary">{meta.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{meta.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tooltip-trigger flex min-h-[36px] min-w-[36px] items-center justify-center border border-border/60 text-fg-secondary transition-colors duration-200 hover:border-electric/40 hover:bg-electric-muted/30 hover:text-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${meta.title} Kapat`}
          data-tooltip="Mod panelini kapat"
          title="Mod panelini kapat"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="command-mode-lines mt-4 grid gap-2">
        {meta.lines.map((line) => (
          <div key={line} className="flex items-center justify-between gap-3 border border-border/40 bg-black/20 px-3 py-2 text-[11px] text-fg-secondary">
            <span>{line}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-electric shadow-[0_0_12px_rgba(176,226,39,0.75)]" />
          </div>
        ))}
      </div>

      <div className="command-mode-status mt-4 flex items-center justify-between gap-3 border-y border-border/45 py-3">
        <span className="text-[11px] uppercase tracking-[0.28em] text-fg-muted">Mod durumu</span>
        <span className="font-mono text-xs text-electric">{meta.status}</span>
      </div>

      <div className="command-mode-actions mt-4 grid gap-2 sm:grid-cols-3">
        {meta.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onPrime(action.prompt)}
            className="min-h-[42px] border border-border/60 bg-black/20 px-3 text-left text-[11px] font-semibold text-fg-secondary transition-[border-color,color,background-color,transform] duration-200 hover:border-electric/45 hover:bg-electric-muted/25 hover:text-electric active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${action.label} komutunu hazırla`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusCluster() {
  return (
    <div className="hidden lg:flex min-h-[48px] min-w-[250px] items-center gap-4 border-l border-border/70 bg-chrome-muted/35 px-5">
      <div className="space-y-1">
        <div className="section-label">Durum</div>
        <div className="flex items-center gap-2 text-sm text-fg-primary">
          <span className="h-2 w-2 rounded-full bg-electric shadow-[0_0_14px_rgba(176,226,39,0.8)]" />
          Hazır
        </div>
      </div>
      <div className="relative h-8 flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-cyan/25" />
        <div className="absolute left-2 top-1/2 h-8 w-16 -translate-y-1/2 text-cyan">
          <svg viewBox="0 0 80 32" className="h-full w-full" aria-hidden="true">
            <path
              d="M0 16 H18 L23 9 L28 23 L34 5 L39 27 L45 16 H80"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeCommandMode, setActiveCommandMode] = useState<CommandMode>("Term");
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const { sidebarOpen, toggleSidebar, contextPanelOpen, toggleContextPanel } = useChatStore();
  const clearMessages = useChatStore((s) => s.clearMessages);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setCommandPrefill = useChatStore((s) => s.setCommandPrefill);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const store = useChatStore.getState();
    if (!store.hydrated) {
      store.hydrate();
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      store.setSidebarOpen(false);
      store.setContextPanelOpen(false);
    } else if (window.matchMedia("(max-width: 1279px)").matches) {
      store.setContextPanelOpen(false);
    } else if (window.matchMedia("(min-width: 1280px)").matches) {
      store.setContextPanelOpen(true);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const handleClearChat = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Bu konuşmadaki tüm mesajlar silinsin mi?")) {
      clearMessages();
    }
  }, [clearMessages]);

  const handleOpenCommandMode = useCallback((mode: CommandMode) => {
    setActiveCommandMode(mode);
    setCommandPanelOpen(true);
    setCommandPrefill(COMMAND_MODE_META[mode].prompt);
  }, [setCommandPrefill]);

  const handlePrimeCommand = useCallback((prompt: string) => {
    setCommandPrefill(prompt);
  }, [setCommandPrefill]);

  const terminalModeActive = commandPanelOpen && activeCommandMode === "Term";
  const filesModeActive = commandPanelOpen && activeCommandMode === "Files";

  if (!mounted) {
    return <SkeletonLoader />;
  }

  return (
    <main className="cockpit-shell flex h-dvh overflow-hidden relative">
      {/* Ambient void depth */}
      <div className="void-particles" />
      <Sidebar />
      <CommandRail
        activeCommand={activeCommandMode}
        panelOpen={commandPanelOpen}
        onOpenCommand={handleOpenCommandMode}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Bar */}
        <header className="relative z-40 h-[82px] flex items-center gap-3 px-4 shrink-0 chrome-subtle border-b border-border/40">
          {/* Left: sidebar toggle (visible when collapsed) */}
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-border/70 bg-chrome-muted/50 hover:bg-surface-elevated transition-[background-color,color,transform] duration-200 text-muted-foreground hover:text-foreground animate-fade-in active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Kenar çubuğunu aç"
              data-tooltip="Kenar çubuğunu aç"
              title="Kenar çubuğunu aç"
            >
              <PanelLeft size={18} />
            </button>
          )}

          {/* Mobile session title */}
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Activity size={16} className="hidden text-electric sm:block" aria-hidden="true" />
            <SessionTitle />
          </div>

          {/* Clear chat (visible when there are messages) */}
          {activeSessionId && (
            <button
              onClick={handleClearChat}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-border/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              aria-label="Sohbeti temizle"
              data-tooltip="Sohbeti temizle"
              title="Sohbeti temizle"
            >
              <Trash2 size={16} />
            </button>
          )}

          <StatusCluster />
          <ModelBadge />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: model badge + settings + context toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block lg:hidden">
              <SyncIndicator />
            </div>
            <button
              type="button"
              onClick={() => handleOpenCommandMode("Files")}
              className={cn(
                "hidden min-h-[44px] min-w-[44px] items-center justify-center border transition-colors duration-200 lg:flex",
                filesModeActive
                  ? "border-electric/45 bg-electric-muted/35 text-electric"
                  : "border-transparent text-fg-secondary hover:border-border/70 hover:bg-muted hover:text-electric"
              )}
              aria-label={filesModeActive ? "Dosya modu açık" : "Dosya modunu aç"}
              aria-pressed={filesModeActive}
              aria-expanded={filesModeActive}
              aria-controls="command-mode-panel"
              data-tooltip="Dosya modu"
              title="Dosya modu"
            >
              <Box size={18} aria-hidden="true" />
            </button>
            <SettingsPanel />
            <button
              type="button"
              className={cn(
                "hidden min-h-[44px] min-w-[44px] items-center justify-center border transition-colors duration-200 lg:flex",
                terminalModeActive
                  ? "border-cyan/45 bg-cyan/10 text-cyan shadow-[0_0_20px_rgba(36,216,255,0.14)]"
                  : "border-transparent text-fg-secondary hover:border-border/70 hover:bg-muted hover:text-cyan"
              )}
              aria-label={terminalModeActive ? "Terminal modu açık" : "Terminal modunu aç"}
              aria-pressed={terminalModeActive}
              aria-expanded={terminalModeActive}
              aria-controls="command-mode-panel"
              data-tooltip="Terminal modu"
              title="Terminal modu"
              onClick={() => handleOpenCommandMode("Term")}
            >
              <Terminal size={17} aria-hidden="true" />
            </button>
            <div className="hidden min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-chrome-elevated text-fg-primary lg:flex">
              <span className="font-mono text-sm font-semibold">N</span>
              <span className="ml-1 h-2 w-2 rounded-full bg-electric shadow-[0_0_12px_rgba(176,226,39,0.8)]" />
            </div>
            {!contextPanelOpen && (
              <button
                onClick={toggleContextPanel}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-border/60 hover:bg-surface-elevated transition-colors duration-200 text-muted-foreground hover:text-foreground animate-fade-in active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Bağlam panelini aç"
                aria-expanded="false"
                aria-controls="context-panel"
                data-tooltip="Bağlamı aç"
                title="Bağlamı aç"
              >
                <PanelRight size={18} />
              </button>
            )}
            {contextPanelOpen && (
              <button
                onClick={toggleContextPanel}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-border/60 hover:bg-surface-elevated transition-colors duration-200 text-muted-foreground hover:text-foreground animate-fade-in active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
                aria-label="Bağlam panelini kapat"
                aria-expanded="true"
                aria-controls="context-panel"
                data-tooltip="Bağlamı kapat"
                title="Bağlamı kapat"
              >
                <Monitor size={18} />
              </button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Chat */}
          <div id="main-content" className="mission-canvas flex flex-col flex-1 min-w-0 min-h-0 relative">
            {commandPanelOpen && (
              <div className="command-panel-host">
                <CommandModePanel
                  mode={activeCommandMode}
                  onClose={() => setCommandPanelOpen(false)}
                  onPrime={handlePrimeCommand}
                />
              </div>
            )}
            <div className="min-h-0 flex-1">
              <ChatInterface />
            </div>
          </div>

          {/* Context Panel (Right Sidebar) */}
          <ContextPanel />
        </div>
      </div>
    </main>
  );
}

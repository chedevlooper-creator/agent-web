import { ArrowRight, Code, FileText, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

const promptStarters = [
  {
    title: "Projeyi İncele",
    prompt: "Depoyu analiz et ve bağlamı anla.",
    icon: FileText,
    tone: "cyan",
  },
  {
    title: "İnşa Planı",
    prompt: "Görevleri parçala ve çalışma planı oluştur.",
    icon: Code,
    tone: "lime",
  },
  {
    title: "Modelleri Karşılaştır",
    prompt: "Aynı soruyu birden çok modele sor.",
    icon: GitCompare,
    tone: "magenta",
  },
];

interface WelcomeHeroProps {
  hasApiKey: boolean;
  onPrompt: (prompt: string) => void;
}

export function WelcomeHero({ hasApiKey, onPrompt }: WelcomeHeroProps) {
  return (
    <div className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full px-4 pb-[2vh] pt-20">
      <div className="matrix-field" aria-hidden="true" />
      <div className="matrix-horizon" aria-hidden="true" />
      <div className="scanline" aria-hidden="true" />

      <div className="relative z-10 flex min-w-0 w-full max-w-4xl flex-col items-center gap-9 text-center animate-slide-up">
        <section className="relative min-w-0 space-y-4">
          <div className="mx-auto hidden w-fit items-center gap-3 font-mono text-[10px] uppercase text-electric sm:flex">
            <span className="text-electric/70">{'///'}</span>
            <span className="tracking-[0.42em]">AI Developer Command Center</span>
            <span className="text-electric/70">{'///'}</span>
          </div>

          <div className="space-y-3">
            <h1 className="agent-wordmark inline-flex items-center justify-center gap-6 font-black leading-[0.88] text-6xl sm:text-7xl xl:text-8xl">
              <span>AGENT</span>
              <span>WEB</span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm md:text-[15px] leading-7 text-fg-secondary">
              Kodlama, dağıtım ve operasyon için AI yardımcınız.
            </p>
          </div>

          <span className="sr-only">{hasApiKey ? "Sağlayıcı hazır" : "Sağlayıcı anahtarı gerekli"}</span>
        </section>

        <section className="grid w-full min-w-0 max-w-[760px] gap-3 md:grid-cols-3" aria-label="Prompt starters">
          {promptStarters.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  if (hasApiKey) onPrompt(item.prompt);
                }}
                aria-disabled={!hasApiKey}
                className={cn(
                  "matrix-card group flex min-h-[104px] w-full items-start gap-3 p-5 text-left transition-[filter,transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 animate-panel-rise",
                  item.tone === "cyan" && "matrix-card-cyan hover:border-cyan/50 hover:shadow-cyan/20",
                  item.tone === "magenta" && "matrix-card-magenta hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/20",
                  item.tone === "lime" && "hover:border-electric/50 hover:shadow-electric/20"
                )}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-current/30 bg-black/20 transition-transform duration-300 group-hover:scale-110">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[14px] font-semibold text-current">{item.title}</span>
                  <span className="block text-[10px] md:text-[11px] opacity-60 group-hover:opacity-90 transition-opacity mt-1.5 leading-[1.55]">{item.prompt}</span>
                </span>
                <ArrowRight size={16} className="mt-1 shrink-0 text-current transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

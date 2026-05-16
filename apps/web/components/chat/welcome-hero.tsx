import { Star } from "lucide-react";

export function WelcomeHero() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden w-full h-full pb-[10vh]">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-glow-breathe pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-accent/4 rounded-full blur-3xl animate-glow-breathe pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 flex flex-col items-center gap-7 animate-slide-up w-full px-6">
        {/* Badge */}
        <div className="glass flex items-center mx-auto rounded-full p-1 pr-3.5 w-fit shadow-sm animate-fade-in">
          <span className="flex items-center gap-1 bg-gradient-to-r from-primary to-accent text-white rounded-full px-2.5 py-0.5 text-[10px] font-semibold mr-2 shadow-sm shadow-primary/25">
            <Star className="w-2.5 h-2.5 fill-current" />
            New
          </span>
          <span className="text-xs font-medium text-foreground">
            Discover what&apos;s possible
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-center font-bold tracking-[-0.03em] leading-[1.08] text-4xl sm:text-5xl md:text-6xl gradient-text-hero max-w-3xl animate-float-gentle">
          Transform Ideas Into Reality
        </h1>

        {/* Subtitle */}
        <p className="text-center font-medium text-sm md:text-base leading-relaxed text-muted-foreground/80 max-w-xl">
          Upload your information and get powerful insights right away. Work
          smarter and achieve goals effortlessly.
        </p>
      </div>
    </div>
  );
}

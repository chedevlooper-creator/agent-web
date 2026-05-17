export function SkeletonLoader() {
  return (
    <main className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-[280px] flex-col border-r border-border bg-surface">
        <div className="h-14 px-4 flex items-center border-b border-border">
          <div className="w-8 h-8 rounded-xl animate-shimmer" />
          <div className="w-24 h-4 ml-3 rounded-lg animate-shimmer" />
        </div>
        <div className="p-3 space-y-3">
          <div className="h-10 rounded-xl animate-shimmer" />
          <div className="h-9 rounded-xl animate-shimmer" />
          <div className="flex gap-2">
            <div className="flex-1 h-8 rounded-lg animate-shimmer" />
            <div className="flex-1 h-8 rounded-lg animate-shimmer" />
          </div>
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3">
          <div className="w-32 h-5 rounded-lg animate-shimmer" />
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-xl animate-shimmer" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto animate-shimmer" />
            <div className="w-40 h-5 rounded-lg mx-auto animate-shimmer" />
            <div className="w-64 h-4 rounded-lg mx-auto animate-shimmer" />
          </div>
        </div>
        <div className="border-t border-border bg-surface p-4">
          <div className="max-w-3xl mx-auto h-14 rounded-2xl animate-shimmer" />
        </div>
      </div>
    </main>
  );
}

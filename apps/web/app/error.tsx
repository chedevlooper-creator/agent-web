"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-4 p-8"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-[var(--muted-foreground)] max-w-md text-center">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)]"
      >
        Try again
      </button>
    </div>
  );
}

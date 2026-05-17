import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-4 p-8"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <h1 className="text-6xl font-bold">404</h1>
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-sm text-[var(--muted-foreground)] max-w-md text-center">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-sm rounded bg-[var(--primary)] text-[var(--primary-foreground)] no-underline"
      >
        Go home
      </Link>
    </div>
  );
}

import { resolve } from "node:path";

/**
 * Determines the allowed base directory for file tool operations.
 * Defaults to the current working directory (project root).
 */
function getAllowedBase(): string {
  return process.env.TOOL_ALLOWED_BASE || process.cwd();
}

/**
 * Resolves and validates a path is within the allowed base directory.
 * Returns the resolved absolute path if safe, or throws an Error.
 */
export function resolveSafePath(inputPath: string): string {
  const abs = resolve(inputPath);
  const base = resolve(getAllowedBase());

  // On Windows, normalize drive letter case
  const normalizedAbs = abs.replace(/^[A-Z]:\\/, (m) => m.toUpperCase());
  const normalizedBase = base.replace(/^[A-Z]:\\/, (m) => m.toUpperCase());

  // System directory protection (defense in depth)
  const SYSTEM_DIRS =
    process.platform === "win32"
      ? [
          "C:\\Windows",
          "C:\\windows",
          "C:\\WINDOWS",
          "C:\\Program Files",
          "C:\\Program Files (x86)",
        ]
      : ["/etc", "/proc", "/sys", "/dev", "/boot", "/var", "/usr"];

  for (const sysDir of SYSTEM_DIRS) {
    if (normalizedAbs.startsWith(sysDir)) {
      throw new Error(`Cannot access system directory: ${inputPath}`);
    }
  }

  // Restrict to allowed base directory
  if (!normalizedAbs.startsWith(normalizedBase)) {
    throw new Error(
      `Path "${inputPath}" resolves outside the allowed workspace directory. All operations are restricted to: ${base}`
    );
  }

  return abs;
}

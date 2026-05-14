import * as fs from "fs/promises";
import * as path from "path";

export function isPathInsideBase(resolvedPath: string, basePath: string): boolean {
  const normalizedResolved = path.normalize(resolvedPath);
  const normalizedBase = path.normalize(basePath);
  return normalizedResolved.startsWith(normalizedBase + path.sep) ||
         normalizedResolved === normalizedBase;
}

export async function validatePath(input: string, basePath: string): Promise<string> {
  const resolved = path.resolve(basePath, input);
  if (!isPathInsideBase(resolved, basePath)) {
    throw new Error("Path traversal blocked");
  }

  try {
    const realPath = await fs.realpath(resolved);
    if (!isPathInsideBase(realPath, basePath)) {
      throw new Error("Path traversal blocked");
    }
    return realPath;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT" || (err as NodeJS.ErrnoException).code === "ENOTDIR") {
      return resolved;
    }
    throw err;
  }
}

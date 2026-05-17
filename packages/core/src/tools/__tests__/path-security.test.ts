import { describe, it, expect } from "vitest";
import { resolveSafePath } from "../path-security.js";

describe("resolveSafePath", () => {
  it("resolves relative paths within allowed base", () => {
    const result = resolveSafePath(".");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("resolves absolute paths within allowed base", () => {
    const cwd = process.cwd();
    const result = resolveSafePath(cwd);
    expect(result).toBe(cwd);
  });

  it("rejects paths outside the workspace", () => {
    // On Windows, /etc resolves to C:\etc which is outside the allowed base
    expect(() => resolveSafePath("/etc/passwd")).toThrow(
      /resolves outside|system directory/
    );
  });

  it("rejects paths to /proc", () => {
    expect(() => resolveSafePath("/proc/self/environ")).toThrow(
      /resolves outside|system directory/
    );
  });

  it("rejects paths to /sys", () => {
    expect(() => resolveSafePath("/sys/kernel")).toThrow(
      /resolves outside|system directory/
    );
  });
});

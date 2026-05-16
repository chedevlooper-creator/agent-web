import { describe, it, expect } from "vitest";
import { cn, estimateTokens } from "../utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    const result = cn("px-4", "py-2");
    expect(result).toBe("px-4 py-2");
  });

  it("resolves conflicts via tailwind-merge", () => {
    const result = cn("px-4", "px-2");
    expect(result).toBe("px-2");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "extra");
    expect(result).toBe("base extra");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("estimateTokens", () => {
  it("returns 0 for empty array", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("estimates 1 token per 4 characters", () => {
    expect(estimateTokens([{ content: "1234" }])).toBe(1);
    expect(estimateTokens([{ content: "12345" }])).toBe(2);
  });

  it("sums across multiple messages", () => {
    const messages = [
      { content: "12345678" },
      { content: "abcd" },
    ];
    expect(estimateTokens(messages)).toBe(3);
  });
});

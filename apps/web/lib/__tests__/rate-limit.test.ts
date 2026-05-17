import { describe, it, expect } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows first request", () => {
    const result = rateLimit("test-ip-1", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests up to the limit and blocks the next", () => {
    const ip = "test-ip-2";
    // maxRequests=5 means first 5 requests are allowed, 6th is blocked
    for (let i = 0; i < 6; i++) {
      const result = rateLimit(ip, { maxRequests: 5, windowMs: 60000 });
      if (i < 5) {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      } else {
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    }
  });

  it("resets after window expires", () => {
    const ip = "test-ip-3";
    const first = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    const second = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const third = rateLimit(ip, { maxRequests: 3, windowMs: 10 });
        expect(third.allowed).toBe(true);
        expect(third.remaining).toBe(2); // Fresh window
        resolve();
      }, 20);
    });
  });

  it("uses separate windows for different IPs", () => {
    const r1 = rateLimit("ip-a", { maxRequests: 1, windowMs: 60000 });
    const r2 = rateLimit("ip-b", { maxRequests: 1, windowMs: 60000 });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: {
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "@agent-web/core": path.resolve(__dirname, "../../packages/core/src"),
      "@agent-web/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
});

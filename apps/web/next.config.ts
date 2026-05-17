import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-web/core", "@agent-web/db"],
  serverExternalPackages: ["@libsql/client", "pdf-parse", "mammoth", "xlsx", "@lobehub/tts"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // Force webpack (not Turbopack) to avoid incorrect client-side module tracing
  // that pulls in server-only Node.js deps via @agent-web/core
  webpack: (config, { isServer, webpack }) => {
    // Strip "node:" prefix so Webpack can resolve via resolve.fallback
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    // Replace Node.js built-in modules with empty stubs on the client
    if (!isServer) {
      const nodeModules = [
        "child_process",
        "fs",
        "path",
        "os",
        "crypto",
        "stream",
        "util",
        "buffer",
        "url",
        "http",
        "https",
        "zlib",
        "events",
        "constants",
        "assert",
        "module",
        "net",
        "tls",
        "dns",
        "querystring",
        "string_decoder",
        "tty",
      ];
      const fallbacks: Record<string, boolean | string> = {};
      for (const mod of nodeModules) {
        fallbacks[mod] = false;
        fallbacks[`${mod}/promises`] = false;
      }
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...fallbacks,
      };
    }
    return config;
  },
};

export default nextConfig;

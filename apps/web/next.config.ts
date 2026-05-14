import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@agent-web/core", "@agent-web/db"],
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;

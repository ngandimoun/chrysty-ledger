import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@mastra/core", "@mastra/memory", "@mastra/pg", "pg"],
};

export default nextConfig;

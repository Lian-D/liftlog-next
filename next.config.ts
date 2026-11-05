import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bundles a minimal server into .next/standalone for the Docker image
  output: "standalone",
  // Pin the project root so a stray lockfile in a parent folder doesn't move the standalone output.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // Native module: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;

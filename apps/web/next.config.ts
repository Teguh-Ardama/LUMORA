import type { NextConfig } from "next";
import { config as loadRootEnv } from "dotenv";
import path from "node:path";

// Monorepo: environment lives at the repo root, not in apps/web.
// Values already present in process.env always win.
loadRootEnv({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lumora/contracts", "@lumora/core", "@lumora/db", "@lumora/image", "@lumora/ui"],
  serverExternalPackages: ["sharp", "bullmq", "ioredis", "@prisma/client", "prisma", "archiver"],
  webpack: (config, { isServer }) => {
    // sharp is imported through the transpiled @lumora/image workspace
    // package; force it to stay a native require at runtime.
    if (isServer) {
      config.externals = [...(config.externals ?? []), { sharp: "commonjs sharp" }];
    }
    return config;
  },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;

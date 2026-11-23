import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const buildId =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  `gcs-${Date.now()}`;

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin/notifications",
        destination: "/notifications",
        permanent: false,
      },
      {
        source: "/therapist/notifications",
        destination: "/notifications",
        permanent: false,
      },
      {
        source: "/super-admin/cases/:id",
        destination: "/admin/cases/:id",
        permanent: false,
      },
      {
        source: "/super-admin/cases",
        destination: "/admin/cases",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

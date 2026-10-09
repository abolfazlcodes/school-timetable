import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@ortools-node/cp-sat"],
  outputFileTracingIncludes: {
    "/planning": [
      "node_modules/@ortools-node/cp-sat/prebuilds/linux-x64/**/*",
    ],
  },
};

export default nextConfig;

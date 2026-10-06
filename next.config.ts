import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@ortools-node/cp-sat"],
};

export default nextConfig;

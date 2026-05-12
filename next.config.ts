import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { execSync } from "child_process";

const buildId = (() => {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "dev"; }
})();

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default withPWA(nextConfig);

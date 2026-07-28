import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["alasql"],
  turbopack: {
    root: path.resolve(process.cwd()),
    resolveAlias: process.env.FIREBASE_RUNTIME === "true"
      ? { "cloudflare:workers": "./lib/firebase/cloudflare-workers-shim.ts" }
      : {},
  },
};

export default nextConfig;

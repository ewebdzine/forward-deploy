import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the app portable: no Vercel-only features. Deploys as a plain Next.js
  // app on Vercel, `next start`, or Docker inside an extranet.
  output: undefined,
};

export default nextConfig;

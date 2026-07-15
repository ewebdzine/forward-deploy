import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the app portable: no Vercel-only features. Deploys as a plain Next.js
  // app on Vercel, `next start`, or Docker inside an extranet.
  output: undefined,
  // The dev-mode "N" indicator overlaps the sidebar user block; it adds
  // nothing for this app's audience. Production builds never render it.
  devIndicators: false,
};

export default nextConfig;

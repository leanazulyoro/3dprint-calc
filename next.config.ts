import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repo>; the workflow sets this.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;

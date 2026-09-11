import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/social-gallery",
  assetPrefix: "/cleon_social_gallery/static/src/nextapp",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

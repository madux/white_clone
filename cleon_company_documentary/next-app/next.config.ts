import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  basePath: "/company-documentary",

  assetPrefix: "/cleon_company_documentary/static/src/nextapp",

  trailingSlash: true,

  images: { unoptimized: true },

  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  basePath: "/document-management",

  assetPrefix: "/cleon_document_management/static/src/nextapp",

  trailingSlash: true,

  images: { unoptimized: true },

  reactStrictMode: true,
};

export default nextConfig;

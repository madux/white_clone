import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "export",

  basePath: "/document-management",

  assetPrefix: isDev
    ? "http://localhost:3030/document-management"
    : "/cleon_document_management/static/src/nextapp",

  trailingSlash: true,

  images: { unoptimized: true },

  reactStrictMode: true,
};

export default nextConfig;

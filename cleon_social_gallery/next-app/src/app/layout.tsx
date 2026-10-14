import type { Metadata } from "next";
import { GalleryProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLEONHR — Social Gallery",
  description: "Share moments, build culture, celebrate success.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <GalleryProviders>{children}</GalleryProviders>
      </body>
    </html>
  );
}

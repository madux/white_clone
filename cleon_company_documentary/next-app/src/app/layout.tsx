import type { Metadata } from "next";
import { DocumentaryProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLEONHR — Company Documentary",
  description: "A polished home for company video knowledge and training.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DocumentaryProviders>{children}</DocumentaryProviders>
      </body>
    </html>
  );
}

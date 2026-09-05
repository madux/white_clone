// cleon_document_management/next-app/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Header from "@/app/components/Header";
import Sidebar from "@/app/components/Sidebar";
import Providers from "@/app/providers";
import "@/app/globals.css";
import { SortableTableManager } from "@/app/components/SortableTable";
import { Inter } from "next/font/google";
export const metadata: Metadata = {
  title: "CLEONHR — Document Management",
  description: "Enterprise Document Management System",
  icons: { icon: "/favicon.ico" },
};

const font = Inter({
  subsets: ["latin"],
  // Explicitly request all required font weights
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <Providers>
          <SortableTableManager />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 gap-4 overflow-hidden">
              <Header />

              <main className="flex-1 overflow-y-auto bg-white pb-3">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

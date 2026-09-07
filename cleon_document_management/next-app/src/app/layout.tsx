// cleon_document_management/next-app/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/app/components/Header";
import Sidebar from "@/app/components/Sidebar";
import Providers from "@/app/providers";
import "@/app/globals.css";
import { SortableTableManager } from "@/app/components/SortableTable";
import OnboardingGuide from "@/app/components/OnboardingGuide";
export const metadata: Metadata = {
  title: "CLEONHR — Document Management",
  description: "Enterprise Document Management System",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SortableTableManager />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 gap-4 overflow-hidden">
              <Suspense fallback={null}><Header /></Suspense>

              <main className="flex-1 overflow-y-auto bg-slate-50 pb-3">
                {children}
              </main>
            </div>
          </div>
          <OnboardingGuide />
        </Providers>
      </body>
    </html>
  );
}

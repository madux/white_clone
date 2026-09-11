// cleon_document_management/next-app/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import AppChrome from "@/app/components/AppChrome";
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
          <Suspense fallback={null}>
            <AppChrome>{children}</AppChrome>
          </Suspense>
          <OnboardingGuide />
        </Providers>
      </body>
    </html>
  );
}

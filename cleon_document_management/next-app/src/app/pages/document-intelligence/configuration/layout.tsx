import AdminOnly from "@/app/components/AdminOnly";
import type { ReactNode } from "react";

export default function ConfigurationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminOnly>{children}</AdminOnly>;
}

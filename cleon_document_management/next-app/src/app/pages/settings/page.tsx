import SettingsPage from "@/app/components/SettingsPage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function SettingsRoute() {
  return (
    <AdminOnly>
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    </AdminOnly>
  );
}

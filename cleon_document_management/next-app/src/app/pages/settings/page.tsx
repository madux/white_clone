import SettingsPage from "@/app/components/SettingsPage";
import { Suspense } from "react";

export default function SettingsRoute() {
  return <Suspense fallback={null}><SettingsPage /></Suspense>;
}

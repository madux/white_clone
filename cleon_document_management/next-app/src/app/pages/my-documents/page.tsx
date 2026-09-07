import MyDocumentsPage from "@/app/components/MyDocumentsPage";
import { Suspense } from "react";

export default function MyDocumentsRoute() {
  return <Suspense fallback={null}><MyDocumentsPage /></Suspense>;
}

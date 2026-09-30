import MyWorkspacePage from "@/app/components/MyWorkspacePage";
import { Suspense } from "react";

export default function MyWorkspaceRoute() {
  return (
    <Suspense fallback={null}>
      <MyWorkspacePage />
    </Suspense>
  );
}

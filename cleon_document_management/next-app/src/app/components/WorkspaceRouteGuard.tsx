"use client";

import { usePathname } from "next/navigation";
import { useWorkspaceDelegationOptional } from "../../../lib/workspaceDelegation";
import { moduleKeyForPath } from "../../../lib/workspaceModuleRoutes";
import { Button } from "@/components/ui/button";
import EmptyState from "./EmptyState";

export default function WorkspaceRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const delegation = useWorkspaceDelegationOptional();
  const routePath = pathname.replace(/^\/document-management(?=\/|$)/, "") || "/";

  if (!delegation?.isRemoteMode) {
    return <>{children}</>;
  }

  const isRemoteAccessPage = routePath.startsWith("/pages/remote-access");
  const required = moduleKeyForPath(routePath);
  if (!isRemoteAccessPage && (!required || delegation.moduleKeys.includes(required))) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <EmptyState
        title={
          isRemoteAccessPage
            ? "Not available in a remote session"
            : "Module not included in remote access"
        }
        description={
          isRemoteAccessPage
            ? "Remote access is managed from your own account."
            : `You do not have delegated access to this area of ${delegation.ownerName}'s workspace.`
        }
      />
      <div className="mt-6 flex justify-center">
        <Button type="button" variant="outline" onClick={delegation.exitRemoteSession}>
          Close remote session
        </Button>
      </div>
    </div>
  );
}

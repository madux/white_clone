"use client";

import { FilePlus2, FolderPlus, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useCurrentUser,
  useDocuments,
  useFolders,
} from "../../../hooks/useDocuments";
import {
  canCreateOrgFolder,
  canCreateOrgPolicy,
  canUploadOrgDocuments,
} from "../../../lib/organizationalFilesAccess";
import { orgLibraryKindFromSearchParams } from "../../../lib/orgLibraryTabParams";
import { normalizeRoutePath } from "../../../lib/navigation";
import { myWorkspaceHref, resolveWorkspaceTab } from "../../../lib/workspaceRoutes";
import CreateNamedFolderDialog from "./CreateNamedFolderDialog";
import NewMenu from "./NewMenu";
import OrganizationalNewMenu from "./OrganizationalNewMenu";

function isOrgLibraryRoute(route: string) {
  return (
    route === "/pages/organization" ||
    route.startsWith("/pages/organization/folder")
  );
}

export default function HeaderPrimaryAction() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const route = normalizeRoutePath(pathname);
  const currentUser = useCurrentUser();
  const folders = useFolders();

  const folderId = Number(params.get("folder") || 0);
  const activeFolder = useMemo(
    () =>
      folderId > 0
        ? (folders.data ?? []).find((item) => item.id === folderId)
        : undefined,
    [folderId, folders.data],
  );
  const folderDocuments = useDocuments(
    folderId > 0 ? folderId : undefined,
    true,
  );

  const [showCreateOrgFolder, setShowCreateOrgFolder] = useState(false);

  const canUploadOrg = canUploadOrgDocuments(currentUser.data);
  const canCreateFolder = canCreateOrgFolder(currentUser.data);
  const canCreatePolicy = canCreateOrgPolicy(currentUser.data);
  const orgSummaryTab = orgLibraryKindFromSearchParams(params);

  const pushUploadQuery = () => {
    const next = new URLSearchParams(params.toString());
    next.set("upload", "1");
    const query = next.toString();
    router.replace(query ? `${route}?${query}` : route, { scroll: false });
  };

  if (isOrgLibraryRoute(route)) {
    const menu = (() => {
      if (activeFolder) {
        return (
          <OrganizationalNewMenu
            chrome
            parentFolder={activeFolder}
            folderLocked={Boolean(activeFolder.locked)}
            canUpload={canUploadOrg && !activeFolder.locked}
            canCreateFolder={canCreateFolder && !activeFolder.locked}
            canCreatePolicy={canCreatePolicy}
            folderDocuments={folderDocuments.data ?? []}
            summaryTab={orgSummaryTab}
          />
        );
      }
      if (!canCreateFolder && !canUploadOrg && !canCreatePolicy) return null;
      return (
        <OrganizationalNewMenu
          chrome
          canUpload={canUploadOrg}
          canCreateFolder={canCreateFolder}
          canCreatePolicy={canCreatePolicy}
          summaryTab={orgSummaryTab}
          onCreateRootFolder={() => setShowCreateOrgFolder(true)}
        />
      );
    })();

    if (!menu) return null;

    return (
      <>
        <div className="header-primary-action shrink-0">{menu}</div>
        {showCreateOrgFolder ? (
          <CreateNamedFolderDialog
            kind="folder"
            parentFolder={activeFolder ?? null}
            onClose={() => setShowCreateOrgFolder(false)}
          />
        ) : null}
      </>
    );
  }

  if (route.startsWith("/pages/employee/profile")) {
    const employeeId = Number(params.get("employee") || 0);
    if (!employeeId) return null;
    return (
      <div className="header-primary-action shrink-0">
        <NewMenu
          chrome
          items={[
            {
              label: "Upload",
              icon: FilePlus2,
              onSelect: pushUploadQuery,
            },
          ]}
        />
      </div>
    );
  }

  if (route.startsWith("/pages/my-workspace") || route === "/pages/my-documents") {
    const workspaceTab = resolveWorkspaceTab(
      params.get("tab"),
      params.get("kind"),
    );
    const lifecycle = params.get("lifecycle");
    const scope = params.get("scope") || "";
    const onDocuments =
      workspaceTab === "documents" &&
      !lifecycle &&
      params.get("scope") !== "quick-access";
    const onMyFilesTab =
      onDocuments &&
      scope !== "shared" &&
      scope !== "outstanding" &&
      scope !== "needs_ack" &&
      params.get("ack") !== "needs";

    if (!onMyFilesTab) return null;

    return (
      <div className="header-primary-action shrink-0">
        <NewMenu
          chrome
          items={[
            {
              label: "Upload",
              icon: Upload,
              onSelect: pushUploadQuery,
            },
          ]}
        />
      </div>
    );
  }

  if (route === "/pages/dashboard" || route === "/pages/home") {
    return (
      <div className="header-primary-action shrink-0">
        <NewMenu
          chrome
          items={[
            {
              label: "Folder",
              icon: FolderPlus,
              onSelect: () => router.push("/pages/organization?create=1"),
            },
            {
              label: "Upload",
              icon: Upload,
              onSelect: () =>
                router.push(myWorkspaceHref("documents", { upload: "1" })),
            },
          ]}
        />
      </div>
    );
  }

  return null;
}

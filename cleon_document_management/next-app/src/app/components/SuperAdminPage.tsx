"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import SystemAdminOnly from "./SystemAdminOnly";
import SectionTabs from "./SectionTabs";
import RolesPage from "./RolesPage";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import { CLOUD_SOURCE_OPTIONS } from "./CloudSourceLogos";
import { Button } from "@/components/ui/button";

type Connector = { provider: string; label: string; connected: boolean };

export default function SuperAdminPage() {
  const user = useCurrentUser();
  const [section, setSection] = useState("roles");

  return (
    <SystemAdminOnly>
      <div className="app-page space-y-6">
        <LibraryBreadcrumb items={[{ label: "Super Admin" }]} />
        <header>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant-level controls for roles, modules, storage, integrations, and audit.
            Signed in as {user.data?.name || "administrator"}.
          </p>
        </header>
        <SectionTabs
          level="page"
          ariaLabel="Super admin sections"
          value={section}
          onChange={setSection}
          items={[
            { id: "roles", label: "Users and Roles" },
            { id: "modules", label: "Modules" },
            { id: "storage", label: "Storage" },
            { id: "integrations", label: "Integrations" },
            { id: "audit", label: "Audit" },
          ]}
        />
        {section === "roles" ? <RolesPage /> : null}
        {section === "modules" ? (
          <p className="rounded-lg border border-border p-4 text-sm">
            Module enablement stays in Settings. Super admins can open{" "}
            <a className="underline" href="/document-management/pages/settings">
              Settings
            </a>{" "}
            to change document types, retention, and Employee Files configuration.
          </p>
        ) : null}
        {section === "storage" ? (
          <p className="rounded-lg border border-border p-4 text-sm">
            Storage usage is calculated from organizational and employee file attachments.
            Disconnecting a connector never deletes files that were already imported.
          </p>
        ) : null}
        {section === "integrations" ? <ConnectorSettings /> : null}
        {section === "audit" ? (
          <p className="rounded-lg border border-border p-4 text-sm">
            Administrative actions are recorded in Activity. Open Home → Activity to review
            who changed what and when.
          </p>
        ) : null}
      </div>
    </SystemAdminOnly>
  );
}

function ConnectorSettings() {
  const { showAlert, showConfirm } = useAppDialog();
  const [items, setItems] = useState<Connector[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const result = await api.organizationalConnectors({ op: "list" });
    const list = Array.isArray((result.data as { items?: Connector[] })?.items)
      ? ((result.data as { items: Connector[] }).items)
      : [];
    setItems(list);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const toggle = async (item: Connector) => {
    if (item.connected) {
      const confirmed = await showConfirm(
        `Disconnect ${item.label}? Already imported files stay in Organizational Files.`,
        { title: "Disconnect connector", confirmLabel: "Disconnect" },
      );
      if (!confirmed) return;
    }
    setBusy(item.provider);
    try {
      const result = await api.organizationalConnectors({
        op: "set",
        provider: item.provider,
        connected: !item.connected,
      });
      if (!result.success) {
        await showAlert("Unable to update this connector.", { title: "Integrations" });
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Enable a source for your organization. Users sign in with OAuth when
        importing; files are copied into Cleon as native attachments. Set OAuth
        client credentials via ORG_GOOGLE_DRIVE_CLIENT_ID (and matching secrets)
        on the server.
      </p>
      {(items.length
        ? items
        : CLOUD_SOURCE_OPTIONS.map((item) => ({
            provider: item.provider,
            label: item.label,
            connected: false,
          }))
      ).map((item) => {
        const Logo =
          CLOUD_SOURCE_OPTIONS.find((source) => source.provider === item.provider)
            ?.icon;
        return (
        <div
          key={item.provider}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            {Logo ? <Logo className="size-5" /> : null}
            <div>
            <p className="font-semibold">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {item.connected ? "Connected for this tenant" : "Not connected"}
            </p>
            </div>
          </div>
          <Button
            variant={item.connected ? "outline" : "default"}
            disabled={busy === item.provider}
            onClick={() => void toggle(item)}
          >
            {busy === item.provider
              ? "Saving…"
              : item.connected
                ? "Disconnect"
                : "Connect"}
          </Button>
        </div>
        );
      })}
    </div>
  );
}

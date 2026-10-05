"use client";

import { Scale } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useToast } from "../../../hooks/useToast";
import EmptyState from "./EmptyState";
import { Button } from "@/components/ui/button";

type HoldRow = {
  id: number;
  name: string;
  active: boolean;
  folder_id?: number | false;
  document_id?: number | false;
  reason?: string;
  placed_by_name?: string;
  released_at?: string;
};

export default function OrganizationalLegalHoldsPage() {
  const { showAlert, showConfirm } = useAppDialog();
  const { showToast } = useToast();
  const [rows, setRows] = useState<HoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [folderId, setFolderId] = useState("");
  const [documentId, setDocumentId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listOrganizationalLegalHolds({});
      setRows((data as HoldRow[]) ?? []);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load legal holds.",
      );
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  const placeHold = async () => {
    if (!name.trim()) {
      showToast("Hold name is required.", "error");
      return;
    }
    if (!folderId.trim() && !documentId.trim()) {
      showToast("Provide a folder ID or document ID.", "error");
      return;
    }
    try {
      await api.placeOrganizationalLegalHold({
        name: name.trim(),
        reason: reason.trim(),
        folder_id: folderId.trim() ? Number(folderId) : undefined,
        document_id: documentId.trim() ? Number(documentId) : undefined,
      });
      showToast("Legal hold placed.");
      setName("");
      setReason("");
      setFolderId("");
      setDocumentId("");
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Could not place hold.");
    }
  };

  const release = async (id: number) => {
    const ok = await showConfirm("Release this legal hold?", { title: "Release hold" });
    if (!ok) return;
    try {
      await api.releaseOrganizationalLegalHold(id);
      showToast("Legal hold released.");
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Release failed.");
    }
  };

  return (
    <div className="app-page space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Legal holds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Block destructive actions on organisational folders and documents while a matter is open.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-white p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Place hold</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Name</span>
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Reason</span>
            <input
              className="field mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Folder ID (optional)</span>
            <input
              className="field mt-1"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Document ID (optional)</span>
            <input
              className="field mt-1"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </label>
        </div>
        <Button onClick={() => void placeHold()}>Place legal hold</Button>
      </section>

      <section className="app-page-body">
        {loading ? (
          <EmptyState title="Loading legal holds…" loading />
        ) : !rows.length ? (
          <EmptyState
            icon={Scale}
            title="No legal holds"
            description="Active holds on organisational records will appear here."
          />
        ) : (
          <ul className="divide-y rounded-md border bg-white text-sm">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.placed_by_name}
                    {row.folder_id ? ` · Folder #${row.folder_id}` : ""}
                    {row.document_id ? ` · Document #${row.document_id}` : ""}
                  </p>
                  {row.reason ? (
                    <p className="mt-1 text-xs text-slate-600">{row.reason}</p>
                  ) : null}
                </div>
                {row.active ? (
                  <Button variant="outline" size="sm" onClick={() => void release(row.id)}>
                    Release
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Released</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

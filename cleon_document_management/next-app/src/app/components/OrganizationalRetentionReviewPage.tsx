"use client";

import Link from "next/link";
import { Archive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocDocument } from "../../../lib/types";
import EmptyState from "./EmptyState";

export default function OrganizationalRetentionReviewPage() {
  const { showAlert } = useAppDialog();
  const [rows, setRows] = useState<DocDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listOrganizationalRetentionReview();
      setRows(data);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load retention queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  const dispose = async (documentId: number, action: "archive" | "delete") => {
    try {
      await api.disposeOrganizationalRetention(documentId, action);
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Dispose failed.");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold">Retention review</h1>
        <p className="text-sm text-muted-foreground">
          Documents flagged by retention policy for archive or disposal.{" "}
          <Link href="/pages/organization/legal-holds" className="text-primary underline">
            Legal holds
          </Link>
        </p>
      </header>
      <section className="app-page-body">
        {loading ? (
          <EmptyState title="Loading retention queue…" loading />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No documents awaiting review"
            description="When retention policy flags documents for archive or disposal, they will appear here for your decision."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <span>{doc.name}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => void dispose(doc.id, "archive")}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="text-destructive underline"
                    onClick={() => void dispose(doc.id, "delete")}
                  >
                    Dispose
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

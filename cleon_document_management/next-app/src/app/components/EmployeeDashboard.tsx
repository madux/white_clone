"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useMyWorkspace } from "../../../hooks/useDocuments";
import { formatStatusLabel } from "../../../lib/formatLabel";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";

export default function EmployeeDashboard({
  showActivity = false,
}: {
  showActivity?: boolean;
}) {
  const workspace = useMyWorkspace();
  const data = workspace.data;
  const outstanding = data?.outstanding ?? [];
  const myFiles = data?.my_files ?? [];
  const shared = data?.shared_documents ?? [];
  const recent = [...myFiles, ...shared].slice(0, 12);
  const pending = [...myFiles, ...shared].filter(
    (document) =>
      document.approval_state === "pending" ||
      ["processing", "draft"].includes(document.state),
  );

  if (showActivity) {
    const events = data?.activity ?? [];
    return (
      <div className="app-page-body">
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Folder</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? (
              events.map((event) => (
                <tr key={`${event.id}-${event.occurred_at}`}>
                  <td className="font-semibold">
                    {event.event === "Acknowledged"
                      ? `You acknowledged ${event.document}`
                      : event.event === "Updated"
                        ? `You updated ${event.document}`
                        : `You added ${event.document}`}
                  </td>
                  <td>{event.folder}</td>
                  <td>{event.occurred_at?.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-slate-500">
                  No activity recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="app-page-header">
        <div>
          <h1>Home</h1>
          <p>Your documents, outstanding uploads, and recent files.</p>
        </div>
        <Link
          href={myWorkspaceHref("documents", { upload: "1" })}
          className="app-btn app-btn-primary"
        >
          <Upload className="h-4 w-4" />
          Upload document
        </Link>
      </div>

      {workspace.error ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your workspace data could not be loaded.
        </p>
      ) : null}

      <div className="app-page-metrics">
        <div className="app-page-metric">
          <span>My documents</span>
          <strong>{workspace.isLoading ? "—" : data?.dashboard.total ?? 0}</strong>
        </div>
        <div className="app-page-metric">
          <span>Outstanding</span>
          <strong>{workspace.isLoading ? "—" : outstanding.length}</strong>
        </div>
        <div className="app-page-metric">
          <span>Pending review</span>
          <strong>{workspace.isLoading ? "—" : pending.length}</strong>
        </div>
        <div className="app-page-metric">
          <span>Expiring</span>
          <strong>{workspace.isLoading ? "—" : data?.dashboard.expiring ?? 0}</strong>
        </div>
      </div>

      <div className="app-page-body">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length ? (
              recent.map((document) => (
                <tr key={document.id}>
                  <td className="font-semibold">{document.name}</td>
                  <td>{document.document_type || "—"}</td>
                  <td>{formatStatusLabel(document.state)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-slate-500">
                  No documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="app-page-body">
        <table>
          <thead>
            <tr>
              <th>Work queue</th>
              <th>Type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {outstanding.length ? (
              outstanding.slice(0, 8).map((document) => (
                <tr key={document.id}>
                  <td className="font-semibold">{document.name}</td>
                  <td>{document.document_type}</td>
                  <td>
                    <Link
                      href={myWorkspaceHref("documents", {
                        upload: "1",
                        type: String(document.document_type_id),
                      })}
                      className="font-semibold text-brand-pink"
                    >
                      Upload
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-slate-500">
                  No outstanding requirements.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

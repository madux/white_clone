"use client";

import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";

type AuditRow = {
  id: number;
  occurred_at: string;
  person_name: string;
  action: string;
  summary: string;
  module: string;
  result: string;
};

export default function AuditTrailPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dmsContractsApi.auditQuery({}, 1).then((result) => {
      if (result.success) {
        setItems(result.data.items as AuditRow[]);
      }
      setLoading(false);
    });
  }, []);

  const openDetail = async (id: number) => {
    const result = await dmsContractsApi.auditEvent(id);
    if (result.success) setSelected(result.data);
  };

  return (
    <div className="app-page space-y-4">
      <header className="app-page-header">
        <h1>Audit Trail</h1>
        <p className="text-sm text-slate-600">Append only. Showing events you are allowed to see.</p>
      </header>
      {loading ? (
        <p className="text-sm text-slate-500">Loading events…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Time</th>
              <th>Person</th>
              <th>Action</th>
              <th>Summary</th>
              <th>Module</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                onClick={() => openDetail(row.id)}
              >
                <td className="py-2 whitespace-nowrap">{row.occurred_at}</td>
                <td>{row.person_name}</td>
                <td>{row.action}</td>
                <td className="max-w-md truncate">{row.summary}</td>
                <td>{row.module}</td>
                <td>{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(selected, null, 2)}</pre>
          <button
            type="button"
            className="mt-3 text-brand-pink font-bold"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

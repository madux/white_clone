"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import { documentViewHref } from "../../../../lib/documentLinks";
import { useCurrentUser } from "../../../../hooks/useDocuments";

type RegistryItem = {
  document_id: number;
  name: string;
  document_type: string;
  source_module: string;
  location_path: string;
  text_search_label?: string;
};

export default function SearchResultsPage() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const user = useCurrentUser();
  const isManager = Boolean(user.data?.is_document_manager);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    dmsContractsApi.registrySearch(query).then((result) => {
      if (result.success) {
        setItems(result.data.items as RegistryItem[]);
        setTotal(result.data.total);
      }
      setLoading(false);
    });
  }, [query]);

  return (
    <div className="app-page space-y-4">
      <header className="app-page-header">
        <h1>Results for &ldquo;{query}&rdquo;</h1>
        <p className="text-sm text-slate-600">
          {loading ? "Searching…" : `${total} results you can open`}
        </p>
      </header>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.document_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{item.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {item.source_module} · {item.location_path}
                {item.text_search_label ? ` · ${item.text_search_label}` : ""}
              </p>
            </div>
            <Link
              href={documentViewHref({ id: item.document_id }, isManager)}
              className="text-xs font-bold text-brand-pink"
            >
              Open
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

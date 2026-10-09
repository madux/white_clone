"use client";

import { ChevronRight, FolderOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppToolbar from "../AppToolbar";
import EmptyState from "../EmptyState";
import StatusPill from "../StatusPill";
import ListPagination from "../ListPagination";
import { useClientPagination } from "../../../../lib/useClientPagination";
import DocumentTypeFormDialog, {
  emptyDocumentTypeForm,
  type DocumentTypeFormValues,
} from "../DocumentTypeForm";
import {
  useDeleteSettingsDocumentType,
  useSaveSettingsDocumentCategory,
  useSaveSettingsDocumentType,
  useSettings,
  useToggleSettingsDocumentType,
} from "../../../../hooks/useDocuments";
import { useToast } from "../../../../hooks/useToast";
import { useAppDialog } from "../../../../hooks/useAppDialog";
import ModalDialog from "../ModalDialog";

type DocumentCategory = {
  id: number;
  name: string;
  description?: string;
  type_count?: number;
  expiring_type_count?: number;
  active?: boolean;
  is_catalog_default?: boolean;
};

export default function CategoriesAndTypesTab() {
  const query = useSettings();
  const saveType = useSaveSettingsDocumentType();
  const saveCategory = useSaveSettingsDocumentCategory();
  const toggleType = useToggleSettingsDocumentType();
  const deleteType = useDeleteSettingsDocumentType();
  const { showToast } = useToast();
  const { showConfirm } = useAppDialog();

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [typeForm, setTypeForm] = useState<DocumentTypeFormValues | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    description: string;
  } | null>(null);

  const categories = (query.data?.document_categories ?? []) as DocumentCategory[];
  const types = query.data?.document_types ?? [];
  const approvers = query.data?.approvers ?? [];

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) => {
      const categoryTypes = types.filter(
        (item: { category_id?: number }) => item.category_id === category.id,
      );
      return (
        category.name.toLowerCase().includes(term) ||
        (category.description || "").toLowerCase().includes(term) ||
        categoryTypes.some((item: { name?: string }) =>
          (item.name || "").toLowerCase().includes(term),
        )
      );
    });
  }, [categories, search, types]);

  const selectedCategory =
    categories.find((item) => item.id === selectedCategoryId) ?? null;

  const categoryTypes = useMemo(
    () =>
      types.filter(
        (item: { category_id?: number }) =>
          item.category_id === selectedCategoryId,
      ),
    [types, selectedCategoryId],
  );

  const typePaging = useClientPagination(
    categoryTypes,
    `${selectedCategoryId}:${categoryTypes.length}`,
  );

  const openTypeForm = (item?: Record<string, unknown>) => {
    const base = emptyDocumentTypeForm(item);
    setTypeForm({
      ...base,
      category_id: selectedCategoryId ?? base.category_id,
    });
  };

  const saveDocumentType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!typeForm) return;
    try {
      const result = await saveType.mutateAsync(typeForm);
      if (result.success) {
        setTypeForm(null);
        showToast("Document type saved.");
      } else {
        showToast(result.message || "Unable to save document type.", "error");
      }
    } catch {
      showToast("The document type could not be saved.", "error");
    }
  };

  const handleDeleteType = async (item: { id: number; name: string }) => {
    if (
      !(await showConfirm(
        `Delete document type "${item.name}"? This cannot be undone.`,
        { title: "Delete document type", confirmLabel: "Delete" },
      ))
    ) {
      return;
    }
    const result = await deleteType.mutateAsync(item.id);
    if (result.success) showToast("Document type deleted.");
    else showToast(result.message || "Unable to delete.", "error");
  };

  const saveCategoryForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm?.name.trim()) return;
    const result = await saveCategory.mutateAsync({
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
    });
    if (result.success) {
      setCategoryForm(null);
      showToast("Category created.");
      if (result.data?.id) setSelectedCategoryId(result.data.id);
    } else {
      showToast(result.message || "Unable to save category.", "error");
    }
  };

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Loading catalogue…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Category → document type catalogue used across Employee Files,
        Organisational Files, Compliance, and Document Intelligence. Default
        categories and types from the product spec are created automatically.
      </p>

      <AppToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories and types"
        actions={
          <button
            type="button"
            onClick={() => setCategoryForm({ name: "", description: "" })}
            className="app-btn app-btn-primary"
          >
            <Plus className="h-4 w-4" /> Add category
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Categories ({filteredCategories.length})
          </h3>
          {filteredCategories.length === 0 ? (
            <EmptyState
              title="No categories"
              description="Default catalogue will appear after module upgrade."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredCategories.map((category) => {
                const active = category.id === selectedCategoryId;
                const count =
                  category.type_count ??
                  types.filter(
                    (item: { category_id?: number }) =>
                      item.category_id === category.id,
                  ).length;
                const expiring =
                  category.expiring_type_count ??
                  types.filter(
                    (item: {
                      category_id?: number;
                      expiry_applicable?: boolean;
                    }) =>
                      item.category_id === category.id && item.expiry_applicable,
                  ).length;
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-brand-pink bg-pink-50/60"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">
                          {category.name}
                        </p>
                        {category.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {category.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {count} type{count === 1 ? "" : "s"}
                          {expiring ? ` · ${expiring} expire` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="app-table-well app-page-body min-h-[320px]">
          {!selectedCategory ? (
            <EmptyState
              title="Select a category"
              description="Choose a category to view and manage its document types."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedCategory.name}
                  </h3>
                  {selectedCategory.description ? (
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedCategory.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openTypeForm()}
                  className="app-btn app-btn-primary"
                >
                  <Plus className="h-4 w-4" /> Add type
                </button>
              </div>

              {categoryTypes.length === 0 ? (
                <EmptyState
                  title="No document types"
                  description="Add a document type to this category."
                  action={
                    <button
                      type="button"
                      onClick={() => openTypeForm()}
                      className="app-btn app-btn-primary"
                    >
                      Add type
                    </button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="ef-table min-w-[520px] text-left">
                    <thead>
                      <tr>
                        <th>Document type</th>
                        <th>Expiry</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typePaging.items.map((item: Record<string, any>) => (
                        <tr key={item.id}>
                          <td className="px-5 py-3">
                            <p className="text-sm font-semibold text-slate-800">
                              {item.name}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {item.expiry_applicable
                              ? `Yes · remind ${item.expiry_reminder_days ?? 60}d`
                              : "No"}
                          </td>
                          <td className="px-5 py-3">
                            <StatusPill
                              label={item.active ? "Active" : "Inactive"}
                            />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              className="text-xs font-bold text-brand-pink"
                              onClick={() => openTypeForm(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ml-3 text-xs font-bold text-slate-500"
                              onClick={() => toggleType.mutate(item.id)}
                            >
                              {item.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              className="ml-3 text-xs font-bold text-red-600"
                              onClick={() =>
                                void handleDeleteType({
                                  id: Number(item.id),
                                  name: String(item.name),
                                })
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ListPagination
                    page={typePaging.page}
                    pageSize={typePaging.pageSize}
                    total={typePaging.total}
                    onPageChange={typePaging.setPage}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {typeForm ? (
        <DocumentTypeFormDialog
          form={typeForm}
          setForm={setTypeForm}
          onClose={() => setTypeForm(null)}
          onSubmit={saveDocumentType}
          saving={saveType.isPending}
          allApprovers={approvers}
          categories={categories}
          lockedCategoryId={selectedCategoryId}
        />
      ) : null}

      {categoryForm ? (
        <ModalDialog
          title="Add category"
          description="Create a custom category for your document types."
          onClose={() => setCategoryForm(null)}
          size="md"
        >
          <form onSubmit={saveCategoryForm} className="space-y-4">
            <label className="block">
              <span className="label">Category name</span>
              <input
                required
                className="field"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label className="block">
              <span className="label">Description</span>
              <textarea
                rows={2}
                className="field"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCategoryForm(null)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveCategory.isPending}
                className="app-btn app-btn-primary"
              >
                {saveCategory.isPending ? "Saving…" : "Create category"}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}

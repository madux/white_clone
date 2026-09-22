"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { employeeFileDimensionLabel } from "../../../lib/employeeFileDimensions";
import type { EmployeeFilesSetupPreview } from "../../../lib/types";
import { useEmployeeFileDimensions } from "../../../hooks/useEmployeeFiles";
import ThemedSelect from "./ThemedSelect";

type Props = {
  organizingDimensions: string[];
  subOrganizingDimension: string;
  includeInactive: boolean;
  excludeTestEmployees: boolean;
  onOrganizingDimensionsChange: (dimensions: string[]) => void;
  onSubOrganizingDimensionChange: (value: string) => void;
};

export default function EmployeeFilesOrganizingDimensionsSettings({
  organizingDimensions,
  subOrganizingDimension,
  includeInactive,
  excludeTestEmployees,
  onOrganizingDimensionsChange,
  onSubOrganizingDimensionChange,
}: Props) {
  const dimensions = useEmployeeFileDimensions();
  const [preview, setPreview] = useState<EmployeeFilesSetupPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const primary = organizingDimensions[0] ?? "";

  const subOptions = useMemo(() => {
    const candidates = organizingDimensions.filter((key) => key && key !== primary);
    return [
      { value: "none", label: "None (flat groups only)" },
      ...candidates.map((key) => ({
        value: key,
        label: employeeFileDimensionLabel(key),
      })),
    ];
  }, [organizingDimensions, primary]);

  useEffect(() => {
    if (
      subOrganizingDimension !== "none" &&
      !subOptions.some((option) => option.value === subOrganizingDimension)
    ) {
      onSubOrganizingDimensionChange("none");
    }
  }, [subOrganizingDimension, subOptions, onSubOrganizingDimensionChange]);

  const toggleDimension = (key: string) => {
    onOrganizingDimensionsChange(
      organizingDimensions.includes(key)
        ? organizingDimensions.filter((item) => item !== key)
        : [...organizingDimensions, key],
    );
  };

  const loadPreview = async () => {
    if (!organizingDimensions.length) {
      setPreviewError("Select at least one organizing dimension.");
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const data = await api.previewEmployeeFilesOrganizing({
        organizing_dimensions: organizingDimensions,
        sub_organizing_dimension: subOrganizingDimension,
        include_inactive: includeInactive,
        exclude_test_employees: excludeTestEmployees,
      });
      setPreview(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to load organizing preview.";
      setPreviewError(message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <p className="text-xs font-bold uppercase text-slate-400">Organizing dimensions (EF-A8)</p>
        <p className="mt-1 text-sm text-slate-600">
          Select one or more EMS attributes. Each produces its own read-only view on Employee Files
          home. The first selected dimension is the primary view for optional sub-grouping.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(dimensions.data ?? []).map((option) => {
          const active = organizingDimensions.includes(option.key);
          const orderIndex = organizingDimensions.indexOf(option.key);
          const disabled = !option.populated;
          return (
            <button
              key={option.key}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && toggleDimension(option.key)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-brand-pink bg-pink-50/60"
                  : "border-slate-200 hover:border-pink-200"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-brand-pink" : "border-slate-300"
                }`}
              >
                {active ? <span className="h-2.5 w-2.5 rounded-full bg-brand-pink" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">
                  {option.label}
                  {active && orderIndex === 0 ? (
                    <span className="ml-2 text-[10px] font-bold uppercase text-brand-pink">
                      Primary
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {option.populated ? "EMS data available" : "No EMS data"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {organizingDimensions.length > 1 ? (
        <p className="text-xs text-slate-500">
          Order:{" "}
          {organizingDimensions
            .map((key, index) =>
              index === 0
                ? `${employeeFileDimensionLabel(key)} (primary)`
                : employeeFileDimensionLabel(key),
            )
            .join(" → ")}
        </p>
      ) : null}

      <div className="max-w-md">
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">
          Sub-group within primary view
        </p>
        <ThemedSelect
          value={subOrganizingDimension || "none"}
          onChange={onSubOrganizingDimensionChange}
          options={subOptions}
          ariaLabel="Sub-group within primary view"
          className={organizingDimensions.length < 2 ? "pointer-events-none opacity-50" : "field"}
        />
        <p className="mt-1 text-xs text-slate-500">
          Nests the sub-attribute under each primary group (for example Department → Employment
          Type). Other dimension tabs stay flat.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          onClick={loadPreview}
          disabled={previewLoading || !organizingDimensions.length}
        >
          {previewLoading ? "Loading preview…" : "Preview counts"}
        </button>
        {preview ? (
          <span className="text-sm text-slate-600">
            {preview.employees_included} employees · {preview.groups_to_create} groups across{" "}
            {preview.organizing_dimensions.length} view
            {preview.organizing_dimensions.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {previewError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {previewError}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          {(preview.dimension_summaries ?? []).map((summary) => (
            <div key={summary.dimension}>
              <p className="text-xs font-bold uppercase text-slate-500">
                By {employeeFileDimensionLabel(summary.dimension)} · {summary.groups_to_create}{" "}
                groups
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
                {summary.group_breakdown.slice(0, 12).map((row) => (
                  <li key={row.name} className="flex justify-between gap-4">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 text-slate-500">
                      {row.employees} emp · {row.documents} docs
                    </span>
                  </li>
                ))}
                {summary.group_breakdown.length > 12 ? (
                  <li className="text-xs text-slate-400">
                    +{summary.group_breakdown.length - 12} more groups
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
          {preview.need_attention_expected > 0 ? (
            <p className="text-xs text-amber-800">
              {preview.need_attention_expected} employee(s) may need attention (missing primary
              organizing attribute).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

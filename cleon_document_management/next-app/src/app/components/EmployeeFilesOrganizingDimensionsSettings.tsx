"use client";

import { useEffect, useMemo } from "react";
import { CircleHelp } from "lucide-react";
import {
  employeeFileDimensionLabel,
  orderOrganizingDimensions,
} from "../../../lib/employeeFileDimensions";
import { useEmployeeFileDimensions } from "../../../hooks/useEmployeeFiles";
import ThemedSelect from "./ThemedSelect";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SettingsFieldHelp({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-[var(--rule)] text-slate-400 hover:border-brand-pink hover:text-brand-text"
        aria-label={`About ${label}`}
      >
        <CircleHelp className="size-3" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px] text-left leading-4">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

type Props = {
  organizingDimensions: string[];
  subOrganizingDimension: string;
  onOrganizingDimensionsChange: (dimensions: string[]) => void;
  onSubOrganizingDimensionChange: (value: string) => void;
};

export default function EmployeeFilesOrganizingDimensionsSettings({
  organizingDimensions,
  subOrganizingDimension,
  onOrganizingDimensionsChange,
  onSubOrganizingDimensionChange,
}: Props) {
  const dimensions = useEmployeeFileDimensions();
  const primary = organizingDimensions[0] ?? "";
  const options = dimensions.data ?? [];

  const applyDimensions = (
    nextIncluded: string[],
    nextPrimary = primary,
    nextSecondary = subOrganizingDimension,
  ) => {
    const safePrimary = nextIncluded.includes(nextPrimary)
      ? nextPrimary
      : nextIncluded[0] || "";
    const safeSecondary =
      nextSecondary &&
      nextSecondary !== "none" &&
      nextSecondary !== safePrimary &&
      nextIncluded.includes(nextSecondary)
        ? nextSecondary
        : "none";
    onOrganizingDimensionsChange(
      orderOrganizingDimensions(nextIncluded, safePrimary, safeSecondary),
    );
    onSubOrganizingDimensionChange(safeSecondary);
  };

  const toggleDimension = (key: string, populated: boolean) => {
    if (!populated) return;
    const included = organizingDimensions.includes(key);
    if (included && organizingDimensions.length === 1) return;
    applyDimensions(
      included
        ? organizingDimensions.filter((item) => item !== key)
        : [...organizingDimensions, key],
    );
  };

  const subOptions = useMemo(() => {
    return [
      { value: "none", label: "None" },
      ...organizingDimensions
        .filter((key) => key && key !== primary)
        .map((key) => ({
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

  return (
    <>
      <div className="flex items-start gap-4 py-3">
        <span className="flex w-44 shrink-0 items-center gap-1.5 pt-1.5 text-sm font-medium text-[var(--ink)]">
          Show
          <SettingsFieldHelp
            label="Show"
            text="Which EMS attributes appear as views on Employee Files."
          />
        </span>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const on = organizingDimensions.includes(option.key);
            const chipClass = `rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
              on
                ? "border-brand-pink bg-pink-50 text-brand-text"
                : "border-[var(--rule)] bg-white text-slate-600"
            }`;
            if (!option.populated) {
              const reason =
                option.unavailable_reason ||
                `No populated ${option.label} data was found in EMS.`;
              return (
                <Tooltip key={option.key}>
                  <TooltipTrigger
                    type="button"
                    title={reason}
                    className={`${chipClass} cursor-not-allowed opacity-40`}
                    aria-label={`${option.label}: ${reason}`}
                  >
                    {option.label}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-[120] max-w-[240px] text-left leading-4">
                    {reason}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleDimension(option.key, true)}
                className={chipClass}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--rule)] py-3">
        <label className="flex w-44 shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--ink)]">
          Primary dimension
          <SettingsFieldHelp
            label="Primary dimension"
            text="The default browse tree people land on."
          />
        </label>
        <ThemedSelect
          value={primary}
          onChange={(value) =>
            applyDimensions(organizingDimensions, value, subOrganizingDimension)
          }
          ariaLabel="Primary dimension"
          className="field"
          options={
            organizingDimensions.length
              ? organizingDimensions.map((key) => ({
                  value: key,
                  label: employeeFileDimensionLabel(key),
                }))
              : [{ value: "", label: "Select dimensions first" }]
          }
        />
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--rule)] py-3">
        <label className="flex w-44 shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--ink)]">
          Subgroup
          <SettingsFieldHelp
            label="Subgroup"
            text="Optional extra grouping nested under the primary view."
          />
        </label>
        <ThemedSelect
          value={subOrganizingDimension || "none"}
          onChange={(value) => applyDimensions(organizingDimensions, primary, value)}
          ariaLabel="Subgroup"
          className={
            organizingDimensions.length < 2
              ? "field pointer-events-none opacity-50"
              : "field"
          }
          options={subOptions}
        />
      </div>
    </>
  );
}

"use client";

import { cn } from "cn";
import { FolderOpen, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function EmptyState({
  title,
  description,
  action,
  icon: Icon = FolderOpen,
  loading = false,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Empty
      className={cn(
        "min-h-[14rem] w-full border border-dashed border-slate-200/90 bg-slate-50/60 py-14",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="mb-1 size-12 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 [&_svg]:size-6"
        >
          {loading ? (
            <LoaderCircle className="animate-spin text-slate-400" aria-hidden />
          ) : (
            <Icon className="text-slate-500" aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-base font-semibold text-slate-900">
          {title}
        </EmptyTitle>
        {description ? (
          <EmptyDescription className="max-w-md text-sm">
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

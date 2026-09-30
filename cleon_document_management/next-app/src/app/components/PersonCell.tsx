"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function PersonCell({
  name,
  subtitle,
  href,
}: {
  name: string;
  subtitle?: string;
  href?: string;
}) {
  const label = name || "—";
  const body = (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback>{initialsFromName(label)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="block min-w-0 no-underline hover:text-primary">
        {body}
      </Link>
    );
  }
  return body;
}

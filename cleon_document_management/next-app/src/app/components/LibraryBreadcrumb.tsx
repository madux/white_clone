"use client";

import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type LibraryCrumb = {
  label: string;
  href?: string;
};

export default function LibraryBreadcrumb({ items }: { items: LibraryCrumb[] }) {
  if (!items.length) return null;
  return (
    <Breadcrumb className="px-1">
      <BreadcrumbList>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <BreadcrumbItem key={`${item.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              {last || !item.href ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={item.href} />}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

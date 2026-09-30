"use client";

import type { ComponentType } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NewMenuItem = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  reason?: string;
  children?: NewMenuItem[];
};

export type NewMenuGroup = {
  label: string;
  items: NewMenuItem[];
};

export default function NewMenu({
  items,
  groups,
  label = "New",
  disabled,
}: {
  items?: NewMenuItem[];
  groups?: NewMenuGroup[];
  label?: string;
  disabled?: boolean;
}) {
  const grouped = groups?.filter((group) => group.items.length) ?? [];
  const flat = grouped.length
    ? grouped.flatMap((group) => group.items)
    : items ?? [];
  if (!flat.length) return null;
  const enabled = flat.filter((item) => !item.disabled);
  if (enabled.length === 1 && enabled.length === flat.length && grouped.length <= 1) {
    const only = enabled[0];
    const Icon = only.icon ?? Plus;
    return (
      <Button disabled={disabled} onClick={only.onSelect}>
        <Icon data-icon="inline-start" />
        {label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button>
            <Plus data-icon="inline-start" />
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-56">
        {grouped.length
          ? grouped.map((group) => (
              <DropdownMenuGroup key={group.label}>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <NewMenuRow key={item.label} item={item} />
                ))}
              </DropdownMenuGroup>
            ))
          : (
              <DropdownMenuGroup>
                {flat.map((item) => (
                  <NewMenuRow key={item.label} item={item} />
                ))}
              </DropdownMenuGroup>
            )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewMenuRow({ item }: { item: NewMenuItem }) {
  const Icon = item.icon ?? Plus;
  if (item.children?.length) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={item.disabled} title={item.reason}>
          <Icon />
          <span className="flex min-w-0 flex-col">
            <span>{item.label}</span>
            {item.disabled && item.reason ? (
              <span className="text-xs text-muted-foreground">{item.reason}</span>
            ) : null}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {item.children.map((child) => (
            <NewMenuRow key={child.label} item={child} />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  return (
    <DropdownMenuItem
      disabled={item.disabled}
      title={item.reason}
      onClick={() => {
        if (!item.disabled) item.onSelect();
      }}
    >
      <Icon />
      <span className="flex min-w-0 flex-col">
        <span>{item.label}</span>
        {item.disabled && item.reason ? (
          <span className="text-xs text-muted-foreground">{item.reason}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  );
}

"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export default function AppToolbar({
  leading,
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  extras,
  toggle,
  actions,
  footer,
}: {
  leading?: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  extras?: ReactNode;
  toggle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="app-toolbar">
      <div className="app-toolbar-row">
        {leading ? <div className="app-toolbar-leading">{leading}</div> : null}
        {onSearchChange ? (
          <InputGroup className="app-toolbar-search max-w-[420px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
            {search ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => onSearchChange("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        ) : null}
        {extras ? <div className="app-toolbar-extras">{extras}</div> : null}
        {toggle ? <div className="app-toolbar-toggle">{toggle}</div> : null}
        {actions ? <div className="app-toolbar-actions">{actions}</div> : null}
      </div>
      {footer ? <div className="app-toolbar-footer">{footer}</div> : null}
    </div>
  );
}

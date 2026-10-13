"use client";

import { Mail, UserRound, Users } from "lucide-react";
import { useState } from "react";
import SectionTabs from "../SectionTabs";
import InvitationsSettingsPanel from "./InvitationsSettingsPanel";
import RolesSettingsPanel from "./RolesSettingsPanel";
import UsersSettingsPanel from "./UsersSettingsPanel";

const TABS = [
  { id: "users" as const, label: "Users", icon: Users },
  { id: "roles" as const, label: "Roles", icon: UserRound },
  { id: "invitations" as const, label: "Invitations", icon: Mail },
];

export default function UsersRolesSettingsTab({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<"users" | "roles" | "invitations">("roles");

  return (
    <div className={embedded ? "space-y-6" : "space-y-6"}>
      <SectionTabs
        ariaLabel="Users and roles"
        value={tab}
        onChange={setTab}
        items={TABS}
        level={embedded ? "nested" : "page"}
      />
      {tab === "users" ? (
        <UsersSettingsPanel />
      ) : tab === "invitations" ? (
        <InvitationsSettingsPanel />
      ) : (
        <RolesSettingsPanel />
      )}
    </div>
  );
}

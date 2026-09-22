"use client";

import { AlertTriangle, LoaderCircle, Search, Shield, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useAssignModuleRoles,
  useModuleRoleDefinitions,
  useModuleRoleMembers,
} from "../../../hooks/useModuleRoles";
import type {
  ModuleRoleAssignment,
  ModuleRoleDefinition,
  ModuleRoleMember,
} from "../../../lib/types";

export default function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [draftRoles, setDraftRoles] = useState<ModuleRoleMember | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const definitionsQuery = useModuleRoleDefinitions();
  const membersQuery = useModuleRoleMembers(debouncedSearch);
  const assignMutation = useAssignModuleRoles();

  const assignableRoles = useMemo(
    () =>
      (definitionsQuery.data || []).filter(
        (role): role is ModuleRoleDefinition & { role_key: "manager" | "admin" } =>
          role.assignable &&
          (role.role_key === "manager" || role.role_key === "admin"),
      ),
    [definitionsQuery.data],
  );

  const members = membersQuery.data || [];
  const selectedMember =
    draftRoles ||
    members.find((member) => member.employee_id === selectedEmployeeId) ||
    null;

  useEffect(() => {
    setDraftRoles(null);
  }, [selectedEmployeeId]);

  function handleToggle(roleKey: "manager" | "admin", enabled: boolean) {
    if (!selectedMember) return;
    const base = draftRoles || selectedMember;
    const nextRoles = { ...base.roles, [roleKey]: enabled, user: true };
    if (roleKey === "admin" && enabled) nextRoles.manager = true;
    if (roleKey === "manager" && !enabled) nextRoles.admin = false;
    setDraftRoles({ ...base, roles: nextRoles });
  }

  async function handleSave() {
    if (!selectedMember) return;
    setNotice(null);
    const source = draftRoles || selectedMember;
    const assignments: ModuleRoleAssignment[] = assignableRoles.map((role) => ({
      role_key: role.role_key,
      enabled: Boolean(source.roles[role.role_key]),
    }));
    try {
      const updated = await assignMutation.mutateAsync({
        employee_id: selectedMember.employee_id,
        assignments,
      });
      setDraftRoles(updated);
      setNotice("Company Documentary roles updated successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Roles could not be updated.");
    }
  }

  const activeMember = draftRoles || selectedMember;

  const hasChanges =
    !!draftRoles &&
    JSON.stringify(draftRoles.roles) !== JSON.stringify(selectedMember?.roles);

  return (
    <div className={`roles-admin-page ${embedded ? "is-embedded" : ""}`}>
      {!embedded ? (
        <div className="roles-admin-header">
          <div>
            <p className="roles-admin-eyebrow">System administration</p>
            <h1>Company Documentary roles</h1>
            <p>Assign Manager and Administrator responsibilities for Company Documentary.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!selectedMember?.has_login || !hasChanges || assignMutation.isPending}
          >
            {assignMutation.isPending && <LoaderCircle size={16} className="spin" />}
            Save roles
          </button>
        </div>
      ) : (
        <div className="roles-admin-toolbar">
          <p>Assign Manager and Administrator roles for Company Documentary.</p>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!selectedMember?.has_login || !hasChanges || assignMutation.isPending}
          >
            {assignMutation.isPending && <LoaderCircle size={16} className="spin" />}
            Save roles
          </button>
        </div>
      )}
      {notice && <p className="roles-admin-notice">{notice}</p>}

      <div className="roles-admin-grid">
        <section className="roles-admin-panel">
          <label>Employee search</label>
          <div className="roles-admin-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or login"
            />
          </div>
          <div className="roles-admin-list">
            {members.map((member) => (
              <button
                key={member.employee_id}
                type="button"
                className={`roles-admin-member ${selectedEmployeeId === member.employee_id ? "active" : ""}`}
                onClick={() => setSelectedEmployeeId(member.employee_id)}
              >
                <UserRound size={16} />
                <div>
                  <strong>{member.employee_name}</strong>
                  <span>{member.department || "No department"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="roles-admin-detail">
          {!selectedMember && <p className="roles-admin-empty">Select an employee to assign roles.</p>}
          {selectedMember && (
            <>
              <section className="roles-admin-panel">
                <p className="roles-admin-eyebrow">Selected employee</p>
                <h2>{selectedMember.employee_name}</h2>
                {!selectedMember.has_login && (
                  <div className="roles-admin-warning">
                    <AlertTriangle size={16} />
                    <span>This employee has no linked Odoo user account.</span>
                  </div>
                )}
              </section>
              <section className="roles-admin-panel">
                <div className="roles-admin-module-title">
                  <Shield size={18} />
                  <div>
                    <h3>Company Documentary</h3>
                    <p>Manager and Administrator tiers for this module only.</p>
                  </div>
                </div>
                {activeMember &&
                  assignableRoles.map((role) => (
                    <div key={role.role_key} className="roles-admin-toggle-row">
                      <div>
                        <strong>{role.label}</strong>
                        <p>{role.description}</p>
                        <small>{role.capabilities}</small>
                      </div>
                      <button
                        type="button"
                        className={`roles-admin-toggle ${activeMember.roles[role.role_key] ? "on" : ""}`}
                        disabled={assignMutation.isPending || !activeMember.has_login}
                        onClick={() => handleToggle(role.role_key, !activeMember.roles[role.role_key])}
                      />
                    </div>
                  ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

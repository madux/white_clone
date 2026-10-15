"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Circle,
  Crown,
  LoaderCircle,
  Save,
  Search,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import {
  useAssignModuleRoles,
  useModuleRoleDefinitions,
  useModuleRoleMemberStats,
  useModuleRoleMembers,
} from "../../../hooks/useModuleRoles";
import {
  applyTierToRoles,
  avatarTone,
  initialsFromName,
  memberRoleTier,
  ROLE_TIER_CARDS,
  tierLabel,
  TIER_PRIVILEGES,
  type DocumentaryRoleTier,
} from "../../../lib/documentaryRoleTiers";
import type { ModuleRoleAssignment, ModuleRoleMember } from "../../../lib/types";
import { RoleCapabilitiesMatrix } from "./RoleCapabilitiesMatrix";

type RolesTab = "assignments" | "matrix";

const MEMBER_PAGE_SIZE = 5;

function RoleBadge({ tier }: { tier: DocumentaryRoleTier }) {
  return <span className={`roles-tier-badge roles-tier-badge--${tier}`}>{tierLabel(tier)}</span>;
}

export default function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<RolesTab>("assignments");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedMemberRecord, setSelectedMemberRecord] = useState<ModuleRoleMember | null>(null);
  const [page, setPage] = useState(1);
  const [draftRoles, setDraftRoles] = useState<ModuleRoleMember | null>(null);
  const [draftTier, setDraftTier] = useState<DocumentaryRoleTier | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isCompactRoles = useMediaQuery("(max-width: 900px)");
  const [mobileRolesPanel, setMobileRolesPanel] = useState<"list" | "detail">("list");
  const compactRoles = embedded && isCompactRoles;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useModuleRoleDefinitions();
  const memberOffset = (page - 1) * MEMBER_PAGE_SIZE;
  const statsQuery = useModuleRoleMemberStats();
  const membersQuery = useModuleRoleMembers(
    debouncedSearch,
    true,
    MEMBER_PAGE_SIZE,
    memberOffset,
  );
  const assignMutation = useAssignModuleRoles();

  const members = membersQuery.data?.items ?? [];
  const totalMembers = membersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalMembers / MEMBER_PAGE_SIZE));

  const selectedMember =
    draftRoles ||
    (selectedMemberRecord?.employee_id === selectedEmployeeId ? selectedMemberRecord : null) ||
    members.find((member) => member.employee_id === selectedEmployeeId) ||
    null;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (selectedEmployeeId || membersQuery.isLoading || !members.length) return;
    setSelectedEmployeeId(members[0].employee_id);
    setSelectedMemberRecord(members[0]);
  }, [members, membersQuery.isLoading, selectedEmployeeId]);

  useEffect(() => {
    setDraftRoles(null);
    setDraftTier(null);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!compactRoles) setMobileRolesPanel("list");
  }, [compactRoles]);

  const activeMember = draftRoles || selectedMember;
  const activeTier =
    draftTier ?? (activeMember ? memberRoleTier(activeMember) : "employee");

  const stats = statsQuery.data ?? {
    total: 0,
    administrator: 0,
    supervisor: 0,
    employee: 0,
  };

  const baselineMember = useMemo(() => {
    const fromPage = members.find((member) => member.employee_id === selectedEmployeeId);
    if (fromPage) return fromPage;
    if (selectedMemberRecord?.employee_id === selectedEmployeeId) return selectedMemberRecord;
    return null;
  }, [members, selectedEmployeeId, selectedMemberRecord]);

  const rangeStart = totalMembers === 0 ? 0 : memberOffset + 1;
  const rangeEnd = Math.min(memberOffset + members.length, totalMembers);

  const hasChanges = Boolean(
    draftRoles &&
      baselineMember &&
      JSON.stringify(draftRoles.roles) !== JSON.stringify(baselineMember.roles),
  );

  function selectTier(tier: DocumentaryRoleTier) {
    if (!activeMember) return;
    const base = draftRoles || activeMember;
    setDraftTier(tier);
    setDraftRoles({
      ...base,
      roles: applyTierToRoles(base.roles, tier),
    });
  }

  async function handleSave() {
    if (!selectedMember || !draftRoles) return;
    setNotice(null);
    const assignments: ModuleRoleAssignment[] = [
      { role_key: "manager", enabled: Boolean(draftRoles.roles.manager) },
      { role_key: "admin", enabled: Boolean(draftRoles.roles.admin) },
    ];
    try {
      const updated = await assignMutation.mutateAsync({
        employee_id: selectedMember.employee_id,
        assignments,
      });
      setDraftRoles(null);
      setDraftTier(null);
      if (updated) setSelectedMemberRecord(updated);
      setNotice("Assignments saved successfully.");
      void statsQuery.refetch();
      void membersQuery.refetch();
      return updated;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Roles could not be updated.");
    }
  }

  return (
    <div
      className={`roles-access-page ${embedded ? "is-embedded" : ""}${compactRoles ? " is-compact" : ""}`}
    >
      <header className="roles-access-header roles-access-header--toolbar">
        <div className="roles-access-header-actions">
          <div className="roles-access-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "assignments"}
              className={tab === "assignments" ? "active" : ""}
              onClick={() => setTab("assignments")}
            >
              Member Assignments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "matrix"}
              className={tab === "matrix" ? "active" : ""}
              onClick={() => setTab("matrix")}
            >
              Role Access Matrix
            </button>
          </div>
          {tab === "assignments" ? (
            <button
              type="button"
              className="primary-button roles-access-save"
              onClick={() => void handleSave()}
              disabled={!selectedMember?.has_login || !hasChanges || assignMutation.isPending}
            >
              {assignMutation.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              Save assignments
            </button>
          ) : null}
        </div>
      </header>

      {notice ? <p className="roles-admin-notice">{notice}</p> : null}

      {tab === "matrix" ? (
        <RoleCapabilitiesMatrix variant="matrix" />
      ) : (
        <>
          <div className="roles-access-stats">
            <article className="roles-stat-card roles-stat-card--primary">
              <Users size={18} />
              <div>
                <strong>{stats.total} members</strong>
                <span>Enterprise directory</span>
              </div>
            </article>
            <article className="roles-stat-card">
              <Crown size={18} />
              <div>
                <strong>{stats.administrator}</strong>
                <span>Full governance authority</span>
              </div>
            </article>
            <article className="roles-stat-card">
              <Shield size={18} />
              <div>
                <strong>{stats.supervisor}</strong>
                <span>Media &amp; review control</span>
              </div>
            </article>
            <article className="roles-stat-card">
              <UserRound size={18} />
              <div>
                <strong>{stats.employee}</strong>
                <span>Viewing &amp; playback only</span>
              </div>
            </article>
          </div>

          <div className="roles-access-layout">
            <section
              className={`roles-access-list-panel${compactRoles && mobileRolesPanel === "detail" ? " is-hidden-mobile" : ""}`}
            >
              <h2>Employee search ({totalMembers})</h2>
              <div className="roles-access-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, or login..."
                />
              </div>
              <div className="roles-access-member-list">
                {membersQuery.isLoading ? (
                  <div className="loading-state compact">
                    <LoaderCircle className="spin" size={20} />
                  </div>
                ) : members.length === 0 ? (
                  <p className="roles-admin-empty inline">No employees match your search.</p>
                ) : (
                  members.map((member) => {
                    const tier = memberRoleTier(member);
                    const selected = selectedEmployeeId === member.employee_id;
                    return (
                      <button
                        key={member.employee_id}
                        type="button"
                        className={`roles-access-member-row${selected ? " is-selected" : ""}`}
                        onClick={() => {
                          setSelectedEmployeeId(member.employee_id);
                          setSelectedMemberRecord(member);
                          if (compactRoles) setMobileRolesPanel("detail");
                        }}
                      >
                        <span className={`roles-avatar roles-avatar--${avatarTone(member.employee_name)}`}>
                          {initialsFromName(member.employee_name)}
                        </span>
                        <span className="roles-access-member-copy">
                          <strong>{member.employee_name}</strong>
                          <span>{member.department || "No department"}</span>
                        </span>
                        <RoleBadge tier={tier} />
                      </button>
                    );
                  })
                )}
              </div>
              {totalMembers > MEMBER_PAGE_SIZE ? (
                <div className="roles-access-pagination">
                  <p>
                    {rangeStart}–{rangeEnd} of {totalMembers}
                  </p>
                  <div className="roles-access-pagination-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={page <= 1 || membersQuery.isFetching}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </button>
                    <span className="roles-access-pagination-meta">
                      Page {page} of {pageCount}
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={page >= pageCount || membersQuery.isFetching}
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section
              className={`roles-access-detail-panel${compactRoles && mobileRolesPanel === "list" ? " is-hidden-mobile" : ""}`}
            >
              {compactRoles && mobileRolesPanel === "detail" ? (
                <button
                  type="button"
                  className="roles-access-mobile-back"
                  onClick={() => setMobileRolesPanel("list")}
                >
                  <ChevronLeft size={18} aria-hidden />
                  Employees
                </button>
              ) : null}
              {!activeMember ? (
                <p className="roles-admin-empty">Select an employee to assign a Documentary role.</p>
              ) : (
                <>
                  <div className="roles-access-profile">
                    <span
                      className={`roles-avatar roles-avatar--lg roles-avatar--${avatarTone(activeMember.employee_name)}`}
                    >
                      {initialsFromName(activeMember.employee_name)}
                    </span>
                    <div>
                      <div className="roles-access-profile-title">
                        <h2>{activeMember.employee_name}</h2>
                        {activeMember.has_login ? (
                          <span className="roles-active-pill">Active</span>
                        ) : null}
                      </div>
                      <p>
                        {activeMember.user_login || activeMember.user_name || "No login"}
                        {activeMember.department ? ` · ${activeMember.department}` : ""}
                      </p>
                    </div>
                  </div>

                  {!activeMember.has_login && (
                    <div className="roles-admin-warning">
                      <AlertTriangle size={16} />
                      <span>This employee needs a linked Odoo user before roles can be assigned.</span>
                    </div>
                  )}

                  <div className="roles-access-section">
                    <h3>Assign documentary role</h3>
                    <p className="roles-access-section-hint">Select one authorization level</p>
                    <div className="roles-tier-cards">
                      {ROLE_TIER_CARDS.map((card) => {
                        const selected = activeTier === card.tier;
                        return (
                          <button
                            key={card.tier}
                            type="button"
                            disabled={!activeMember.has_login || assignMutation.isPending}
                            className={`roles-tier-card${selected ? " is-selected" : ""}`}
                            onClick={() => selectTier(card.tier)}
                          >
                            <span className="roles-tier-card-radio" aria-hidden />
                            <span className="roles-tier-card-body">
                              <span className="roles-tier-card-title-row">
                                <strong>{card.title}</strong>
                                <span className="roles-tier-card-badge">{card.badge}</span>
                              </span>
                              <span className="roles-tier-card-desc">{card.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="roles-access-privileges">
                    <h4>Privileges for {tierLabel(activeTier)} tier</h4>
                    <ul>
                      {TIER_PRIVILEGES[activeTier].map((item) => (
                        <li key={item.label} className={item.allowed ? "allowed" : "denied"}>
                          {item.allowed ? <Check size={16} /> : <Circle size={16} />}
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

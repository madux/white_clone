"use client";

import { Search, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useAssignEmployeeFilesRoles,
  useEmployeeFilesRoleMembers,
  useEmployeeFilesRoles,
} from "../../../../hooks/useEmployeeFilesRoles";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../../lib/employeeFileListPageSize";
import type { EmployeeFilesRoleMember } from "../../../../lib/types";
import { useToast } from "../../../../hooks/useToast";
import EmptyState from "../EmptyState";
import ListPagination from "../ListPagination";
import ModalDialog from "../ModalDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EffectivePermissionsDrawer from "./EffectivePermissionsDrawer";

function scopeLabel(scope: string): string {
  if (scope === "all") return "All employees";
  if (scope === "department") return "Department";
  return "Own team";
}

export default function UsersSettingsPanel() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<EmployeeFilesRoleMember | null>(
    null,
  );
  const [draftRoleIds, setDraftRoleIds] = useState<number[] | null>(null);
  const [effectiveUser, setEffectiveUser] = useState<{
    id: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const rolesQuery = useEmployeeFilesRoles();
  const membersQuery = useEmployeeFilesRoleMembers(debounced, page, true);
  const assignMutation = useAssignEmployeeFilesRoles();

  const roles = rolesQuery.data || membersQuery.data?.roles || [];
  const members = membersQuery.data?.members || [];
  const total = membersQuery.data?.total ?? members.length;

  const activeRoleIds =
    draftRoleIds ?? selectedMember?.employee_files_role_ids ?? [];

  const assignChanged =
    draftRoleIds !== null &&
    JSON.stringify(draftRoleIds) !==
      JSON.stringify(selectedMember?.employee_files_role_ids || []);

  function openRoles(member: EmployeeFilesRoleMember) {
    setSelectedMember(member);
    setDraftRoleIds(null);
  }

  function closeRoles() {
    setSelectedMember(null);
    setDraftRoleIds(null);
  }

  async function saveAssignments() {
    if (!selectedMember?.user_id) return;
    try {
      await assignMutation.mutateAsync({
        user_id: selectedMember.user_id,
        role_ids: activeRoleIds,
      });
      setDraftRoleIds(null);
      closeRoles();
      showToast("Roles updated.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Assignments could not be saved.",
        "error",
      );
    }
  }

  const roleNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const role of roles) {
      if (role.id) map.set(role.id, role.name);
    }
    return map;
  }, [roles]);

  return (
    <div className="space-y-4">
      <InputGroup className="max-w-lg">
        <InputGroupAddon>
          <Search className="h-4 w-4" />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search employees by name, department, or login"
          aria-label="Search users"
        />
      </InputGroup>

      <div className="app-table-well">
        {membersQuery.isLoading ? (
          <EmptyState title="Loading users…" loading />
        ) : !total ? (
          <EmptyState title="No users found" description="Try a different search." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const roleNames = member.employee_files_role_ids
                    .map((id) => roleNameById.get(id))
                    .filter(Boolean)
                    .join(", ");
                  const canAssign = member.has_login && Boolean(member.user_id);
                  return (
                    <TableRow key={member.employee_id}>
                      <TableCell className="font-semibold">
                        {member.employee_name}
                      </TableCell>
                      <TableCell>{member.department || "—"}</TableCell>
                      <TableCell>
                        {member.has_login ? member.user_login || "Linked" : "No login"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {roleNames || "None"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 whitespace-nowrap px-2.5"
                            onClick={() => openRoles(member)}
                          >
                            <Users className="h-3.5 w-3.5" data-icon="inline-start" />
                            Roles
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 whitespace-nowrap px-2.5"
                            disabled={!canAssign}
                            title={
                              canAssign
                                ? "View effective permissions"
                                : "Requires a linked login"
                            }
                            onClick={() => {
                              if (!member.user_id) return;
                              setEffectiveUser({
                                id: member.user_id as number,
                                name: member.employee_name,
                              });
                            }}
                          >
                            <Shield className="h-3.5 w-3.5" data-icon="inline-start" />
                            Effective
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ListPagination
              page={page}
              pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {selectedMember ? (
        <ModalDialog
          title={selectedMember.employee_name}
          eyebrow="Assign roles"
          description={
            selectedMember.has_login && selectedMember.user_id
              ? "Select the roles this user should have. Changes apply on their next request."
              : "This employee does not have a linked Odoo user yet."
          }
          size="lg"
          onClose={closeRoles}
          closeDisabled={assignMutation.isPending}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeRoles}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  !selectedMember.has_login ||
                  !selectedMember.user_id ||
                  !assignChanged ||
                  assignMutation.isPending
                }
                onClick={() => void saveAssignments()}
              >
                Save assignments
              </Button>
            </div>
          }
        >
          {!selectedMember.has_login || !selectedMember.user_id ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Link an Odoo user to this employee before assigning roles.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Role</TableHead>
                  <TableHead>Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Checkbox
                        checked={activeRoleIds.includes(role.id!)}
                        onCheckedChange={(value) => {
                          const checked = value === true;
                          const next = checked
                            ? [...activeRoleIds, role.id!]
                            : activeRoleIds.filter((id) => id !== role.id);
                          setDraftRoleIds(Array.from(new Set(next)));
                        }}
                        aria-label={`Assign ${role.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{scopeLabel(role.employee_scope)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ModalDialog>
      ) : null}

      {effectiveUser ? (
        <EffectivePermissionsDrawer
          userId={effectiveUser.id}
          userName={effectiveUser.name}
          onClose={() => setEffectiveUser(null)}
        />
      ) : null}
    </div>
  );
}

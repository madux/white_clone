"use client";

import { useState } from "react";
import {
  useEmployeeFileGroups,
  useUpdateEmployeeFileGroup,
} from "../../../hooks/useEmployeeFiles";
import { api } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../hooks/useToast";
import UiSwitch from "./UiSwitch";

export default function EmployeeFilesCustomGroupsSettings({
  enabled,
}: {
  enabled: boolean;
}) {
  const groups = useEmployeeFileGroups({
    group_kind: "custom",
    include_all_custom: true,
  });
  const updateGroup = useUpdateEmployeeFileGroup();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createGroup = async () => {
    if (!name.trim()) return;
    try {
      await api.createCustomEmployeeGroup({
        name: name.trim(),
        description: description.trim(),
      });
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["employee-files", "groups"] });
      showToast("Custom group created.");
    } catch (error: any) {
      showToast(error?.message || "Unable to create group.", "error");
    }
  };

  if (!enabled) {
    return (
      <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Enable custom groups under the General tab to create and activate groups here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <h4 className="text-sm font-bold text-slate-900">Create custom group</h4>
        <p className="mt-1 text-xs text-slate-500">
          Groups stay in settings until you activate them; only activated groups appear on Employee Files home.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <input
            className="field"
            placeholder="Group name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="field"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white"
          onClick={createGroup}
        >
          Create group
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Members</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(groups.data ?? []).map((group) => (
              <tr key={group.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{group.name}</p>
                  {group.description ? (
                    <p className="text-xs text-slate-500">{group.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">{group.employee_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <UiSwitch
                    checked={Boolean(group.show_on_home)}
                    label={`Show ${group.name} on Employee Files home`}
                    onChange={() =>
                      updateGroup.mutate({
                        id: group.id,
                        show_on_home: !group.show_on_home,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!groups.data?.length ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No custom groups yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

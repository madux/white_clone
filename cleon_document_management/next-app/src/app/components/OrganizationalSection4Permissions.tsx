"use client";

import {
  ORG_SECTION4_GROUPS,
  defaultOrganizationalPermissions,
} from "../../../lib/orgRolePermissionGroups";
import type { OrganizationalPermissionsMap } from "../../../lib/types";

export default function OrganizationalSection4Permissions({
  permissions,
  onChange,
  readOnly = false,
}: {
  permissions?: Partial<OrganizationalPermissionsMap>;
  onChange: (next: OrganizationalPermissionsMap) => void;
  readOnly?: boolean;
}) {
  const merged = { ...defaultOrganizationalPermissions(), ...permissions };

  return (
    <div className="ef-role-access">
      <div className="ef-role-access__intro">
        <div>
          <p className="employee-filter-section-title">Section 4 permissions</p>
          <p className="ef-role-access__hint">
            Each action is independent. Pairs with “no approval” skip the organisational
            approval queue when that capability is enabled.
          </p>
        </div>
      </div>
      <div className="ef-role-access__rows">
        {ORG_SECTION4_GROUPS.map((group) => (
          <article key={group.title} className="ef-role-access-row">
            <header className="ef-role-access-row__header">
              <p className="ef-role-access-row__title">{group.title}</p>
            </header>
            <div className="ef-role-access-matrix-wrap">
              <table className="ef-role-access-matrix">
                <thead>
                  <tr>
                    {group.columns.map((column) => (
                      <th key={column.key} title={column.hint}>
                        <span className="ef-role-access-matrix__label">{column.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {group.columns.map((column) => {
                      const isOn = Boolean(merged[column.key]);
                      return (
                        <td key={column.key}>
                          <label
                            className={`ef-role-access-matrix__cell ${isOn ? "is-on" : ""}`}
                            title={column.hint}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              disabled={readOnly}
                              onChange={(event) =>
                                onChange({
                                  ...merged,
                                  [column.key]: event.target.checked,
                                })
                              }
                              className="sr-only"
                            />
                            <span className="ef-role-access-matrix__check" aria-hidden />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

"use client";

type Cell = "yes" | "no" | "via" | "na";

const ROLE_COLUMNS = ["Employee", "Supervisor", "Administrator"] as const;

const MATRIX_ROWS: {
  label: string;
  employee: Cell;
  supervisor: Cell;
  administrator: Cell;
  viaLabel?: string;
}[] = [
  { label: "Dashboard", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Albums (browse)", employee: "yes", supervisor: "yes", administrator: "yes" },
  {
    label: "Create album",
    employee: "no",
    supervisor: "yes",
    administrator: "yes",
    viaLabel: "Supervisor: pending · Admin: auto-approved",
  },
  { label: "Gallery", employee: "yes", supervisor: "yes", administrator: "yes" },
  { label: "Pending review", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Recycle bin", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Upload history", employee: "yes", supervisor: "yes", administrator: "yes" },
  { label: "My contributions", employee: "yes", supervisor: "no", administrator: "no" },
  { label: "Audit log", employee: "no", supervisor: "no", administrator: "yes" },
  { label: "Settings", employee: "no", supervisor: "no", administrator: "yes" },
  {
    label: "Upload media (direct)",
    employee: "via",
    supervisor: "via",
    administrator: "via",
    viaLabel: "Employee: Upload button · Supervisor/Admin: via album",
  },
  { label: "Delete or restore media", employee: "no", supervisor: "yes", administrator: "yes" },
];

function formatCell(value: Cell, row: (typeof MATRIX_ROWS)[number], role: "employee" | "supervisor" | "administrator") {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === "via") {
    if (role === "employee") return "Upload button";
    return "Via album";
  }
  return "N/A";
}

const ROLE_DESCRIPTIONS = [
  {
    title: "Employee",
    body: "Contribution and viewing. Browse, upload for review, and track My Contributions.",
  },
  {
    title: "Supervisor",
    body: "Curation and review. Dashboard, albums, pending queue, recycle bin, and album uploads.",
  },
  {
    title: "Administrator",
    body: "Full control including audit log, settings, compliance, and auto-approved albums.",
  },
];

export function RoleCapabilitiesMatrix({ variant = "full" }: { variant?: "full" | "matrix" }) {
  return (
    <section className={`roles-capabilities-matrix${variant === "matrix" ? " is-matrix-tab" : ""}`}>
      {variant !== "matrix" ? (
        <div className="roles-capabilities-head">
          <h3>Role based access matrix</h3>
          <p>Social Gallery screens and actions by authorization tier (SRS §2.3).</p>
        </div>
      ) : null}
      <div className="roles-capabilities-descriptions">
        {ROLE_DESCRIPTIONS.map((role) => (
          <article key={role.title}>
            <strong>{role.title}</strong>
            <p>{role.body}</p>
          </article>
        ))}
      </div>
      <div className="roles-matrix-table-wrap">
        <table className="roles-matrix-table">
          <thead>
            <tr>
              <th>Screen or action</th>
              {ROLE_COLUMNS.map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row) => (
              <tr key={row.label}>
                <td>
                  {row.label}
                  {row.viaLabel ? <small className="roles-matrix-hint">{row.viaLabel}</small> : null}
                </td>
                <td>{formatCell(row.employee, row, "employee")}</td>
                <td>{formatCell(row.supervisor, row, "supervisor")}</td>
                <td>{formatCell(row.administrator, row, "administrator")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

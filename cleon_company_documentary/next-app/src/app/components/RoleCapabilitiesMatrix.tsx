"use client";

type Cell = "yes" | "no" | "na";

const ROLE_COLUMNS = ["Employee", "Supervisor", "Administrator"] as const;

const MATRIX_ROWS: { label: string; employee: Cell; supervisor: Cell; administrator: Cell }[] = [
  { label: "Documentary Library (browse and play)", employee: "yes", supervisor: "yes", administrator: "yes" },
  { label: "Upload or replace video", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Edit documentary details", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Edit transcript", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Manage captions", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Move to folder and manage folders", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Delete and restore (recycle bin)", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Analytics and reporting", employee: "no", supervisor: "yes", administrator: "yes" },
  { label: "Settings and configuration", employee: "no", supervisor: "no", administrator: "yes" },
  { label: "Employee view preview", employee: "na", supervisor: "yes", administrator: "yes" },
];

function formatCell(value: Cell) {
  if (value === "yes") return "Yes";
  if (value === "na") return "N/A";
  return "No";
}

const ROLE_DESCRIPTIONS = [
  {
    title: "Employee",
    body:
      "Viewing only. Browse and play published documentaries, read transcripts, and use captions.",
  },
  {
    title: "Supervisor",
    body: "Video management, review, transcripts, captions, and analytics.",
  },
  {
    title: "Administrator",
    body: "Full library governance including publishing, settings, and role assignments.",
  },
];

export function RoleCapabilitiesMatrix({ variant = "full" }: { variant?: "full" | "matrix" }) {
  return (
    <section className={`roles-capabilities-matrix${variant === "matrix" ? " is-matrix-tab" : ""}`}>
      {variant !== "matrix" ? (
        <div className="roles-capabilities-head">
          <h3>Role based access matrix</h3>
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
                <td>{row.label}</td>
                <td>{formatCell(row.employee)}</td>
                <td>{formatCell(row.supervisor)}</td>
                <td>{formatCell(row.administrator)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

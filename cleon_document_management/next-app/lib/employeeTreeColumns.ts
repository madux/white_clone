/** Shared column cell classes for employee file tree rows (admin + personal). */
export const employeeTreeCol = {
  check: "employee-tree-col-check",
  toggle: "employee-tree-col-toggle",
  icon: "employee-tree-col-icon",
  name: "employee-tree-col-name",
  category: "employee-tree-col-category",
  docType: "employee-tree-col-doctype",
  uploadDate: "employee-tree-col-upload-date",
  version: "employee-tree-col-version",
  status: "employee-tree-col-status",
  actions: "employee-tree-col-actions",
} as const;

export const employeeTreeColsAdmin = "employee-tree-cols employee-tree-cols--admin";
export const employeeTreeColsPersonal =
  "employee-tree-cols employee-tree-cols--personal";

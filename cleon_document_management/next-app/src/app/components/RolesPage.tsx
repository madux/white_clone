"use client";

import UsersRolesSettingsTab from "./settings/UsersRolesSettingsTab";

export default function RolesPage({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return <UsersRolesSettingsTab embedded />;
  }

  return (
    <div className="app-page">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="p-5 sm:p-6">
          <UsersRolesSettingsTab />
        </div>
      </section>
    </div>
  );
}

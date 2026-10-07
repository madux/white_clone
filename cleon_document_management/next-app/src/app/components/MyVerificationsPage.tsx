"use client";

import ComplianceVerificationsSection from "./ComplianceVerificationsSection";

export default function MyVerificationsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  return <ComplianceVerificationsSection embedded={embedded} />;
}

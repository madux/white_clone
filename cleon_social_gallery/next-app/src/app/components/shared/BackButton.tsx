"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}

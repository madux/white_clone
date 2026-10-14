"use client";

import type { ReactNode } from "react";
import { WizardSectionHeader } from "./WizardSectionHeader";

function StepShell({
  title,
  description,
  children,
  letter = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  letter?: string;
}) {
  return (
    <div className="space-y-4">
      <WizardSectionHeader
        letter={letter}
        title={title}
        description={description}
      />
      {children}
    </div>
  );
}

export function PolicyWizardBasicsSection({ children }: { children: ReactNode }) {
  return (
    <StepShell
      title="Basic information"
      description="Name this rule, choose its type, and add context for administrators."
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </StepShell>
  );
}

export function PolicyWizardAudienceSection({ children }: { children: ReactNode }) {
  return (
    <StepShell
      letter="B"
      title="Applies to"
      description="Target workforce members based on organizational units, locations, and job classifications."
    >
      {children}
    </StepShell>
  );
}

export function PolicyWizardRequirementsSection({
  children,
  typeName,
}: {
  children: ReactNode;
  typeName?: string;
}) {
  return (
    <StepShell
      letter="A"
      title="Requirements"
      description={
        typeName
          ? `Configure what this ${typeName.toLowerCase()} rule expects from employees.`
          : "Configure documents, verification, and type-specific requirements."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </StepShell>
  );
}

export function PolicyWizardRetentionConfigureSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StepShell
      letter=""
      title="Configure requirements"
      description="Select document types, review retention rules from settings, and choose how actions run."
    >
      <div className="w-full min-w-0">{children}</div>
    </StepShell>
  );
}

export function PolicyWizardTimingSection({ children }: { children: ReactNode }) {
  return (
    <StepShell
      letter="C"
      title="Timing & completion"
      description="Set schedules, effective dates, deadlines, and completion thresholds."
    >
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </StepShell>
  );
}

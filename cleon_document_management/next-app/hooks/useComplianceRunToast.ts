"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../lib/api";
import { QUERY_KEYS } from "./useDocuments";
import { useToast } from "./useToast";

function invalidateComplianceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluations });
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evaluationRuns });
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exceptions });
  void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies });
}

type EvaluateResult = {
  message?: string;
  async?: boolean;
  run_id?: number;
  run?: { id?: number; state?: string };
};

const POLL_MS = 450;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useComplianceRunToast() {
  const queryClient = useQueryClient();
  const { showProgressToast, updateProgressToast, finishProgressToast } = useToast();

  const waitForRun = useCallback(
    async (runId: number, policyName: string, toastId: number) => {
      const label = policyName.trim() || "Compliance rule";
      for (;;) {
        const progress = await api.getComplianceRunProgress(runId);
        const total = progress.progress_total ?? 0;
        const done = progress.progress_done ?? 0;
        const percent =
          progress.progress_percent ??
          (total > 0 ? Math.round((done * 100) / total) : 0);
        const detail =
          progress.progress_message ||
          (total > 0 ? `${done} of ${total} employees` : "Starting…");

        updateProgressToast(
          toastId,
          `Running "${label}"`,
          detail,
          Math.min(100, Math.max(0, percent)),
        );

        if (progress.state === "completed") {
          return progress.message || `Compliance run finished for "${label}".`;
        }
        if (progress.state === "failed") {
          throw new Error(
            progress.error_message || progress.message || "Compliance run failed.",
          );
        }
        await sleep(POLL_MS);
      }
    },
    [updateProgressToast],
  );

  const runPolicyEvaluation = useCallback(
    async (
      policyName: string,
      evaluate: () => Promise<EvaluateResult>,
    ): Promise<EvaluateResult> => {
      const label = policyName.trim() || "Compliance rule";
      const toastId = showProgressToast(`Running "${label}"`, "Starting…", 0);

      try {
        const result = await evaluate();
        const runId = result.run_id ?? result.run?.id;
        if (result.async && runId) {
          const message = await waitForRun(runId, label, toastId);
          finishProgressToast(toastId, message, "success");
          invalidateComplianceQueries(queryClient);
          return { ...result, message };
        }

        const doneMessage =
          result.message?.trim() || `Compliance run finished for "${label}".`;
        updateProgressToast(toastId, `Running "${label}"`, "Complete", 100);
        finishProgressToast(toastId, doneMessage, "success");
        invalidateComplianceQueries(queryClient);
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Compliance run could not be completed.";
        finishProgressToast(toastId, message, "error");
        throw error;
      }
    },
    [
      finishProgressToast,
      queryClient,
      showProgressToast,
      updateProgressToast,
      waitForRun,
    ],
  );

  const runManyPolicyEvaluations = useCallback(
    async (
      policies: { id: number; name: string }[],
      evaluate: (policyId: number) => Promise<EvaluateResult>,
    ) => {
      for (const policy of policies) {
        await runPolicyEvaluation(policy.name, () => evaluate(policy.id));
      }
    },
    [runPolicyEvaluation],
  );

  return { runPolicyEvaluation, runManyPolicyEvaluations };
}

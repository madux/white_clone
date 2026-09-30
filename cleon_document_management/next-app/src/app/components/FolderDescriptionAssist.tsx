"use client";

import { Loader2, Sparkles } from "lucide-react";
import { api } from "../../../lib/api";
import { useToast } from "../../../hooks/useToast";
import { useState } from "react";

export default function FolderDescriptionAssist({
  name,
  visibility,
  description,
  onDescriptionChange,
}: {
  name: string;
  visibility?: string;
  description: string;
  onDescriptionChange: (value: string) => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const folderName = name.trim();
  const hasDraft = Boolean(description.trim());

  const suggest = async () => {
    if (!folderName) {
      showToast("Enter a folder name first.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await api.suggestOrganizationalFolderDescription({
        name: folderName,
        visibility,
        description: description.trim() || undefined,
      });
      const suggested = result.data?.description?.trim() || "";
      if (!suggested) {
        showToast("The model did not return a description.", "error");
        return;
      }
      onDescriptionChange(suggested.slice(0, 500));
      showToast(hasDraft ? "Description refined." : "Description suggested.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to suggest a description.";
      showToast(
        /timeout/i.test(message)
          ? "The AI suggestion took too long. Try again."
          : message,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={suggest}
      disabled={loading || !folderName}
      title={
        folderName
          ? hasDraft
            ? "Refine this description with AI"
            : "Generate a description from the folder name"
          : "Enter a folder name first"
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-semibold text-brand-pink hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {loading
        ? "Suggesting…"
        : hasDraft
          ? "Refine with AI"
          : "Suggest with AI"}
    </button>
  );
}

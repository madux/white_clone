import type { DocumentRelationType } from "./types";

export const DOCUMENT_RELATION_TYPE_OPTIONS: {
  value: DocumentRelationType;
  label: string;
  hint: string;
}[] = [
  {
    value: "amendment",
    label: "Amendment",
    hint: "This document amends the selected one",
  },
  {
    value: "renewal",
    label: "Renewal",
    hint: "This document renews the selected one",
  },
  {
    value: "supporting",
    label: "Supporting document",
    hint: "This document supports the selected one",
  },
  {
    value: "related",
    label: "Related",
    hint: "General relationship",
  },
];

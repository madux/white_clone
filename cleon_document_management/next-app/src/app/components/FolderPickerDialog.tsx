"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocFolder } from "../../../lib/types";
import FolderTreePicker from "./FolderTreePicker";
import ModalDialog from "./ModalDialog";
import { Button } from "@/components/ui/button";

export default function FolderPickerDialog({
  title,
  folders,
  excludeIds = [],
  confirmLabel,
  pending,
  allowRoot,
  onClose,
  onPick,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  folders: DocFolder[];
  excludeIds?: number[];
  confirmLabel: string;
  pending?: boolean;
  allowRoot?: boolean;
  onClose: () => void;
  onPick: (folderId: number | false) => void | Promise<void>;
}) {
  const destinations = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.folder_type === "organizational" &&
          !excludeIds.includes(folder.id),
      ),
    [excludeIds, folders],
  );
  const [destinationId, setDestinationId] = useState<number | false | "">(
    allowRoot ? false : destinations[0]?.id ?? "",
  );
  const initialized = useRef(Boolean(allowRoot || destinations[0]));

  useEffect(() => {
    if (initialized.current) return;
    if (allowRoot) {
      setDestinationId(false);
      initialized.current = true;
      return;
    }
    if (destinations[0]) {
      setDestinationId(destinations[0].id);
      initialized.current = true;
    }
  }, [allowRoot, destinations]);

  return (
    <ModalDialog title={title} onClose={onClose} size="md" zIndex={110}>
      <div className="space-y-2">
        <span className="text-sm font-semibold">Destination</span>
        <FolderTreePicker
          folders={folders}
          excludeIds={excludeIds}
          allowRoot={allowRoot}
          value={destinationId}
          onChange={setDestinationId}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={destinationId === "" || pending}
          onClick={() =>
            void onPick(destinationId === "" ? false : destinationId)
          }
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </ModalDialog>
  );
}

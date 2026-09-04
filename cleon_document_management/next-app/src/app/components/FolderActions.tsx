"use client";

import {
  Archive,
  Download,
  Edit3,
  Ellipsis,
  FolderHeart,
  Lock,
  Pin,
  Share2,
  Trash2,
  Unlock,
  Copy,
  X,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import {
  useDeleteFolder,
  useFolderAction,
  useUpdateFolder,
} from "../../../hooks/useDocuments";
import { useClickOutside } from "../../../hooks/useClickOutside";

export default function FolderActions({
  folderId,
  folderName,
  description = "",
  locked = false,
}: {
  folderId: number;
  folderName: string;
  description?: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folderName);
  const [folderDescription, setFolderDescription] = useState(description);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const update = useUpdateFolder();
  const remove = useDeleteFolder();
  const action = useFolderAction();

  // Handle outside clicks using menuRef for the portal and triggerRef for the toggle button
  useClickOutside(menuRef, () => setOpen(false), [triggerRef]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect)
        setMenuPosition({
          top: rect.bottom + 8,
          left: Math.max(8, rect.right - 208),
        });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const run = async (task: () => Promise<unknown>) => {
    setOpen(false);
    await task();
  };

  const share = async () => {
    const result = await action.mutateAsync({
      id: folderId,
      action: "share",
      permission: "viewer",
      expiry_option: "7_days",
      allow_download: true,
    });
    if (result.data?.url)
      await navigator.clipboard?.writeText(
        `${window.location.origin}${result.data.url}`,
      );
    window.alert("Folder share link copied.");
    setOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await update.mutateAsync({
      id: folderId,
      name: name.trim(),
      description: folderDescription.trim(),
    });
    setEditing(false);
    setOpen(false);
  };

  const deleteFolder = async () => {
    if (!window.confirm(`Delete "${folderName}"? This cannot be undone.`))
      return;
    await remove.mutateAsync(folderId);
    router.push("/pages/employee");
  };

  return (
    <div
      ref={containerRef}
      className="relative text-left"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-xl p-2 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
        aria-label={`Actions for ${folderName}`}
      >
        <Ellipsis className="h-5 w-5" />
      </button>

      {/* DROPDOWN MENU PORTAL */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-[100] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60"
          >
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setOpen(false);
              }}
              className="menu-item"
            >
              <Edit3 />
              Edit folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "favorite" }),
                )
              }
              className="menu-item"
            >
              <FolderHeart />
              Favorite
            </button>
            <button
              type="button"
              onClick={() =>
                run(() => action.mutateAsync({ id: folderId, action: "pin" }))
              }
              className="menu-item"
            >
              <Pin />
              Pin folder
            </button>
            <button type="button" onClick={share} className="menu-item">
              <Share2 />
              Share folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  api.downloadFolder(folderId);
                })
              }
              className="menu-item"
            >
              <Download />
              Download folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "duplicate" }),
                )
              }
              className="menu-item"
            >
              <Copy />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({
                    id: folderId,
                    action: locked ? "unlock" : "lock",
                  }),
                )
              }
              className="menu-item"
            >
              {locked ? <Unlock /> : <Lock />}
              {locked ? "Unlock folder" : "Lock folder"}
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "archive" }),
                )
              }
              className="menu-item"
            >
              <Archive />
              Archive
            </button>
            <button
              type="button"
              onClick={deleteFolder}
              className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 />
              Delete folder
            </button>
          </div>,
          document.body,
        )}

      {/* EDIT FOLDER MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
          <form
            onSubmit={save}
            className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 text-left shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col items-start">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                  Folder settings
                </p>
                <h2 className="mt-0.5 text-xl font-bold text-slate-900 leading-tight">
                  Edit folder
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="flex flex-col items-start gap-1.5 w-full text-left">
              <span className="label text-sm font-medium text-slate-700">
                Folder name
              </span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field w-full"
              />
            </label>

            <label className="flex flex-col items-start gap-1.5 w-full text-left">
              <span className="label text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                className="field min-h-24 w-full"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={update.isPending}
                type="submit"
                className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-opacity"
              >
                {update.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

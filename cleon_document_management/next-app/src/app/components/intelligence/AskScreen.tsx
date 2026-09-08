"use client";

import {
  ArrowUp,
  Bookmark,
  Eye,
  FileText,
  Link2,
  Loader2,
  Mic,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useIntelligenceConversations,
  useIntelligenceDatasets,
} from "../../../../hooks/useIntelligence";
import { intelligenceDatasetApi } from "../../../../lib/intelligence-api";
import type {
  IntelligenceChatMessage,
  IntelligenceConversation,
} from "../../../../lib/intelligence-api";
import ChatMarkdown from "./ChatMarkdown";
import { IntelligenceError } from "./states";

const MASCOT = "/cleon_document_management/static/src/nextapp/ask_ai.png";

const SUGGESTIONS = [
  { category: "Contracts", text: "Which contracts expire in the next 90 days?" },
  { category: "HR", text: "Show contracts with no notice period." },
  { category: "Onboarding", text: "Which employees are still on probation?" },
  { category: "Compliance", text: "Which employees are missing mandatory training certificates?" },
  { category: "Contracts", text: "Who has expired certifications?" },
  { category: "Conduct", text: "Employees with 3+ warnings" },
];

const CATEGORIES = ["All Suggestions", "HR", "Compliance", "Contracts", "Onboarding", "Conduct"];

function sourceHref(source: IntelligenceConversation["sources"][number]) {
  if (source.kind === "url" && source.url) {
    return source.url;
  }
  const origin = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");
  return `${origin}${source.preview_url || ""}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AskScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceDocumentId = Number(searchParams.get("document") || 0) || 0;
  const [tab, setTab] = useState<"recent" | "saved">("recent");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Suggestions");
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<IntelligenceConversation | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryRows, setLibraryRows] = useState<
    Array<{ id: number; name: string; document_type: string; employee: string }>
  >([]);
  const [librarySelected, setLibrarySelected] = useState<number[]>([]);
  const [sourceSelected, setSourceSelected] = useState<number[]>([]);
  const [viewingSource, setViewingSource] = useState<{
    name: string;
    href: string;
    external: boolean;
  } | null>(null);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<
    Array<{ name: string; size: number }>
  >([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const datasets = useIntelligenceDatasets();
  const list = useIntelligenceConversations(tab === "saved", search);
  const messages = conversation?.messages || [];
  const suggestions = SUGGESTIONS.filter(
    (item) => category === "All Suggestions" || item.category === category,
  );

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
      return;
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy, thinking, messages[messages.length - 1]?.content]);

  useEffect(() => {
    if (!attachOpen) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (!attachRef.current?.contains(event.target as Node)) {
        setAttachOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAttachOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [attachOpen]);

  useEffect(() => {
    const ids = new Set((conversation?.sources || []).map((source) => source.id));
    setSourceSelected((current) => current.filter((id) => ids.has(id)));
  }, [conversation?.sources]);

  async function refreshList() {
    await queryClient.invalidateQueries({ queryKey: ["intelligence", "conversations"] });
  }

  useEffect(() => {
    if (!sourceDocumentId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const next = await intelligenceDatasetApi.conversationAttachLibrary({
          document_id: sourceDocumentId,
        });
        if (cancelled) {
          return;
        }
        setConversation(next);
        await refreshList();
        router.replace("/pages/document-intelligence/ask");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "That document could not be opened in Ask AI.",
          );
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceDocumentId, queryClient, router]);

  async function send(text = question) {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }
    const pendingUser: IntelligenceChatMessage = {
      id: -Date.now(),
      role: "user",
      content: trimmed,
      citations: [],
      intent: "",
      fact_based: false,
      model: "",
      insufficient_evidence: false,
      create_date: "",
    };
    setBusy(true);
    setThinking(true);
    setError("");
    setQuestion("");
    setConversation((current) => ({
      id: current?.id || 0,
      name: current?.name || "New chat",
      saved: current?.saved || false,
      dataset_id: current?.dataset_id || false,
      dataset: current?.dataset || "",
      write_date: current?.write_date || "",
      preview: trimmed,
      sources: current?.sources || [],
      messages: [...(current?.messages || []), pendingUser],
    }));
    let draft = "";
    try {
      await intelligenceDatasetApi.conversationAskStream(
        {
          id: conversation?.id,
          question: trimmed,
          dataset_id: conversation?.dataset_id || undefined,
        },
        (event) => {
          const type = String(event.event || "");
          if (type === "error") {
            throw new Error(String(event.message || "The question could not be answered."));
          }
          if (type === "meta") {
            const userMessage = event.user_message as IntelligenceChatMessage;
            setConversation((current) => ({
              ...(current as IntelligenceConversation),
              id: Number(event.id || current?.id || 0),
              name: String(event.name || current?.name || "New chat"),
              messages: [
                ...(current?.messages || []).filter((item) => item.id !== pendingUser.id),
                userMessage,
              ],
            }));
            void refreshList();
            return;
          }
          if (type === "rename") {
            setConversation((current) => ({
              ...(current as IntelligenceConversation),
              name: String(event.name || current?.name || "New chat"),
            }));
            void refreshList();
            return;
          }
          if (type === "thinking") {
            setThinking(true);
            return;
          }
          if (type === "delta") {
            draft += String(event.text || "");
            setThinking(false);
            setConversation((current) => {
              const rows = [...(current?.messages || [])];
              const last = rows[rows.length - 1];
              if (last?.role === "assistant" && last.id < 0) {
                rows[rows.length - 1] = { ...last, content: draft };
              } else {
                rows.push({
                  id: -2,
                  role: "assistant",
                  content: draft,
                  citations: [],
                  intent: "",
                  fact_based: false,
                  model: "",
                  insufficient_evidence: false,
                  create_date: "",
                });
              }
              return { ...(current as IntelligenceConversation), messages: rows };
            });
            return;
          }
          if (type === "done") {
            setThinking(false);
            setConversation(event.conversation as IntelligenceConversation);
            void refreshList();
          }
        },
      );
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : "The question could not be answered.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteChat(id: number) {
    setBusy(true);
    setError("");
    try {
      await intelligenceDatasetApi.conversationDelete(id);
      if (conversation?.id === id) {
        setConversation(null);
      }
      setPendingDelete(null);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The chat could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function ensureConversation() {
    if (conversation?.id) {
      return conversation;
    }
    const created = await intelligenceDatasetApi.conversationCreate();
    setConversation(created);
    return created;
  }

  async function attachUploads(fileList: File[]) {
    const files = fileList.filter(Boolean);
    if (!files.length) {
      return;
    }
    const attachedNames = new Set(
      (conversation?.sources || []).map((source) => source.name.trim().toLowerCase()),
    );
    const unique: File[] = [];
    const seen = new Set<string>();
    const duplicates: string[] = [];
    files.forEach((file) => {
      const key = file.name.trim().toLowerCase();
      if (attachedNames.has(key) || seen.has(key)) {
        duplicates.push(file.name);
        return;
      }
      seen.add(key);
      unique.push(file);
    });
    if (!unique.length) {
      setAttachOpen(false);
      setError(
        duplicates.length === 1
          ? `${duplicates[0]} is already attached to this chat.`
          : "Those files are already attached to this chat.",
      );
      return;
    }
    if (duplicates.length) {
      setError(
        `${duplicates.join(", ")} already attached. Uploading the other file${
          unique.length === 1 ? "" : "s"
        }.`,
      );
    } else {
      setError("");
    }
    setUploadingFiles(unique.map((file) => ({ name: file.name, size: file.size })));
    setAttachOpen(false);
    try {
      const current = await ensureConversation();
      const payload = await Promise.all(
        unique.map(async (file) => ({
          name: file.name,
          mimetype: file.type || "application/octet-stream",
          data: await fileToBase64(file),
        })),
      );
      const next = await intelligenceDatasetApi.conversationAttachUpload({
        id: current.id,
        files: payload,
        name: payload[0]?.name,
        mimetype: payload[0]?.mimetype,
        data: payload[0]?.data,
      });
      setConversation(next);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The files could not be attached.");
    } finally {
      setUploadingFiles([]);
    }
  }

  async function removeSources(sourceIds: number[]) {
    if (!conversation?.id || !sourceIds.length) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await intelligenceDatasetApi.conversationRemoveSources({
        id: conversation.id,
        source_ids: sourceIds,
      });
      setConversation(next);
      setSourceSelected([]);
      await refreshList();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Those files could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openSource(source: IntelligenceConversation["sources"][number]) {
    const href = sourceHref(source);
    if (!href) {
      setError("This file cannot be previewed.");
      return;
    }
    if (source.kind === "url") {
      window.open(href, "_blank", "noreferrer");
      return;
    }
    setViewingSource({ name: source.name, href, external: false });
  }

  function startVoice() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice could not be transcribed. Check the microphone permission.");
    };
    recognition.onresult = (event: SpeechVoiceResultEvent) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (spoken) {
        setQuestion(spoken);
      }
    };
    recognition.start();
  }

  const indexed = list.data?.indexed_count ?? 0;
  const rows = [...(list.data?.conversations || [])].sort((left, right) =>
    String(right.write_date || "").localeCompare(String(left.write_date || "")),
  );
  const hasThread = messages.length > 0 || thinking;

  return (
    <div className="grid h-full min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[16.5rem_minmax(0,1fr)_15rem]">
      <aside className="flex min-h-0 flex-col border-b border-slate-100 bg-slate-50 lg:border-b-0 lg:border-r">
        <div className="shrink-0 p-3">
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm hover:border-pink-200 hover:text-brand-text"
            onClick={async () => {
              const created = await intelligenceDatasetApi.conversationCreate();
              setConversation(created);
              await refreshList();
            }}
          >
            + New chat
          </button>
          <p className="mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {indexed.toLocaleString()} indexed documents
          </p>
          <div className="mt-3 flex gap-4 px-1 text-sm font-semibold">
            <button
              type="button"
              className={tab === "recent" ? "text-slate-900" : "text-slate-400"}
              onClick={() => setTab("recent")}
            >
              Chats
              {tab === "recent" ? (
                <span className="mt-1 block h-0.5 rounded-full bg-brand-pink" />
              ) : null}
            </button>
            <button
              type="button"
              className={tab === "saved" ? "text-slate-900" : "text-slate-400"}
              onClick={() => setTab("saved")}
            >
              Saved
              {tab === "saved" ? (
                <span className="mt-1 block h-0.5 rounded-full bg-brand-pink" />
              ) : null}
            </button>
          </div>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {rows.length ? (
            <ul className="space-y-0.5">
              {rows.map((item) => (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    className={`w-full truncate rounded-lg py-2 pl-3 pr-9 text-left text-sm ${
                      conversation?.id === item.id
                        ? "bg-white font-medium text-slate-900 shadow-sm"
                        : "text-slate-700 hover:bg-white/80"
                    }`}
                    title={item.name}
                    onClick={async () => {
                      const full = await intelligenceDatasetApi.conversationGet(item.id);
                      setConversation(full);
                    }}
                  >
                    {item.name}
                  </button>
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 group-hover:block"
                    aria-label={`Delete ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDelete({ id: item.id, name: item.name });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-sm text-slate-400">
              Your chats will show up here.
            </p>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-pink">
              Cleon AI
            </p>
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {conversation?.name || "Ask about your HR documents"}
            </h1>
          </div>
        </div>
        {error ? (
          <div className="shrink-0 px-5 pt-3">
            <IntelligenceError message={error} />
          </div>
        ) : null}
        <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {hasThread ? (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-auto bg-pink-50 text-slate-800"
                      : "mr-auto bg-slate-50 text-slate-800"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <ChatMarkdown text={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </article>
              ))}
              {thinking ? (
                <p className="animate-pulse text-sm text-slate-400">Thinking…</p>
              ) : null}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-6 text-center">
              <div className="h-24 w-28 overflow-hidden rounded-full bg-black shadow-lg ring-4 ring-slate-100">
                <img src={MASCOT} alt="Ask Cleon AI" className="h-full w-full object-cover" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
                Welcome to Ask Cleon AI
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                {conversation?.sources?.length
                  ? `This chat is focused on ${conversation.sources[0].name}. Approved datasets can still fill in extra context.`
                  : "Ask anything about your HR documents — contracts, employee files, certifications, and compliance records."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      category === item
                        ? "bg-brand-pink text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-pink-200"
                    }`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
                {suggestions.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-semibold leading-6 text-slate-700 transition hover:border-brand-pink hover:shadow-sm"
                    onClick={() => send(item.text)}
                  >
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {item.category}
                    </span>
                    {item.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          className="shrink-0 border-t border-slate-100 bg-white px-5 py-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            send();
          }}
        >
          {(conversation?.sources || []).length || uploadingFiles.length ? (
            <div className="mx-auto mb-3 max-w-3xl lg:hidden">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Attached files
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {uploadingFiles.map((file) => (
                  <div
                    key={`uploading-mobile-${file.name}`}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-pink" />
                    <span className="max-w-[10rem] truncate text-xs font-semibold text-brand-text">
                      {file.name}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-brand-pink">
                      Uploading
                    </span>
                  </div>
                ))}
                {conversation?.sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5"
                  >
                    <button
                      type="button"
                      className="max-w-[10rem] truncate text-xs font-semibold text-slate-700"
                      onClick={() => openSource(source)}
                    >
                      {source.name}
                    </button>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => void removeSources([source.id])}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {uploadingFiles.length ? (
            <div className="mx-auto mb-3 hidden max-w-3xl gap-2 lg:flex">
              {uploadingFiles.map((file) => (
                <div
                  key={`uploading-desktop-${file.name}`}
                  className="flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-pink" />
                  <span className="max-w-[14rem] truncate text-xs font-semibold text-brand-text">
                    {file.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase text-brand-pink">
                    Uploading{formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-2 py-2 shadow-sm focus-within:border-brand-pink/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-pink/10">
              <div className="relative" ref={attachRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-white disabled:opacity-50"
                  aria-label={uploadingFiles.length ? "Uploading files" : "Attach a source"}
                  disabled={Boolean(uploadingFiles.length)}
                  onClick={() => setAttachOpen((open) => !open)}
                >
                  {uploadingFiles.length ? (
                    <Loader2 className="h-5 w-5 animate-spin text-brand-pink" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
                {attachOpen ? (
                  <div className="absolute bottom-12 left-0 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload files from computer
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAttachOpen(false);
                        setUrlOpen(true);
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                      Paste a URL
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={async () => {
                        setAttachOpen(false);
                        setLibraryOpen(true);
                        setLibrarySelected([]);
                        setLibrarySearch("");
                        const rows = await intelligenceDatasetApi.libraryDocuments();
                        setLibraryRows(rows);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      From document library
                    </button>
                  </div>
                ) : null}
              </div>
              <textarea
                className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm text-slate-800 outline-none"
                value={question}
                maxLength={4000}
                placeholder="Ask Cleon AI anything about your documents"
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="button"
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  listening ? "bg-brand-pink text-white" : "text-slate-500 hover:bg-white"
                }`}
                aria-label="Speak your question"
                onClick={startVoice}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="submit"
                disabled={busy || Boolean(uploadingFiles.length) || !question.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-sm disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 10) {
                    setError("You can attach up to 10 files at once.");
                  } else if (files.length) {
                    void attachUploads(files);
                  }
                  event.target.value = "";
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>{question.length}/4000</span>
              <span>AI can make mistakes. Double-check important info.</span>
         
            </div>
          </div>
        </form>
      </section>

      <aside className="hidden min-h-0 flex-col overflow-hidden border-l border-slate-100 bg-slate-50/80 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Attached files</p>
            {(conversation?.sources || []).length || uploadingFiles.length ? (
              <span className="text-xs font-semibold text-slate-400">
                {(conversation?.sources.length || 0) + uploadingFiles.length}
              </span>
            ) : null}
          </div>
          {(conversation?.sources || []).length || uploadingFiles.length ? (
            <>
              {uploadingFiles.length ? (
                <ul className="mt-3 space-y-2">
                  {uploadingFiles.map((file) => (
                    <li
                      key={`aside-uploading-${file.name}`}
                      className="rounded-2xl border border-pink-200 bg-pink-50 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-pink" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-brand-text">
                            {file.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-brand-pink">
                            Uploading
                            {formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : ""}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(conversation?.sources || []).length ? (
              <>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-pink"
                  onClick={() => {
                    const ids = (conversation?.sources || []).map((item) => item.id);
                    const allOn = ids.every((id) => sourceSelected.includes(id));
                    setSourceSelected(allOn ? [] : ids);
                  }}
                >
                  {conversation?.sources.length &&
                  conversation.sources.every((item) => sourceSelected.includes(item.id))
                    ? "Clear"
                    : "Select all"}
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-600 disabled:opacity-40"
                  disabled={busy || !sourceSelected.length}
                  onClick={() => void removeSources(sourceSelected)}
                >
                  Delete selected
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {(conversation?.sources || []).map((source) => {
                  const checked = sourceSelected.includes(source.id);
                  return (
                    <li
                      key={source.id}
                      className={`rounded-2xl border bg-white p-3 ${
                        checked ? "border-brand-pink" : "border-slate-200"
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-pink-600"
                          checked={checked}
                          onChange={() =>
                            setSourceSelected((current) =>
                              checked
                                ? current.filter((id) => id !== source.id)
                                : [...current, source.id],
                            )
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {source.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">
                            {source.kind}
                          </span>
                        </span>
                      </label>
                      <div className="mt-2 flex gap-2 pl-6">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-pink"
                          onClick={() => openSource(source)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                          onClick={() => void removeSources([source.id])}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Files from your computer, Employee Files, or Organizational Files
              appear here. You can view or remove them at any time.
            </p>
          )}
          <p className="mt-6 text-sm font-bold text-slate-900">Working set</p>
          <select
            className="field mt-2"
            value={conversation?.dataset_id || ""}
            onChange={async (event) => {
              const current = await ensureConversation();
              const next = await intelligenceDatasetApi.conversationUpdate({
                id: current.id,
                dataset_id: event.target.value ? Number(event.target.value) : 0,
              });
              setConversation({
                ...next,
                messages: current.messages || next.messages,
              });
            }}
          >
            <option value="">All approved records</option>
            {(datasets.data || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {conversation?.id ? (
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
              onClick={async () => {
                const next = await intelligenceDatasetApi.conversationSave(
                  conversation.id,
                  !conversation.saved,
                );
                setConversation({ ...conversation, saved: next.saved });
                await refreshList();
              }}
            >
              <Bookmark className="h-4 w-4" />
              {conversation.saved ? "Saved chat" : "Save this chat"}
            </button>
          ) : null}
        </div>
      </aside>

      {urlOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setUrlOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <h2 className="font-bold text-slate-900">Paste a URL</h2>
            <input
              className="field mt-3"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              placeholder="https://"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-sm" onClick={() => setUrlOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-pink px-4 py-2 text-sm font-semibold text-white"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const current = await ensureConversation();
                    const next = await intelligenceDatasetApi.conversationAttachUrl({
                      id: current.id,
                      url: urlValue,
                    });
                    setConversation(next);
                    setUrlOpen(false);
                    setUrlValue("");
                    await refreshList();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "The URL could not be added.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {libraryOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setLibraryOpen(false);
              setLibrarySelected([]);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-5">
            <h2 className="font-bold text-slate-900">Document library</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select live files from Employee Files or Organizational Files.
              Recycle bin, archived, and Document Intelligence staging files
              are not listed.
            </p>
            <input
              className="field mt-3"
              value={librarySearch}
              placeholder="Search files you can access"
              onChange={async (event) => {
                setLibrarySearch(event.target.value);
                const rows = await intelligenceDatasetApi.libraryDocuments(
                  event.target.value,
                );
                setLibraryRows(rows);
              }}
            />
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{librarySelected.length} selected</span>
              <button
                type="button"
                className="text-brand-pink"
                onClick={() => {
                  const visible = libraryRows.map((item) => item.id);
                  const allOn = visible.every((id) => librarySelected.includes(id));
                  setLibrarySelected(
                    allOn
                      ? librarySelected.filter((id) => !visible.includes(id))
                      : Array.from(new Set([...librarySelected, ...visible])),
                  );
                }}
              >
                {libraryRows.length &&
                libraryRows.every((item) => librarySelected.includes(item.id))
                  ? "Clear visible"
                  : "Select visible"}
              </button>
            </div>
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {libraryRows.map((item) => {
                const alreadyAttached =
                  Boolean(item.id) &&
                  (conversation?.sources || []).some(
                    (source) =>
                      source.document_id === item.id ||
                      source.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
                  );
                const checked = librarySelected.includes(item.id);
                return (
                  <li key={item.id}>
                    <label
                      className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm ${
                        alreadyAttached
                          ? "cursor-not-allowed opacity-50"
                          : `cursor-pointer hover:bg-slate-50 ${checked ? "bg-pink-50" : ""}`
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-pink-600"
                        disabled={alreadyAttached}
                        checked={checked}
                        onChange={() =>
                          setLibrarySelected((current) =>
                            checked
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                      />
                      <span>
                        <span className="block font-semibold text-slate-800">
                          {item.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {alreadyAttached
                            ? "Already attached to this chat"
                            : `${item.document_type}${
                                item.employee ? ` · ${item.employee}` : ""
                              }`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500"
                onClick={() => {
                  setLibraryOpen(false);
                  setLibrarySelected([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || librarySelected.length === 0}
                className="rounded-full bg-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const current = await ensureConversation();
                    const next = await intelligenceDatasetApi.conversationAttachLibrary({
                      id: current.id,
                      document_ids: librarySelected,
                      document_id: librarySelected[0],
                    });
                    setConversation(next);
                    setLibraryOpen(false);
                    setLibrarySelected([]);
                    await refreshList();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "The documents could not be attached.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Attaching…"
                  : `Attach ${librarySelected.length} file${
                      librarySelected.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {viewingSource ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setViewingSource(null);
          }}
        >
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="truncate font-bold text-slate-900">{viewingSource.name}</h2>
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setViewingSource(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              title={viewingSource.name}
              src={viewingSource.href}
              className="min-h-0 flex-1 bg-slate-50"
            />
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPendingDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                  Ask Cleon AI
                </p>
                <h2 id="delete-chat-title" className="mt-1 text-xl font-bold text-slate-900">
                  Delete this chat?
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  “{pendingDelete.name}” will be removed. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
                onClick={() => setPendingDelete(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full bg-red-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                onClick={() => void deleteChat(pendingDelete.id)}
              >
                {busy ? "Deleting…" : "Delete chat"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SpeechVoiceResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechVoiceResultEvent) => void) | null;
  start: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

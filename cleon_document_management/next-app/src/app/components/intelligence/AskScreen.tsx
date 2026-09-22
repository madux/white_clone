"use client";

import {
  ArrowUp,
  Bookmark,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  History,
  Layers,
  Link2,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useIntelligenceConversations,
  useIntelligenceDatasets,
} from "../../../../hooks/useIntelligence";
import { intelligenceDatasetApi } from "../../../../lib/intelligence-api";
import AskIndexStatusPanel from "./AskIndexStatusPanel";
import type {
  IntelligenceChatMessage,
  IntelligenceConversation,
  IntelligenceDataset,
} from "../../../../lib/intelligence-api";
import ChatMarkdown from "./ChatMarkdown";
import { IntelligenceError } from "./states";

const MASCOT = "/document-management/ask_ai.png";

function isAskReadyDataset(item: IntelligenceDataset) {
  if (["draft", "failed", "cancelled", "rejected"].includes(item.state)) {
    return false;
  }
  return (
    item.record_count > 0 ||
    item.state === "completed" ||
    item.state === "needs_review"
  );
}

const SUGGESTIONS = [
  { category: "Compliance", text: "Who has expired certifications?", Icon: ShieldAlert },
  { category: "Contracts", text: "Contracts expiring in 90 days", Icon: FileText },
  { category: "HR", text: "Missing medical certificates", Icon: FileText },
  { category: "Onboarding", text: "Employees missing onboarding docs", Icon: Users },
  { category: "Compliance", text: "Missing mandatory training", Icon: ShieldAlert },
  { category: "Contracts", text: "Contracts with no notice period", Icon: FileText },
  { category: "Conduct", text: "Employees with 3+ warnings", Icon: ShieldAlert },
  { category: "Onboarding", text: "Employees still on probation", Icon: Layers },
  { category: "HR", text: "Policy acknowledgements pending", Icon: FileText },
  { category: "Contracts", text: "Which contracts expire in the next 90 days?", Icon: FileText },
  { category: "HR", text: "Show contracts with no notice period.", Icon: FileText },
  { category: "Compliance", text: "Which employees are missing mandatory training certificates?", Icon: ShieldAlert },
];

const CATEGORIES = ["All Suggestions", "HR", "Compliance", "Contracts", "Onboarding", "Conduct"];

const PLACEHOLDER_EXAMPLES = [
  "List employees",
  "Who has expired certifications?",
  "Contracts expiring in 90 days",
  "Missing medical certificates",
  "Employees missing onboarding docs",
];

function useTypedPlaceholder(paused: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (paused) {
      setText("");
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0;
    let count = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const full = PLACEHOLDER_EXAMPLES[index];
      if (reduced) {
        setText(full);
        index = (index + 1) % PLACEHOLDER_EXAMPLES.length;
        timer = window.setTimeout(tick, 2800);
        return;
      }
      if (!deleting) {
        count += 1;
        setText(full.slice(0, count));
        if (count >= full.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1500);
          return;
        }
        timer = window.setTimeout(tick, 42);
        return;
      }
      count -= 1;
      setText(full.slice(0, count));
      if (count <= 0) {
        deleting = false;
        index = (index + 1) % PLACEHOLDER_EXAMPLES.length;
        timer = window.setTimeout(tick, 320);
        return;
      }
      timer = window.setTimeout(tick, 24);
    };
    timer = window.setTimeout(tick, 200);
    return () => window.clearTimeout(timer);
  }, [paused]);

  return text;
}

function formatMessageTime(value: string) {
  const parsed = value
    ? new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`)
    : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [localDatasetId, setLocalDatasetId] = useState<number | "">("");
  const [datasetTouched, setDatasetTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const datasetRef = useRef<HTMLSelectElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const datasets = useIntelligenceDatasets();
  const readyDatasets = useMemo(
    () => (datasets.data || []).filter(isAskReadyDataset),
    [datasets.data],
  );
  const list = useIntelligenceConversations(tab === "saved", search);
  const messages = conversation?.messages || [];
  const suggestions = SUGGESTIONS.filter(
    (item) => category === "All Suggestions" || item.category === category,
  );
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 9);
  const focusedDatasetId: number | "" = datasetTouched
    ? localDatasetId
    : Number(conversation?.dataset_id || 0) ||
      (readyDatasets.length === 1 ? readyDatasets[0].id : "");
  const focusedDatasetName =
    (focusedDatasetId
      ? readyDatasets.find((item) => item.id === focusedDatasetId)?.name ||
        conversation?.dataset
      : "") || "";

  function fitComposer() {
    const el = composerRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 220)}px`;
  }

  useEffect(() => {
    fitComposer();
  }, [question]);

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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (attachOpen) {
        setAttachOpen(false);
        return;
      }
      if (urlOpen) {
        setUrlOpen(false);
        return;
      }
      if (libraryOpen) {
        setLibraryOpen(false);
        setLibrarySelected([]);
        return;
      }
      if (viewingSource) {
        setViewingSource(null);
        return;
      }
      if (pendingDelete) {
        setPendingDelete(null);
        return;
      }
      router.push("/pages/document-intelligence");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attachOpen, urlOpen, libraryOpen, viewingSource, pendingDelete, router]);

  useEffect(() => {
    setDatasetTouched(false);
  }, [conversation?.id]);

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

  async function send(text = question, options?: { regenerate?: boolean }) {
    const trimmed = text.trim();
    const regenerate = Boolean(options?.regenerate);
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
      create_date: new Date().toISOString(),
    };
    setBusy(true);
    setThinking(true);
    setError("");
    setQuestion("");
    setConversation((current) => {
      const rows = [...(current?.messages || [])];
      const nextRows = regenerate
        ? rows[rows.length - 1]?.role === "assistant"
          ? rows.slice(0, -1)
          : rows
        : [...rows, pendingUser];
      return {
        id: current?.id || 0,
        name: current?.name || "New chat",
        saved: current?.saved || false,
        dataset_id: focusedDatasetId || false,
        dataset: focusedDatasetName,
        write_date: current?.write_date || "",
        preview: trimmed,
        sources: current?.sources || [],
        messages: nextRows,
      };
    });
    let draft = "";
    try {
      await intelligenceDatasetApi.conversationAskStream(
        {
          id: conversation?.id,
          question: trimmed,
          dataset_id: focusedDatasetId || 0,
          regenerate,
        },
        (event) => {
          const type = String(event.event || "");
          if (type === "error") {
            throw new Error(String(event.message || "The question could not be answered."));
          }
          if (type === "meta") {
            const userMessage = event.user_message as IntelligenceChatMessage | undefined;
            setConversation((current) => {
              const withoutPending = (current?.messages || []).filter(
                (item) => item.id !== pendingUser.id,
              );
              return {
                ...(current as IntelligenceConversation),
                id: Number(event.id || current?.id || 0),
                name: String(event.name || current?.name || "New chat"),
                messages:
                  regenerate || !userMessage
                    ? withoutPending
                    : [...withoutPending, userMessage],
              };
            });
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
    const created = await intelligenceDatasetApi.conversationCreate({
      dataset_id: focusedDatasetId || false,
    });
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

  async function startNewConversation() {
    const defaultId = readyDatasets.length === 1 ? readyDatasets[0].id : false;
    const created = await intelligenceDatasetApi.conversationCreate({
      dataset_id: defaultId,
    });
    setDatasetTouched(false);
    setConversation(created);
    setQuestion("");
    setError("");
    await refreshList();
  }

  async function copyMessage(message: IntelligenceChatMessage) {
    const rendered = document.querySelector(
      `[data-ask-copy="${message.id}"]`,
    ) as HTMLElement | null;
    const plain = (rendered?.innerText || message.content || "").replace(/\n{3,}/g, "\n\n").trim();
    try {
      const html = rendered?.innerHTML;
      if (html && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setCopiedId(message.id);
      } catch {
        setError("The reply could not be copied.");
      }
    }
  }

  function regenerateMessage(index: number) {
    const previous = [...messages.slice(0, index)]
      .reverse()
      .find((item) => item.role === "user");
    if (!previous?.content) {
      setError("There is no question to regenerate.");
      return;
    }
    void send(previous.content, { regenerate: true });
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
  const typedPlaceholder = useTypedPlaceholder(Boolean(question) || listening);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-[13px]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
            <img src={MASCOT} alt="" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900">AI Workspace</h1>
            <button
              type="button"
              className="group inline-flex max-w-full items-center gap-0.5 text-left text-[11px] text-slate-400 hover:text-slate-600"
              onClick={() => setIndexOpen(true)}
            >
              <span className="truncate">
                {indexed.toLocaleString()} indexed documents connected
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Close Ask AI"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => router.push("/pages/document-intelligence")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)_15rem]">
      <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
        <div className="shrink-0 px-3 pt-3">
          <div className="flex gap-4 text-[12px] font-semibold">
            <button
              type="button"
              className={tab === "recent" ? "text-slate-900" : "text-slate-400"}
              onClick={() => setTab("recent")}
            >
              <span className="inline-flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Recent
              </span>
              {tab === "recent" ? (
                <span className="mt-1.5 block h-0.5 rounded-full bg-brand-pink" />
              ) : (
                <span className="mt-1.5 block h-0.5" />
              )}
            </button>
            <button
              type="button"
              className={tab === "saved" ? "text-slate-900" : "text-slate-400"}
              onClick={() => setTab("saved")}
            >
              <span className="inline-flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                Saved Queries
              </span>
              {tab === "saved" ? (
                <span className="mt-1.5 block h-0.5 rounded-full bg-brand-pink" />
              ) : (
                <span className="mt-1.5 block h-0.5" />
              )}
            </button>
          </div>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-[#f7f8fb] py-1.5 pl-8 pr-2 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-pink/40 focus:bg-white"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
          {rows.length ? (
            <ul className="space-y-0.5">
              {rows.map((item) => (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    className={`w-full truncate rounded-xl py-2.5 pl-3 pr-9 text-left text-sm ${
                      conversation?.id === item.id
                        ? "bg-[#f7f8fb] font-medium text-slate-900"
                        : "text-slate-700 hover:bg-[#f7f8fb]"
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
            <div className="flex h-full flex-col items-center justify-center px-5 text-center">
              <Clock className="h-7 w-7 text-slate-200" />
              <p className="mt-2 text-[12px] leading-5 text-slate-400">
                Conversations will appear here after you run a query.
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0 p-3">
          <button
            type="button"
            className="w-full rounded-lg bg-brand-pink px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-text"
            onClick={() => void startNewConversation()}
          >
            + New Conversation
          </button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-white">
        {error ? (
          <div className="shrink-0 px-6 pt-4">
            <IntelligenceError message={error} />
          </div>
        ) : null}
        <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {hasThread ? (
            <div className="mx-auto max-w-[720px] space-y-5">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <article key={message.id} className="flex justify-end">
                    <div className="max-w-[72%] rounded-2xl bg-gradient-to-br from-brand-pink to-brand-text px-3.5 py-2 text-white shadow-sm">
                      <p className="whitespace-pre-wrap text-[13px] leading-5">{message.content}</p>
                      <p className="mt-1 text-right text-[10px] text-white/80">
                        {formatMessageTime(message.create_date)}
                      </p>
                    </div>
                  </article>
                ) : (
                  <article key={message.id} className="group">
                    <div className="flex items-start gap-2">
                      <img
                        src={MASCOT}
                        alt=""
                        className="mt-0.5 h-8 w-8 shrink-0 object-contain"
                      />
                      <div
                        data-ask-copy={message.id}
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-5 text-slate-800"
                      >
                        <ChatMarkdown text={message.content} />
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-10">
                      <span className="text-[11px] text-slate-400">
                        {formatMessageTime(message.create_date)}
                      </span>
                      {message.id > 0 ? (
                        <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-pink-200 hover:text-brand-text"
                            onClick={() => void copyMessage(message)}
                          >
                            <Copy className="h-3 w-3" />
                            {copiedId === message.id ? "Copied" : "Copy"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-pink-200 hover:text-brand-text disabled:opacity-40"
                            onClick={() => regenerateMessage(index)}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ),
              )}
              {thinking ? (
                <article className="flex items-start gap-2">
                  <img src={MASCOT} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
                  <p className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-400">
                    Thinking…
                  </p>
                </article>
              ) : null}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mx-auto flex min-h-full max-w-[720px] flex-col items-center py-2 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-brand-pink/20 blur-xl" />
                <img
                  src={MASCOT}
                  alt="Ask Cleon AI"
                  className="relative h-16 w-16 object-contain"
                />
              </div>
              <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900">
                Welcome to{" "}
                <span className="text-brand-pink">Ask Cleon AI</span>
              </h2>
              <p className="mt-1.5 max-w-md text-[12px] leading-5 text-slate-500">
                {conversation?.sources?.length
                  ? `This chat is focused on ${conversation.sources[0].name}. Approved datasets can still fill in extra context.`
                  : "Ask anything about your HR documents — contracts, employee files, certifications, and compliance records."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                      category === item
                        ? "bg-brand-pink text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-pink-200"
                    }`}
                    onClick={() => {
                      setCategory(item);
                      setShowAllSuggestions(false);
                    }}
                  >
                    {item === "All Suggestions" ? "✨ All Suggestions" : item}
                  </button>
                ))}
              </div>
              <div className="mt-5 w-full text-left">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">Suggested Questions</p>
                    <p className="text-[11px] text-slate-400">{visibleSuggestions.length} prompts</p>
                  </div>
                  {suggestions.length > 9 ? (
                    <button
                      type="button"
                      className="text-[12px] font-medium text-brand-pink"
                      onClick={() => setShowAllSuggestions((open) => !open)}
                    >
                      {showAllSuggestions ? "View less" : "View more →"}
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSuggestions.map((item) => (
                    <button
                      key={item.text}
                      type="button"
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-[12px] font-medium text-slate-700 hover:border-brand-pink"
                      onClick={() => send(item.text)}
                    >
                      <item.Icon className="h-3.5 w-3.5 shrink-0 text-brand-pink" />
                      <span className="min-w-0 flex-1 leading-4">{item.text}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          className="shrink-0 bg-white px-4 pb-3 pt-1"
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
          <div className="mx-auto max-w-[640px]">
            <div className="flex items-end gap-2">
            <div className="relative flex min-w-0 flex-1 items-end rounded-[1.4rem] border border-slate-200 bg-white px-1 py-0.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)] focus-within:border-brand-pink/40">
              <div className="relative" ref={attachRef}>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  aria-label={uploadingFiles.length ? "Uploading files" : "Attach a source"}
                  disabled={Boolean(uploadingFiles.length)}
                  onClick={() => setAttachOpen((open) => !open)}
                >
                  {uploadingFiles.length ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-pink" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
                {attachOpen ? (
                  <div className="absolute bottom-10 left-0 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload files from computer
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAttachOpen(false);
                        setUrlOpen(true);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Paste a URL
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                      onClick={async () => {
                        setAttachOpen(false);
                        setLibraryOpen(true);
                        setLibrarySelected([]);
                        setLibrarySearch("");
                        const library = await intelligenceDatasetApi.libraryDocuments();
                        setLibraryRows(library);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      From document library
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="relative min-h-8 min-w-0 flex-1">
                {!question ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center text-[13px] text-slate-400">
                    {typedPlaceholder}
                    {typedPlaceholder ? (
                      <span className="ml-px inline-block h-3.5 w-px bg-slate-300" />
                    ) : null}
                  </span>
                ) : null}
                <textarea
                  ref={composerRef}
                  rows={1}
                  className={`ask-composer-input max-h-[220px] min-h-8 w-full resize-none overflow-y-auto border-0 bg-transparent py-1.5 text-[13px] leading-5 text-slate-800 shadow-none outline-none ring-0 ${
                    question ? "" : "caret-transparent"
                  }`}
                  value={question}
                  maxLength={4000}
                  placeholder=""
                  aria-label="Ask Cleon AI"
                  onChange={(event) => setQuestion(event.target.value)}
                  onInput={fitComposer}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  listening ? "bg-brand-pink text-white" : "text-slate-400 hover:bg-slate-50"
                }`}
                aria-label="Speak your question"
                onClick={startVoice}
              >
                <Mic className="h-4 w-4" />
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
              <button
                type="submit"
                disabled={busy || Boolean(uploadingFiles.length) || !question.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-white disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Smarter Documents. Stronger Decisions. ✨ {question.length}/4000
            </p>
          </div>
        </form>
      </section>

      <aside className="hidden min-h-0 flex-col overflow-hidden border-l border-slate-100 bg-white lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Working Set
          </p>
          {!readyDatasets.length ? (
            <p className="mt-1.5 text-[12px] text-slate-500">
              No datasets are ready yet. Run an extraction to use one here.
            </p>
          ) : focusedDatasetId ? (
            <p className="mt-1.5 text-[12px] text-slate-600">
              Queries use <span className="font-semibold">{focusedDatasetName}</span>.
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-slate-600">
              Queries use <span className="font-semibold">all approved datasets</span>.
              Choose one to focus.
            </p>
          )}
          {readyDatasets.length ? (
            <select
              ref={datasetRef}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-[#f7f8fb] px-3 py-2.5 text-sm text-slate-800 outline-none"
              value={focusedDatasetId}
              onChange={async (event) => {
                const nextId = event.target.value ? Number(event.target.value) : "";
                setLocalDatasetId(nextId);
                setDatasetTouched(true);
                const current = await ensureConversation();
                const next = await intelligenceDatasetApi.conversationUpdate({
                  id: current.id,
                  dataset_id: nextId || 0,
                });
                setConversation({
                  ...next,
                  messages: current.messages || next.messages,
                });
              }}
            >
              {readyDatasets.length > 1 ? (
                <option value="">All approved datasets</option>
              ) : null}
              {readyDatasets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}

          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Attached files
          </p>
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
            <p className="mt-2 text-sm text-slate-400">
              Files you attach from your computer or the document library appear here.
            </p>
          )}
          {conversation?.id ? (
            <button
              type="button"
              className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
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
              {conversation.saved ? "Saved query" : "Save this query"}
            </button>
          ) : null}
        </div>
        <div className="shrink-0 p-3">
          <p className="text-right text-[10px] text-slate-400">Esc close · ↵ send</p>
        </div>
      </aside>
      </div>

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
      <AskIndexStatusPanel
        open={indexOpen}
        onClose={() => {
          setIndexOpen(false);
          void queryClient.invalidateQueries({
            queryKey: ["intelligence", "conversations"],
          });
        }}
      />
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

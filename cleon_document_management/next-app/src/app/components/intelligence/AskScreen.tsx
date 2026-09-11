"use client";

import {
  Bookmark,
  FileText,
  Link2,
  Mic,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
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
import SectionTabs from "../SectionTabs";
import ModalDialog from "../ModalDialog";

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
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const datasets = useIntelligenceDatasets();
  const list = useIntelligenceConversations(tab === "saved", search);
  const messages = conversation?.messages || [];
  const suggestions = SUGGESTIONS.filter(
    (item) => category === "All Suggestions" || item.category === category,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy, thinking, messages[messages.length - 1]?.content]);

  async function refreshList() {
    await queryClient.invalidateQueries({ queryKey: ["intelligence", "conversations"] });
  }

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
    await intelligenceDatasetApi.conversationDelete(id);
    if (conversation?.id === id) {
      setConversation(null);
    }
    await refreshList();
  }

  async function ensureConversation() {
    if (conversation?.id) {
      return conversation;
    }
    const created = await intelligenceDatasetApi.conversationCreate();
    setConversation(created);
    return created;
  }

  async function attachUpload(file: File) {
    setBusy(true);
    setError("");
    try {
      const current = await ensureConversation();
      const data = await fileToBase64(file);
      const next = await intelligenceDatasetApi.conversationAttachUpload({
        id: current.id,
        name: file.name,
        mimetype: file.type || "application/octet-stream",
        data,
      });
      setConversation(next);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The file could not be attached.");
    } finally {
      setBusy(false);
      setAttachOpen(false);
    }
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
  const rows = list.data?.conversations || [];

  return (
    <div className="grid rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[17.5rem_minmax(0,1fr)_15.5rem]">
      <aside className="flex flex-col border-b border-slate-100 bg-[#f7f7f8] lg:border-b-0 lg:border-r">
        <div className="p-3">
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
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
          <SectionTabs
            items={[
              { id: "recent", label: "Chats" },
              { id: "saved", label: "Saved" },
            ]}
            value={tab}
            onChange={setTab}
            className="mt-3 px-1 !w-auto"
            ariaLabel="Conversation lists"
          />
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
        <div className="flex-1 px-2 pb-3">
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
                    onClick={async (event) => {
                      event.stopPropagation();
                      await deleteChat(item.id);
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

      <section className="flex min-w-0 flex-col">
        {error ? (
          <div className="px-6 pt-4">
            <IntelligenceError message={error} />
          </div>
        ) : null}
        <div className="px-6 py-8">
          {messages.length || thinking ? (
            <div className="mx-auto max-h-[min(32rem,55vh)] max-w-3xl space-y-4 overflow-y-auto pr-1">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-3xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-12 bg-pink-50 text-slate-800"
                      : "mr-8 bg-slate-50 text-slate-800"
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
                <p className="mr-8 animate-pulse text-sm text-slate-400">Thinking…</p>
              ) : null}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <div className="h-28 w-28 overflow-hidden rounded-full bg-black shadow-lg ring-4 ring-slate-100">
                <img src={MASCOT} alt="Ask Cleon AI" className="h-full w-full object-cover" />
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
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
              <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
                {suggestions.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-sm font-semibold leading-6 text-slate-700 transition hover:border-brand-pink hover:bg-white hover:shadow-sm"
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
          className="border-t border-slate-100 px-6 py-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            send();
          }}
        >
          {conversation?.sources?.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {conversation.sources.map((source) => (
                <span
                  key={source.id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {source.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="relative flex items-end gap-2 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <div className="relative">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
                aria-label="Attach a source"
                onClick={() => setAttachOpen((open) => !open)}
              >
                <Plus className="h-5 w-5" />
              </button>
              {attachOpen ? (
                <div className="absolute bottom-12 left-0 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload from computer
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
              placeholder="Which contracts expire in the next 90 days?"
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
                listening ? "bg-brand-pink text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
              aria-label="Speak your question"
              onClick={startVoice}
            >
              <Mic className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  attachUpload(file);
                }
                event.target.value = "";
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{question.length}/4000</span>
            <span>Direct Answer mode</span>
          </div>
        </form>
      </section>

      <aside className="hidden flex-col border-l border-slate-100 bg-slate-50/70 p-5 lg:flex">
        <p className="text-sm font-bold text-slate-900">Quick Actions</p>
        <div className="mt-3 space-y-2">
          <Link
            href="/pages/document-intelligence/datasets"
            className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
          >
            Working Set
            <span className="mt-1 block text-xs font-normal text-slate-400">
              {conversation?.dataset || "No active dataset. Select one to focus queries."}
            </span>
          </Link>
          <select
            className="field"
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
              className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700"
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
        <div className="mt-6 overflow-hidden rounded-3xl bg-slate-900 p-5 text-white">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-black">
            <img src={MASCOT} alt="" className="h-full w-full object-cover" />
          </div>
          <p className="mt-4 text-center text-sm font-semibold leading-5">
            Smarter People. Stronger Organizations.
          </p>
        </div>
      </aside>

      {urlOpen ? (
        <ModalDialog
          title="Paste a URL"
          onClose={() => setUrlOpen(false)}
          size="md"
          zIndex={30}
          backdropClassName="bg-slate-900/40"
          titleClassName="text-base font-bold"
        >
          <input
            className="field"
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
        </ModalDialog>
      ) : null}

      {libraryOpen ? (
        <ModalDialog
          title="Document library"
          onClose={() => setLibraryOpen(false)}
          size="lg"
          zIndex={30}
          backdropClassName="bg-slate-900/40"
          titleClassName="text-base font-bold"
        >
          <input
            className="field"
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
          <ul className="mt-3 max-h-72 overflow-y-auto">
            {libraryRows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const current = await ensureConversation();
                      const next = await intelligenceDatasetApi.conversationAttachLibrary({
                        id: current.id,
                        document_id: item.id,
                      });
                      setConversation(next);
                      setLibraryOpen(false);
                      await refreshList();
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "The document could not be attached.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="block text-xs text-slate-400">
                    {item.document_type}
                    {item.employee ? ` · ${item.employee}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 text-sm text-slate-500"
            onClick={() => setLibraryOpen(false)}
          >
            Close
          </button>
        </ModalDialog>
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

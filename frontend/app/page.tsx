"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  FileTextIcon,
  SendIcon,
  UploadCloudIcon,
  SparklesIcon,
  BotIcon,
  UserIcon,
  BookOpenIcon,
  LayersIcon,
} from "./components/Icons";
import { MarkdownRenderer } from "./components/MarkdownRenderer";

interface Citation {
  id: number;
  document_id: number;
  page_number?: number;
  content_snippet: string;
}

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at?: string;
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface DocumentItem {
  id: number;
  title: string;
  filename: string;
  uploaded_at: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"history" | "documents">("history");
  
  // Track sessions that currently have requests running in background
  const [pendingSessionIds, setPendingSessionIds] = useState<number[]>([]);
  
  // Cache messages by session to preserve state across tab switches
  const sessionCacheRef = useRef<Record<number, Message[]>>({});
  const activeSessionIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isCurrentSessionLoading = activeSessionId ? pendingSessionIds.includes(activeSessionId) : false;

  useEffect(() => {
    scrollToBottom();
  }, [messages, isCurrentSessionLoading]);

  // Initial load
  useEffect(() => {
    fetchDocuments();
    fetchSessions(true);
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/documents/");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Error fetching documents:", e);
    }
  };

  const fetchSessions = async (autoSelectLatest = false) => {
    try {
      const res = await fetch("http://localhost:8000/chat/sessions");
      if (res.ok) {
        const data: ChatSession[] = await res.json();
        setSessions(data);

        if (autoSelectLatest && data.length > 0) {
          selectSession(data[0].id);
        } else if (data.length === 0) {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error("Error fetching sessions:", e);
    }
  };

  const selectSession = async (sessionId: number) => {
    setActiveSessionId(sessionId);
    
    // 1. Instantly display cached messages if available
    if (sessionCacheRef.current[sessionId]) {
      setMessages(sessionCacheRef.current[sessionId]);
    }

    // 2. Fetch latest messages from DB
    try {
      const res = await fetch(`http://localhost:8000/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        const freshMsgs: Message[] = data.messages || [];
        
        if (sessionCacheRef.current[sessionId] && sessionCacheRef.current[sessionId].length > freshMsgs.length) {
          if (activeSessionIdRef.current === sessionId) {
            setMessages(sessionCacheRef.current[sessionId]);
          }
        } else {
          sessionCacheRef.current[sessionId] = freshMsgs;
          if (activeSessionIdRef.current === sessionId) {
            setMessages(freshMsgs);
          }
        }
      }
    } catch (e) {
      console.error("Error loading session:", e);
    }
  };

  const createNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:8000/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        delete sessionCacheRef.current[sessionId];
        setPendingSessionIds((prev) => prev.filter((id) => id !== sessionId));
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setSessions(remaining);
        if (activeSessionId === sessionId) {
          if (remaining.length > 0) {
            selectSession(remaining[0].id);
          } else {
            setActiveSessionId(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const res = await fetch("http://localhost:8000/documents/", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
        setSidebarTab("documents");
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input;
    if (!textToSend.trim()) return;

    let targetSessionId = activeSessionId;

    if (!targetSessionId) {
      try {
        const cleanTitle = textToSend.trim().replace(/\n/g, " ").slice(0, 45);
        const createRes = await fetch("http://localhost:8000/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: cleanTitle }),
        });
        if (createRes.ok) {
          const newSession = await createRes.json();
          targetSessionId = newSession.id;
          setActiveSessionId(newSession.id);
          activeSessionIdRef.current = newSession.id;
        }
      } catch (err) {
        console.error("Failed to auto-create session:", err);
        return;
      }
    }

    if (!targetSessionId) return;

    const optimisticUserMessage: Message = {
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    const prevMsgs = sessionCacheRef.current[targetSessionId] || messages;
    const updatedMsgs = [...prevMsgs, optimisticUserMessage];
    sessionCacheRef.current[targetSessionId] = updatedMsgs;

    if (activeSessionIdRef.current === targetSessionId) {
      setMessages(updatedMsgs);
    }

    if (!overridePrompt) setInput("");
    setPendingSessionIds((prev) => [...prev, targetSessionId!]);

    try {
      const res = await fetch(`http://localhost:8000/chat/sessions/${targetSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          created_at: new Date().toISOString(),
        };

        const sessionMsgs = [...(sessionCacheRef.current[targetSessionId] || []), assistantMessage];
        sessionCacheRef.current[targetSessionId] = sessionMsgs;

        if (activeSessionIdRef.current === targetSessionId) {
          setMessages(sessionMsgs);
        }

        fetchSessions(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMsg: Message = {
          role: "assistant",
          content: `Server Error: ${errData.detail || "Unable to complete search request."}`,
        };
        const sessionMsgs = [...(sessionCacheRef.current[targetSessionId] || []), errorMsg];
        sessionCacheRef.current[targetSessionId] = sessionMsgs;
        if (activeSessionIdRef.current === targetSessionId) {
          setMessages(sessionMsgs);
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const networkErrorMsg: Message = {
        role: "assistant",
        content: "Connection failed. Please ensure the backend server is active at localhost:8000.",
      };
      const sessionMsgs = [...(sessionCacheRef.current[targetSessionId] || []), networkErrorMsg];
      sessionCacheRef.current[targetSessionId] = sessionMsgs;
      if (activeSessionIdRef.current === targetSessionId) {
        setMessages(sessionMsgs);
      }
    } finally {
      setPendingSessionIds((prev) => prev.filter((id) => id !== targetSessionId));
    }
  };

  const activeSessionTitle =
    sessions.find((s) => s.id === activeSessionId)?.title || "Research Workspace";

  return (
    <div className="flex h-screen bg-[#212121] text-zinc-100 font-sans overflow-hidden antialiased selection:bg-zinc-700">
      {/* Sidebar (ChatGPT Dark #171717) */}
      <aside className="w-64 sm:w-72 bg-[#171717] border-r border-zinc-800/80 flex flex-col justify-between select-none">
        {/* Workspace Brand Header */}
        <div className="p-3.5 border-b border-zinc-800/80">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <LayersIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
                  Research Desk
                </h1>
                <p className="text-[11px] font-mono text-zinc-500">RAG ENGINE v1.0</p>
              </div>
            </div>
          </div>

          {/* New Chat Primary Button */}
          <button
            onClick={createNewSession}
            className="w-full flex items-center justify-between py-2 px-3 rounded-lg border border-zinc-700/70 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <PlusIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>New chat</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+K</span>
          </button>
        </div>

        {/* Sidebar Nav Tabs */}
        <div className="flex border-b border-zinc-800/80 px-2 pt-2 bg-[#171717]">
          <button
            onClick={() => setSidebarTab("history")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              sidebarTab === "history"
                ? "border-zinc-200 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MessageSquareIcon className="w-3.5 h-3.5" />
            <span>Conversations</span>
          </button>
          <button
            onClick={() => setSidebarTab("documents")}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              sidebarTab === "documents"
                ? "border-zinc-200 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpenIcon className="w-3.5 h-3.5" />
            <span>Docs ({documents.length})</span>
          </button>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
          {sidebarTab === "history" ? (
            sessions.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-zinc-500">No conversations yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Start a chat to see history.</p>
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isSessionPending = pendingSessionIds.includes(session.id);

                return (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-white font-medium"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden pr-2 flex-1">
                      {isSessionPending ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse shrink-0" />
                      ) : (
                        <MessageSquareIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-zinc-200" : "text-zinc-500 group-hover:text-zinc-400"
                          }`}
                        />
                      )}
                      <span className="truncate">{session.title}</span>
                    </div>

                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete thread"
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 p-1 rounded transition-opacity"
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )
          ) : (
            <div>
              {documents.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-xs text-zinc-500">No documents indexed.</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Upload a PDF below to begin.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-800 text-xs transition-colors"
                    >
                      <FileTextIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <div className="overflow-hidden flex-1">
                        <p className="font-medium text-zinc-200 truncate">{doc.title}</p>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          ID: {doc.id} • pgvector
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Action Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#171717]">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            onChange={handleUpload}
            disabled={isUploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border border-zinc-700/70 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <UploadCloudIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>{isUploading ? "Ingesting..." : "Upload PDF"}</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area (ChatGPT Dark #212121) */}
      <main className="flex-1 flex flex-col h-full bg-[#212121] relative">
        {/* Top Header */}
        <header className="h-12 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-[#212121]/90 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Thread
            </span>
            <span className="text-xs text-zinc-600">/</span>
            <span className="text-sm font-medium text-zinc-200 truncate max-w-xl">
              {activeSessionTitle}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
              <span>{documents.length} Source Document{documents.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {messages.length === 0 && !isCurrentSessionLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 mb-4">
                <SparklesIcon className="w-5 h-5" />
              </div>

              <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">
                Research Desk
              </h2>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-md">
                Grounded research assistant powered by PostgreSQL vector embeddings and reranked citations.
              </p>

              {/* Quick Prompt Starters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-8">
                {[
                  "What are the core technical definitions explained here?",
                  "Synthesize the key conclusions from the documents",
                  "Compare the methodologies or approaches covered",
                  "Explain any formulas or mathematical derivations",
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-3 rounded-xl bg-[#2a2a2a] hover:bg-[#303030] border border-zinc-700/60 hover:border-zinc-600 text-xs text-zinc-300 transition-colors cursor-pointer group"
                  >
                    <span className="font-mono text-[10px] text-zinc-500 block mb-1">
                      EXAMPLE {i + 1}
                    </span>
                    <span className="group-hover:text-white transition-colors">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-3.5 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
                      <BotIcon className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`${
                      msg.role === "user"
                        ? "bg-[#2f2f2f] text-white rounded-3xl px-4 py-3 max-w-xl text-sm leading-relaxed border border-zinc-700/50 shadow-sm"
                        : "text-zinc-200 max-w-2xl text-sm leading-relaxed flex-1"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}

                    {/* Citations Container */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-zinc-800">
                        <div className="flex items-center space-x-1.5 mb-2">
                          <BookOpenIcon className="w-3 h-3 text-zinc-400" />
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                            Sources
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, i) => (
                            <div key={i} className="group relative">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-[10px] font-mono text-zinc-300 hover:text-white hover:border-zinc-500 cursor-pointer transition-colors">
                                <span>[{i + 1}]</span>
                                <span>Doc {c.document_id}</span>
                                <span>•</span>
                                <span>p.{c.page_number || "N/A"}</span>
                              </span>

                              {/* Hover snippet preview */}
                              <div className="absolute bottom-full left-0 mb-2 w-80 p-3 bg-[#181818] border border-zinc-700 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
                                <p className="text-[10px] font-mono uppercase text-zinc-400 mb-1">
                                  Source Excerpt (Chunk #{c.id})
                                </p>
                                <p className="text-xs text-zinc-300 leading-relaxed italic">
                                  "{c.content_snippet}"
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isCurrentSessionLoading && (
                <div className="flex items-start space-x-3.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 shrink-0 mt-0.5">
                    <BotIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center space-x-2 text-zinc-400 text-xs py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></span>
                    <span>Searching documents & generating answer...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Query Input Bar (ChatGPT Style Floating Pill) */}
        <div className="p-4 bg-[#212121]">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-center bg-[#2f2f2f] border border-zinc-700/60 rounded-3xl p-1.5 focus-within:border-zinc-500 transition-colors shadow-sm">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask a question about your documents..."
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-400 py-2.5 px-4 focus:outline-none"
              />

              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  input.trim()
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                }`}
              >
                <SendIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-center text-[11px] text-zinc-500 mt-2">
              <span>AI can make mistakes. Verify information using source citations.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
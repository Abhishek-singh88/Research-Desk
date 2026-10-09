"use client";

import React, { useState, useEffect } from "react";

export default function Home() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/documents/");
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      await fetch("http://localhost:8000/documents/", {
        method: "POST",
        body: formData,
      });
      fetchDocuments();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch("http://localhost:8000/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input, history }),
      });
      
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations }
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to server. Make sure the backend is running." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-neutral-950 border-r border-neutral-800 p-4 flex flex-col">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-8">
          Research Desk
        </h1>
        
        <div className="flex-1 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">Knowledge Base</h2>
          {documents.length === 0 ? (
            <p className="text-neutral-500 text-sm">No documents yet.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc: any) => (
                <li key={doc.id} className="text-sm text-neutral-300 truncate p-2 hover:bg-neutral-800 rounded-md cursor-pointer transition-colors">
                  📄 {doc.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-800">
          <label className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors shadow-lg shadow-blue-900/20">
            {isUploading ? "Uploading..." : "Upload PDF"}
            <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 border border-blue-800/50">
              <span className="text-2xl">🧠</span>
            </div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to Research Desk</h2>
            <p className="text-neutral-400 max-w-md">
              Upload your research papers on the left, then ask questions. The AI will retrieve the exact paragraphs and synthesize an answer with citations.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl rounded-2xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-200 border border-neutral-700'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-700/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((c: any, i: number) => (
                          <div key={i} className="group relative">
                            <span className="inline-block px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-400 cursor-help hover:text-blue-400 hover:border-blue-500 transition-colors">
                              [{i + 1}] Doc {c.document_id}, pg {c.page_number || "?"}
                            </span>
                            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                              <p className="text-xs text-neutral-300 leading-relaxed italic">"{c.content_snippet}"</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask a question about your documents..."
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-neutral-500 shadow-inner"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
          <p className="text-center text-xs text-neutral-500 mt-3">
            AI can make mistakes. Verify information using the provided citations.
          </p>
        </div>
      </div>
    </div>
  );
}
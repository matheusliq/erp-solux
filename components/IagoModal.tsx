"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: string; // ISO string (JSON-serializable)
}

interface IagoModalProps {
    open: boolean;
    onClose: () => void;
    context?: Record<string, any>;
    pageTitle?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "iago_history";
const MAX_HISTORY = 20; // sliding window sent to the API

const QUICK_ACTIONS = [
    "Como está meu saldo atual?",
    "Tenho lançamentos atrasados?",
    "Me dê uma projeção pros próximos 3 meses",
    "Crie um lançamento para mim",
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadHistory(): Message[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
        return [];
    }
}

function saveHistory(msgs: Message[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
    } catch { /* quota exceeded — ignore */ }
}

// ─── Greeting ────────────────────────────────────────────────────────────────
function greeting(pageTitle?: string) {
    return `Olá! Sou o **Iago** 👋\n${pageTitle ? `Estou olhando os dados do **${pageTitle}**.\n` : ""}Como posso ajudar?`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function IagoModal({ open, onClose, context, pageTitle }: IagoModalProps) {
    // Full history stored in localStorage (persist between sessions)
    const [history, setHistory] = useState<Message[]>([]);
    // What's displayed in the current session (visual only)
    const [displayed, setDisplayed] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load history from localStorage when the modal first opens
    useEffect(() => {
        if (!open) return;
        const stored = loadHistory();
        setHistory(stored);
        // Show last MAX_HISTORY messages as the visual session
        setDisplayed(
            stored.length > 0
                ? stored.slice(-MAX_HISTORY)
                : [{ role: "assistant", content: greeting(pageTitle), timestamp: new Date().toISOString() }]
        );
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayed, loading]);

    // ── Send message ───────────────────────────────────────────────────────────
    const sendMessage = async (content: string) => {
        if (!content.trim() || loading) return;
        setInput("");

        const userMsg: Message = { role: "user", content: content.trim(), timestamp: new Date().toISOString() };

        // Update history + displayed optimistically
        const newHistory = [...history, userMsg];
        const newDisplayed = [...displayed, userMsg];
        setHistory(newHistory);
        setDisplayed(newDisplayed);
        setLoading(true);

        try {
            // Send last MAX_HISTORY messages as context window
            const contextWindow = newHistory.slice(-MAX_HISTORY);

            const res = await fetch("/api/iago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: contextWindow.map((m) => ({ role: m.role, content: m.content })),
                    context,
                }),
            });

            const data = await res.json();
            const replyText = res.ok
                ? (data.text || "Não consegui processar sua solicitação.")
                : (data.error || "⚠️ Erro ao conectar com o Iago. Tente novamente.");

            if (data?.dataChanged && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("iago_data_changed"));
            }

            const assistantMsg: Message = {
                role: "assistant",
                content: replyText,
                timestamp: new Date().toISOString(),
            };

            const finalHistory = [...newHistory, assistantMsg];
            setHistory(finalHistory);
            setDisplayed((prev) => [...prev, assistantMsg]);
            saveHistory(finalHistory);
        } catch {
            const errMsg: Message = {
                role: "assistant",
                content: "⚠️ Erro de conexão. Verifique sua internet e tente novamente.",
                timestamp: new Date().toISOString(),
            };
            setDisplayed((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    // ── Restart: clears visual session but keeps localStorage history ──────────
    const restartConversation = () => {
        const freshGreeting: Message = {
            role: "assistant",
            content: greeting(pageTitle),
            timestamp: new Date().toISOString(),
        };
        setDisplayed([freshGreeting]);
        // NOTE: history in localStorage is intentionally kept
        // so the API still has context from past interactions
    };

    if (!open) return null;

    const showQuickActions = displayed.length === 1 && displayed[0].role === "assistant";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

            {/* Chat window */}
            <div className="relative w-[full] sm:w-[420px] h-[85vh] max-h-[580px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <span className="text-white text-xs font-black">I</span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">Iago</p>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
                            <Sparkles size={9} className="text-blue-400 shrink-0" />
                            {pageTitle ? `Analisando ${pageTitle}` : "Assistente financeiro"}
                        </p>
                    </div>
                    {/* Restart button */}
                    <button
                        onClick={restartConversation}
                        title="Reiniciar conversa (mantém memória)"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                    >
                        <RotateCcw size={13} />
                    </button>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                        <X size={15} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Quick actions when only greeting shown */}
                    {showQuickActions && (
                        <div className="grid grid-cols-1 gap-1.5 mt-1 mb-2">
                            {QUICK_ACTIONS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => sendMessage(q)}
                                    className="flex items-center gap-2 text-left text-xs text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 transition-all group"
                                >
                                    <ChevronRight size={11} className="text-blue-500 shrink-0" />
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {displayed.map((msg, i) => {
                        const isUser = msg.role === "user";
                        return (
                            <div key={i} className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${isUser ? "bg-[#0056b3] text-white rounded-tr-sm" : "bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm"}`}>
                                    {isUser ? (
                                        <p>{msg.content}</p>
                                    ) : (
                                        <div className="prose prose-invert prose-xs max-w-none">
                                            <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {loading && (
                        <div className="flex gap-2">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl rounded-tl-sm px-3 py-2">
                                <div className="flex gap-1 items-center h-3">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Memory indicator */}
                {history.length > 0 && (
                    <div className="px-4 py-1 text-[9px] text-zinc-600 border-t border-zinc-800/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 inline-block" />
                        {history.length} msg{history.length !== 1 ? "s" : ""} na memória · janela de {Math.min(history.length, MAX_HISTORY)}
                    </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-blue-500/50 transition-colors">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(input); } }}
                            placeholder="Pergunte, crie ou analise..."
                            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
                        />
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || loading}
                            className="w-7 h-7 rounded-lg bg-[#0056b3] hover:bg-[#004494] disabled:opacity-40 flex items-center justify-center text-white transition-all"
                        >
                            {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useRef, useEffect } from "react";
import {
    Bot, Send, Loader2, Sparkles, TrendingUp, AlertTriangle,
    DollarSign, BarChart2, RefreshCw, ChevronRight
} from "lucide-react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

// ─── Types ─────────────────────────────────────────────────────────────────
interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const QUICK_ACTIONS = [
    { icon: TrendingUp, label: "Analise meu fluxo de caixa", color: "text-emerald-400" },
    { icon: AlertTriangle, label: "Tenho lançamentos atrasados?", color: "text-amber-400" },
    { icon: DollarSign, label: "Como está meu saldo líquido?", color: "text-blue-400" },
    { icon: BarChart2, label: "Compare real vs planejado", color: "text-purple-400" },
];

function MessageBubble({ msg }: { msg: Message }) {
    const isUser = msg.role === "user";
    return (
        <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
            {/* Avatar */}
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <span className="text-white text-xs font-black">I</span>
                </div>
            )}
            {isUser && (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                    <span className="text-zinc-300 text-xs font-bold">V</span>
                </div>
            )}

            {/* Bubble */}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isUser
                ? "bg-[#0056b3] text-white rounded-tr-sm shadow-lg shadow-blue-500/10"
                : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm"
                }`}>
                {isUser ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : (
                    <div className="text-sm leading-relaxed">
                        <SimpleMarkdown>{msg.content}</SimpleMarkdown>
                    </div>
                )}
                <p suppressHydrationWarning className={`text-[9px] mt-1.5 ${isUser ? "text-blue-200" : "text-zinc-600"} text-right`}>
                    {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">I</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}

const STORAGE_KEY = "iago_history";
const MAX_HISTORY = 20;

function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as { role: "user" | "assistant"; content: string; timestamp: string }[] : [];
    } catch { return []; }
}
function saveHistory(msgs: { role: "user" | "assistant"; content: string; timestamp: string }[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch { }
}

export default function IagoPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load persisted history on mount
    useEffect(() => {
        const stored = loadHistory();
        if (stored.length > 0) {
            setMessages(stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
        } else {
            setMessages([{
                role: "assistant",
                content: "Olá! Sou o **Iago**, seu assistente financeiro do Solux Finance OS.\n\nEstou pronto para ajudar você a analisar seus dados financeiros, entender seu fluxo de caixa, comparar real vs planejado e muito mais.\n\nO que você gostaria de saber hoje?",
                timestamp: new Date(),
            }]);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const sendMessage = async (content: string) => {
        if (!content.trim() || loading) return;
        setInput("");

        const userMsg: Message = { role: "user", content: content.trim(), timestamp: new Date() };
        const history = [...messages, userMsg];
        setMessages(history);
        setLoading(true);

        try {
            // Use last MAX_HISTORY messages as context window
            const contextWindow = history.slice(-MAX_HISTORY);
            const res = await fetch("/api/iago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: contextWindow.map((m) => ({ role: m.role, content: m.content })),
                }),
            });
            const data = await res.json();
            const assistantMsg: Message = {
                role: "assistant",
                content: data.text || data.error || "Erro ao processar resposta.",
                timestamp: new Date(),
            };
            const finalHistory = [...history, assistantMsg];
            setMessages(finalHistory);
            // Persist to localStorage so IagoModal shares the same history
            saveHistory(finalHistory.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })));
            if (data?.dataChanged && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("iago_data_changed"));
            }
        } catch {
            setMessages([...history, {
                role: "assistant",
                content: "⚠️ Erro de conexão. Verifique sua internet e tente novamente.",
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const clearChat = () => {
        const freshMsg: Message = {
            role: "assistant",
            content: "Conversa reiniciada. Como posso ajudar?",
            timestamp: new Date(),
        };
        setMessages([freshMsg]);
        saveHistory([{ ...freshMsg, timestamp: freshMsg.timestamp.toISOString() }]);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-white">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <span className="text-white text-lg font-black">I</span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Iago</h1>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Sparkles size={10} className="text-blue-400" /> Assistente financeiro com IA · Gemini 1.5 Flash
                        </p>
                    </div>
                </div>
                <button
                    onClick={clearChat}
                    className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <RefreshCw size={12} /> Nova conversa
                </button>
            </div>

            {/* ── Messages ───────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
                {messages.length === 1 && (
                    <div className="mb-8">
                        <p className="text-xs text-zinc-600 text-center mb-4 uppercase tracking-widest font-semibold">Ações rápidas</p>
                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.map((a) => (
                                <button
                                    key={a.label}
                                    onClick={() => sendMessage(a.label)}
                                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 text-left transition-all group hover:bg-zinc-800/50"
                                >
                                    <a.icon size={16} className={`shrink-0 ${a.color}`} />
                                    <span className="text-xs text-zinc-300 font-medium leading-tight">{a.label}</span>
                                    <ChevronRight size={12} className="text-zinc-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} />
                ))}
                {loading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ──────────────────────────────────────────────────── */}
            <div className="px-8 py-5 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
                <div className="flex items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 focus-within:border-blue-500/50 transition-colors">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte sobre suas finanças... (Enter para enviar)"
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none py-1 max-h-32"
                        style={{ height: "auto" }}
                        onInput={(e) => {
                            const t = e.target as HTMLTextAreaElement;
                            t.style.height = "auto";
                            t.style.height = Math.min(t.scrollHeight, 128) + "px";
                        }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        className="w-9 h-9 rounded-xl bg-[#0056b3] hover:bg-[#004494] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shrink-0 shadow-[0_0_15px_rgba(0,86,179,0.3)]"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
                <p className="text-[10px] text-zinc-700 text-center mt-2">Iago pode cometer erros · Sempre verifique informações importantes</p>
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search, FileText, X, Loader2, Activity,
    ArrowRight, ShieldCheck, Calendar, SlidersHorizontal, Copy, Check
} from "lucide-react";
import { getAuditLogs } from "@/app/actions/auditoria";

// Extract entity name from audit details
const getEntityName = (entry: AuditEntry) => {
    const d = entry.details;
    return d?.new?.name || d?.old?.name || entry.entity_type;
};

interface AuditEntry {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: any;
    created_at: string | null;
    created_by_name: string;
}

const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return "—";
    if (key === "amount" && typeof value === "number")
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (key === "due_date" && typeof value === "string")
        return new Date(value + "T12:00:00").toLocaleDateString("pt-BR");
    return String(value);
};

// Copy to clipboard component (PIX-style)
function CopyUUID({ uuid }: { uuid: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(uuid).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">ID da Entidade</p>
            <div className="flex items-center gap-2">
                <p className="text-[11px] font-mono text-blue-400 select-all break-all flex-1">{uuid}</p>
                <button
                    onClick={copy}
                    title="Copiar ID"
                    className={[
                        "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all",
                        copied
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600",
                    ].join(" ")}
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
            </div>
            {copied && <p className="text-[9px] text-emerald-400 mt-1.5 font-bold">✓ Copiado!</p>}
        </div>
    );
}

const ACTION_STYLES: Record<string, string> = {

    "Criação": "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20",
    "Criação (histórico)": "text-zinc-400 bg-zinc-800/60 border border-zinc-700/40",
    "Atualização": "text-blue-400 bg-blue-500/15 border border-blue-500/20",
    "Exclusão": "text-rose-400 bg-rose-500/15 border border-rose-500/20",
};

const getActionStyle = (action: string) =>
    ACTION_STYLES[action] ?? "text-zinc-400 bg-zinc-800/60 border border-zinc-700/40";

export default function AuditoriaPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [filterAction, setFilterAction] = useState("todos");
    const [selected, setSelected] = useState<AuditEntry | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const res = await getAuditLogs({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            search: search || undefined,
        });
        if (res.success) setEntries(res.data as AuditEntry[]);
        setLoading(false);
    }, [startDate, endDate, search]);

    useEffect(() => {
        const t = setTimeout(() => loadData(), 300);
        return () => clearTimeout(t);
    }, [loadData]);

    const filtered = entries.filter((e) =>
        filterAction === "todos" ? true : e.action === filterAction
    );

    const hasFilters = startDate || endDate || search || filterAction !== "todos";

    const ACTION_PILLS = [
        { value: "todos", label: "Todas" },
        { value: "Criação", label: "Criações" },
        { value: "Atualização", label: "Atualizações" },
        { value: "Exclusão", label: "Exclusões" },
    ];

    return (
        <div className="flex h-full bg-zinc-950 text-white font-sans">
            {/* ── Main content ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Header */}
                <div className="px-8 pt-7 pb-5 border-b border-zinc-800/60 bg-zinc-950">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                Auditoria <span className="text-blue-500 font-light">Geral</span>
                            </h1>
                            <p className="text-xs text-zinc-500 mt-0.5">Histórico detalhado de alterações no sistema</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
                            <ShieldCheck size={12} className="text-blue-500" />
                            {filtered.length} registros
                        </div>
                    </div>

                    {/* Filters row */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[220px] max-w-xs">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por ID da entidade..."
                                className="w-full h-9 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Date range */}
                        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 h-9">
                            <Calendar size={12} className="text-zinc-500 shrink-0" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-xs bg-transparent text-zinc-400 focus:outline-none w-[110px] [color-scheme:dark]"
                            />
                            <span className="text-zinc-700 text-xs">→</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-xs bg-transparent text-zinc-400 focus:outline-none w-[110px] [color-scheme:dark]"
                            />
                        </div>

                        {/* Action pills */}
                        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                            {ACTION_PILLS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilterAction(opt.value)}
                                    className={[
                                        "h-7 px-3 rounded-md text-[11px] font-bold transition-all",
                                        filterAction === opt.value
                                            ? "bg-blue-600 text-white shadow"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    ].join(" ")}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Clear */}
                        {hasFilters && (
                            <button
                                onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); setFilterAction("todos"); }}
                                className="h-9 w-9 flex items-center justify-center text-zinc-500 hover:text-zinc-200 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[180px_130px_minmax(0,1fr)_150px_130px] text-[9px] font-black text-zinc-600 uppercase tracking-widest px-8 py-3 border-b border-zinc-800/60 bg-zinc-950 shrink-0">
                    <span className="flex items-center gap-1.5"><SlidersHorizontal size={10} /> Ação</span>
                    <span>Tipo</span>
                    <span>ID Instância</span>
                    <span className="flex items-center gap-1.5"><User size={10} /> Usuário</span>
                    <span className="flex items-center gap-1.5"><Calendar size={10} /> Data/Hora</span>
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-zinc-600 gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Carregando...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-zinc-700 gap-3">
                            <Activity size={32} />
                            <p className="text-sm font-medium">Nenhum log encontrado</p>
                            <p className="text-xs text-zinc-700">Tente ajustar os filtros</p>
                        </div>
                    ) : (
                        filtered.map((entry) => {
                            const isSelected = selected?.id === entry.id;
                            return (
                                <button
                                    key={entry.id}
                                    onClick={() => setSelected(isSelected ? null : entry)}
                                    className={[
                                        "w-full grid grid-cols-[180px_130px_minmax(0,1fr)_150px_130px] items-center px-8 py-3.5 text-left transition-all border-b border-zinc-800/30 group",
                                        isSelected
                                            ? "bg-blue-500/8 border-l-2 border-l-blue-500"
                                            : "hover:bg-zinc-900/40 border-l-2 border-l-transparent",
                                    ].join(" ")}
                                >
                                    <div>
                                        <span className={["text-[10px] font-bold px-2.5 py-1 rounded-full", getActionStyle(entry.action)].join(" ")}>
                                            {entry.action}
                                        </span>
                                    </div>
                                    <span className="text-sm text-zinc-300 font-semibold truncate pr-2" title={getEntityName(entry)}>{getEntityName(entry)}</span>
                                    <span className="text-[11px] text-zinc-600 font-mono truncate pr-4">{entry.entity_id}</span>
                                    <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-500 shrink-0">
                                            {entry.created_by_name?.[0]?.toUpperCase() || "S"}
                                        </span>
                                        {entry.created_by_name}
                                    </span>
                                    <span className="text-xs text-zinc-500">{fmtDateTime(entry.created_at)}</span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-2.5 border-t border-zinc-800/60 bg-zinc-950 text-[10px] text-zinc-600 flex items-center gap-2 shrink-0">
                    <Activity size={10} />
                    <span>{filtered.length} de {entries.length} registros exibidos</span>
                </div>
            </div>

            {/* ── Detail panel ─────────────────────────────────────────── */}
            {selected && (
                <div className="w-[400px] shrink-0 border-l border-zinc-800/60 bg-[#0d0f12] flex flex-col overflow-hidden">
                    {/* Panel header */}
                    <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-400" />
                            <p className="text-sm font-bold text-zinc-100">Detalhes da Ação</p>
                        </div>
                        <button
                            onClick={() => setSelected(null)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Panel body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Meta */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5">
                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Ação</p>
                                <span className={["text-[11px] font-bold px-2.5 py-1 rounded-full", getActionStyle(selected.action)].join(" ")}>
                                    {selected.action}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Tipo</p>
                                    <p className="text-sm font-semibold text-zinc-200">{selected.entity_type}</p>
                                </div>
                                <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Usuário</p>
                                    <p className="text-sm font-semibold text-zinc-200">{selected.created_by_name}</p>
                                </div>
                            </div>
                            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5">
                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">Data / Hora</p>
                                <p className="text-sm font-semibold text-zinc-200">{fmtDateTime(selected.created_at)}</p>
                            </div>
                            <CopyUUID uuid={selected.entity_id} />
                        </div>

                        {/* Changes */}
                        <div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <FileText size={10} /> Campos Alterados
                            </p>
                            <div className="space-y-2">
                                {Object.entries(selected.details || {}).map(([key, value]: [string, any]) => {
                                    // "new" or "old" top-level blocks
                                    if (key === "new" || key === "old" || key === "note") {
                                        if (key === "note") return null;
                                        return (
                                            <div key={key} className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-3.5">
                                                <p className="text-[9px] font-black text-zinc-600 uppercase mb-2">
                                                    {key === "new" ? "✦ Dados Registrados" : "✦ Dados Anteriores"}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {Object.entries(value || {}).map(([k, v]: [string, any]) => (
                                                        <div key={k} className="flex items-start gap-2">
                                                            <span className="text-[10px] font-mono text-zinc-600 min-w-[90px]">{k}</span>
                                                            <span className="text-[10px] font-mono text-zinc-300 break-all">{formatValue(k, v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // diff object { old, new }
                                    const isChange = typeof value === "object" && value !== null && "old" in value && "new" in value;
                                    if (isChange) {
                                        return (
                                            <div key={key} className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-3.5">
                                                <p className="text-[10px] font-bold text-blue-400 font-mono mb-2">{key}</p>
                                                <div className="grid grid-cols-[1fr_20px_1fr] gap-1 items-center">
                                                    <div className="text-[11px] font-mono text-rose-400 bg-rose-500/5 rounded px-2 py-1 break-all">{formatValue(key, value.old)}</div>
                                                    <ArrowRight size={11} className="text-zinc-600 justify-self-center" />
                                                    <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/5 rounded px-2 py-1 break-all">{formatValue(key, value.new)}</div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
    Download, Plus, Filter, X, Search,
    ArrowUpCircle, ArrowDownCircle, Receipt, Wallet,
    Pencil, Trash2, Info, CalendarDays, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    getRealTransactions, deleteTransaction
} from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categorias";
import { getProjects } from "@/app/actions/projetos";

// Lazy-loaded modals — only bundled/parsed when first opened
const TransactionModal = lazy(() => import("@/components/TransactionModal"));
const IagoModal = lazy(() => import("@/components/IagoModal"));

const ModalFallback = () => (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-400" size={28} />
    </div>
);

// ─── Transaction type ─────────────────────────────────────────────────────────
interface Transaction {
    id: string;
    name: string;
    amount: number;
    type: string;
    status: string;
    due_date: string;
    notes: string | null;
    categories: { id: string; name: string; color: string; type: string } | null;
    entities: { name: string } | null;
}
interface Category { id: string; name: string; color: string; type: string }

const TAX_MARKER = "[IMPOSTO]";
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

// ─── helpers ─────────────────────────────────────────────────────────────────
const getDefaultStart = () => "";
const getDefaultEnd = () => "";

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, count, color, icon: Icon, iconColor }: {
    label: string; value: number; count: number;
    color: string; icon: React.ElementType; iconColor: string;
}) {
    return (
        <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-3 overflow-hidden">
            <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${iconColor.replace("text-", "bg-")}`} />
            <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                <Icon size={16} className={iconColor} />
            </div>
            <p className={`text-2xl font-extrabold tracking-tight ${color}`}>{formatBRL(value)}</p>
            <div className="text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {count} lançamento{count !== 1 ? "s" : ""}
                </span>
            </div>
        </div>
    );
}

// remove inline TransactionModal — now in /components/TransactionModal.tsx

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Filters — lazy initialization to avoid stale closure ─────────────────
    const [filterType, setFilterType] = useState("todos");
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterCategoryId, setFilterCategoryId] = useState("todas");
    const [filterStartDate, setFilterStartDate] = useState<string>(getDefaultStart);
    const [filterEndDate, setFilterEndDate] = useState<string>(getDefaultEnd);
    const [showPeriod, setShowPeriod] = useState(false);
    const [search, setSearch] = useState("");

    // ── Modals ───────────────────────────────────────────────────────────────
    const [txModalOpen, setTxModalOpen] = useState(false);
    const [iagoOpen, setIagoOpen] = useState(false);
    const [editTx, setEditTx] = useState<Transaction | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [txRes, catRes, projRes] = await Promise.all([
                getRealTransactions(filterStartDate || undefined, filterEndDate || undefined),
                getCategories(),
                getProjects(),
            ]);
            if (txRes.success) setTransactions((txRes.data || []) as Transaction[]);
            if (catRes.success) setCategories((catRes.data || []) as Category[]);
            if (projRes.success) setProjects(projRes.data || []);
        } catch (err) {
            console.error("loadData error:", err);
        } finally {
            setLoading(false);
        }
    }, [filterStartDate, filterEndDate]);

    useEffect(() => {
        loadData();
        const handleRefresh = () => loadData();
        window.addEventListener("iago_data_changed", handleRefresh);
        return () => window.removeEventListener("iago_data_changed", handleRefresh);
    }, [loadData]);

    // ── Summaries ─────────────────────────────────────────────────────────────
    const entradas = transactions.filter(t => t.type === "Entrada");
    const saidas = transactions.filter(t => t.type !== "Entrada");
    const impostos = saidas.filter(t => t.notes?.includes(TAX_MARKER));

    const totalEntradas = entradas.reduce((a, t) => a + t.amount, 0);
    const totalSaidas = saidas.reduce((a, t) => a + t.amount, 0);
    const totalImpostos = impostos.reduce((a, t) => a + t.amount, 0);
    const saldoLiquido = totalEntradas - totalSaidas;

    // ── Filter count ──────────────────────────────────────────────────────────
    const activeFilters = [
        filterType !== "todos",
        filterStatus !== "todos",
        filterCategoryId !== "todas",
    ].filter(Boolean).length;

    const clearFilters = () => {
        setFilterType("todos");
        setFilterStatus("todos");
        setFilterCategoryId("todas");
    };

    // ── Filtered table rows ───────────────────────────────────────────────────
    const filtered = transactions.filter(t => {
        if (!t.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterType === "entrada" && t.type !== "Entrada") return false;
        if (filterType === "saida" && t.type === "Entrada") return false;
        if (filterStatus !== "todos" && t.status !== filterStatus) return false;
        if (filterCategoryId !== "todas" && t.categories?.id !== filterCategoryId) return false;
        return true;
    });

    // ── Iago context ──────────────────────────────────────────────────────────
    const iagoContext = {
        periodo: `${fmtDate(filterStartDate)} a ${fmtDate(filterEndDate)}`,
        totalEntradas: formatBRL(totalEntradas),
        totalSaidas: formatBRL(totalSaidas),
        totalImpostos: formatBRL(totalImpostos),
        saldoLiquido: formatBRL(saldoLiquido),
        quantidadeLancamentos: transactions.length,
        lancamentosAtrasados: transactions.filter(t => t.status === "Atrasado").length,
    };

    const openEdit = (tx: Transaction) => { setEditTx(tx); setTxModalOpen(true); };
    const openNew = () => { setEditTx(null); setTxModalOpen(true); };

    return (
        <div className="p-4 md:p-8 bg-zinc-950 text-white min-h-full font-sans flex flex-col gap-5">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Inbox <span className="text-blue-500 font-light">Financeiro</span>
                    </h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Gerencie seus lançamentos financeiros</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIagoOpen(true)} variant="outline" className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold gap-2 h-9">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center text-[9px] font-black text-white shrink-0">I</span>
                        Assistente IA
                    </Button>
                    <Button variant="outline" className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold gap-2 h-9">
                        <Download size={15} /> Exportar
                    </Button>
                    <Button onClick={openNew} className="bg-[#0056b3] hover:bg-[#004494] text-white text-xs font-bold uppercase tracking-wider gap-2 h-9 px-5 shadow-[0_0_20px_rgba(0,86,179,0.25)]">
                        <Plus size={15} /> Novo Lançamento
                    </Button>
                </div>
            </div>

            {/* ── Summary Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Entradas" value={totalEntradas} count={entradas.length} color="text-emerald-400" icon={ArrowUpCircle} iconColor="text-emerald-400" />
                <StatCard label="Saídas (incl. Impostos)" value={totalSaidas} count={saidas.length} color="text-rose-400" icon={ArrowDownCircle} iconColor="text-rose-400" />
                <StatCard label="Impostos + Retenção" value={totalImpostos} count={impostos.length} color="text-amber-400" icon={Receipt} iconColor="text-amber-400" />
            </div>

            {/* ── Saldo ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Wallet size={18} className="text-blue-400" />
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Saldo Líquido</p>
                        <p className={`text-3xl font-extrabold tracking-tight mt-0.5 ${saldoLiquido >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatBRL(saldoLiquido)}
                        </p>
                    </div>
                </div>
                <p className="text-[11px] text-zinc-500">Entradas − (Saídas + Impostos)</p>
            </div>

            {/* ── Filters ────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Filter size={13} />
                    <span className="font-semibold">Filtros</span>
                    {activeFilters > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{activeFilters} ativo{activeFilters > 1 ? "s" : ""}</span>}
                    {activeFilters > 0 && (
                        <button onClick={clearFilters} className="ml-1 flex items-center gap-1 text-zinc-500 hover:text-zinc-200 transition-colors">
                            <X size={11} /> Limpar
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors">
                        <option value="todos">Todos os tipos</option>
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors">
                        <option value="todos">Todos status</option>
                        <option value="Pago">Pago</option>
                        <option value="Atrasado">Atrasado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                    <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors">
                        <option value="todas">Todas categorias</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                        onClick={() => setShowPeriod(!showPeriod)}
                        className={`h-8 flex items-center gap-2 text-xs border rounded-md px-3 transition-colors ${showPeriod ? "bg-blue-600/20 border-blue-500 text-blue-300" : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-blue-500"}`}
                    >
                        <CalendarDays size={13} /> {filterStartDate && filterEndDate ? `${fmtDate(filterStartDate)} → ${fmtDate(filterEndDate)}` : "Período"}
                    </button>
                </div>
                {showPeriod && (
                    <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold">De</label>
                            <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-zinc-500 uppercase font-bold">Até</label>
                            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 focus:outline-none focus:border-blue-500" />
                        </div>
                        <Button size="sm" onClick={loadData} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-xs font-bold">Aplicar</Button>
                    </div>
                )}
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden flex flex-col mt-2">
                <div className="p-3 border-b border-zinc-800">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lançamentos..." className="w-full h-9 pl-9 pr-4 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_2fr_80px] text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-5 py-3 border-b border-zinc-800/60">
                            <span>Nome</span><span>Valor</span><span>Vencimento</span>
                            <span>Categoria</span><span>Status</span>
                            <span>Fornecedor/Cliente</span><span />
                        </div>

                        <div className="flex-1 divide-y divide-zinc-800/50">
                            {loading ? (
                                <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
                                    <Loader2 size={18} className="animate-spin" /> Carregando lançamentos...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-600">
                                    <Info size={28} />
                                    <p className="text-sm">Nenhum lançamento encontrado no período.</p>
                                    <p className="text-xs text-zinc-700">{filterStartDate && filterEndDate ? `${fmtDate(filterStartDate)} até ${fmtDate(filterEndDate)}` : ""}</p>
                                </div>
                            ) : (
                                filtered.map(t => {
                                    const isEntrada = t.type === "Entrada";
                                    const isImposto = !isEntrada && !!t.notes?.includes(TAX_MARKER);
                                    const bulletColor = isEntrada ? "#10b981" : isImposto ? "#f59e0b" : "#f43f5e";
                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => openEdit(t)}
                                            className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_2fr_80px] items-center px-5 py-3.5 hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isEntrada ? "bg-emerald-500/15 text-emerald-400" : isImposto ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400"}`}>
                                                    {isEntrada ? <ArrowUpCircle size={13} /> : isImposto ? <Receipt size={13} /> : <ArrowDownCircle size={13} />}
                                                </div>
                                                <span className="text-sm font-semibold text-zinc-200 truncate">{t.name}</span>
                                            </div>
                                            <span className={`text-sm font-bold ${isEntrada ? "text-emerald-400" : isImposto ? "text-amber-400" : "text-rose-400"}`}>
                                                {isEntrada ? "+" : "-"} {formatBRL(t.amount)}
                                            </span>
                                            <span className="text-sm text-zinc-400">{t.due_date ? fmtDate(t.due_date) : "—"}</span>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: bulletColor }} />
                                                <span className="text-sm text-zinc-400 truncate break-all">{t.categories?.name || "—"}</span>
                                            </div>
                                            <div>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${t.status === "Pago" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : t.status === "Atrasado" ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"}`}>
                                                    {t.status}
                                                </span>
                                            </div>
                                            <span className="text-sm text-zinc-400 truncate break-all">{t.entities?.name || "—"}</span>
                                            <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity justify-end" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openEdit(t)} className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all">
                                                    <Pencil size={12} />
                                                </button>
                                                <button onClick={() => { deleteTransaction(t.id).then(loadData); }} className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-rose-900/60 border border-zinc-700 hover:border-rose-700 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lazy modals — only mounted when open */}
            <Suspense fallback={<ModalFallback />}>
                <TransactionModal open={txModalOpen} onClose={() => { setTxModalOpen(false); setEditTx(null); }} onSaved={loadData} categories={categories} projects={projects} editTx={editTx as any} mode="real" />
            </Suspense>
            <Suspense fallback={null}>
                <IagoModal open={iagoOpen} onClose={() => setIagoOpen(false)} context={iagoContext} pageTitle="Inbox Financeiro" />
            </Suspense>
        </div>
    );
}

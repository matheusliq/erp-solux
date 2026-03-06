"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
    Plus, ChevronDown, Trash2, Receipt, Loader2, Pencil, Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    getRealTransactions, getPlannedTransactions,
    deleteTransaction, updateTransaction
} from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categorias";
import { getProjects } from "@/app/actions/projetos";
import { getEntities } from "@/app/actions/entidades";

// Lazy modals — only bundled/parsed when first opened
const TransactionModal = lazy(() => import("@/components/TransactionModal"));
const IagoModal = lazy(() => import("@/components/IagoModal"));
const ModalFallback = () => (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-400" size={28} />
    </div>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
    id: string;
    name: string;
    amount: number;
    type: string;
    status: string;
    due_date: string;
    categories: { id: string; name: string; color: string; type: string } | null;
    entities: { name: string } | null;
    notes: string | null;
    receipt_url: string | null;
}
interface Category { id: string; name: string; color: string; type: string }

const TAX_MARKER = "[IMPOSTO]";
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const getMonthKey = (d: string) => d.slice(0, 7); // "YYYY-MM"
const getMonthLabel = (k: string) => {
    const [y, m] = k.split("-");
    return new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase());
};

// ─── TransactionModal now in /components/TransactionModal.tsx (lazy-loaded) ────────

// ─── Main Kanban Page ─────────────────────────────────────────────────────────
export default function KanbanPage() {
    const [mode, setMode] = useState<"real" | "planejado">("real");
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [entities, setEntities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTx, setEditTx] = useState<Transaction | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [iagoOpen, setIagoOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [txRes, catRes, projRes, entRes] = await Promise.all([
            mode === "real" ? getRealTransactions() : getPlannedTransactions(),
            getCategories(),
            getProjects(),
            getEntities()
        ]);
        if (txRes.success) setTransactions((txRes.data || []) as Transaction[]);
        if (catRes.success) setCategories((catRes.data || []) as Category[]);
        if (projRes.success) setProjects(projRes.data || []);
        if (entRes.success) setEntities(entRes.data || []);
        setLoading(false);
    }, [mode]);

    useEffect(() => {
        loadData();
        const handleRefresh = () => loadData();
        window.addEventListener("iago_data_changed", handleRefresh);
        return () => window.removeEventListener("iago_data_changed", handleRefresh);
    }, [loadData]);

    // ─── Build month → category → transactions map ────────────────────────────
    const monthMap: Record<string, Record<string, Transaction[]>> = {};
    transactions.forEach((t) => {
        const mk = getMonthKey(t.due_date);
        const catId = t.categories?.id || "__none__";
        if (!monthMap[mk]) monthMap[mk] = {};
        if (!monthMap[mk][catId]) monthMap[mk][catId] = [];
        monthMap[mk][catId].push(t);
    });

    // ─── Determine month range ─ 1 before first tx, 1 after last tx ──────────
    const addMonths = (mk: string, n: number) => {
        const [y, m] = mk.split("-").map(Number);
        const d = new Date(y, m - 1 + n, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const txMonths = Object.keys(monthMap).sort();
    const now = new Date();
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let rangeStart: string;
    let rangeEnd: string;
    if (txMonths.length === 0) {
        // Fallback: previous month, current, next
        rangeStart = addMonths(nowKey, -1);
        rangeEnd = addMonths(nowKey, 1);
    } else {
        rangeStart = addMonths(txMonths[0], -1);
        rangeEnd = addMonths(txMonths[txMonths.length - 1], 1);
    }

    // Build the full list of months to display
    const allMonths: string[] = [];
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
        if (!monthMap[cursor]) monthMap[cursor] = {};
        allMonths.push(cursor);
        cursor = addMonths(cursor, 1);
    }

    function getMonthStats(mk: string) {
        let entradas = 0, saidas = 0, impostos = 0;
        Object.values(monthMap[mk] || {}).forEach((list) =>
            list.forEach((t) => {
                if (t.type === "Entrada") entradas += t.amount;
                else if (t.notes?.includes(TAX_MARKER)) impostos += t.amount;
                else saidas += t.amount;
            })
        );
        return { entradas, saidas, impostos, saldoPos: entradas - impostos, saldo: entradas - saidas - impostos };
    }

    // ─── All categories for columns ──────────────────────────────────────────
    const allCategories: Category[] = [
        ...categories,
        { id: "__none__", name: "Sem categoria", color: "#52525b", type: "Sa_da" },
    ];

    // ─── Drag and drop ────────────────────────────────────────────────────────
    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const srcId = result.source.droppableId;     // "YYYY-MM||catId"
        const dstId = result.destination.droppableId;
        if (srcId === dstId && result.source.index === result.destination.index) return;

        const [srcMonth, srcCat] = srcId.split("||");
        const [dstMonth, dstCat] = dstId.split("||");

        // Find the dragged transaction
        const srcList = (monthMap[srcMonth]?.[srcCat] || []);
        const tx = srcList[result.source.index];
        if (!tx) return;

        // Optimistic UI update
        const newTx = transactions.map((t) => {
            if (t.id !== tx.id) return t;
            // Compute new due_date: keep day, change year-month to dstMonth
            const original = new Date(t.due_date + "T00:00:00");
            const [dY, dM] = dstMonth.split("-").map(Number);
            const newDate = new Date(dY, dM - 1, original.getDate());
            // Clamp to last day of month if necessary
            if (newDate.getMonth() !== dM - 1) newDate.setDate(0);
            const yyyy = newDate.getFullYear();
            const mm = String(newDate.getMonth() + 1).padStart(2, "0");
            const dd = String(newDate.getDate()).padStart(2, "0");
            const newCatId = dstCat === "__none__" ? undefined : dstCat;
            return {
                ...t,
                due_date: `${yyyy}-${mm}-${dd}`,
                categories: newCatId
                    ? (categories.find((c) => c.id === newCatId) || t.categories)
                    : null,
            };
        });
        setTransactions(newTx);

        // Persist to DB: update due_date and/or category
        const updatePayload: any = {};
        if (srcMonth !== dstMonth) {
            const original = new Date(tx.due_date + "T00:00:00");
            const [dY, dM] = dstMonth.split("-").map(Number);
            const newDate = new Date(dY, dM - 1, original.getDate());
            if (newDate.getMonth() !== dM - 1) newDate.setDate(0);
            const yyyy = newDate.getFullYear();
            const mm = String(newDate.getMonth() + 1).padStart(2, "0");
            const dd = String(newDate.getDate()).padStart(2, "0");
            updatePayload.due_date = `${yyyy}-${mm}-${dd}`;
        }
        if (srcCat !== dstCat && dstCat !== "__none__") {
            updatePayload.category_id = dstCat;
        }
        if (Object.keys(updatePayload).length > 0) {
            await updateTransaction(tx.id, updatePayload);
        }
    };

    const openEdit = (tx: Transaction) => {
        setEditTx(tx);
        setModalOpen(true);
    };
    const openNew = () => {
        setEditTx(null);
        setModalOpen(true);
    };

    return (
        <div className="p-4 md:p-8 min-h-full bg-background text-foreground font-sans flex flex-col">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-start mb-6 gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Kanban <span className="text-blue-500 font-light">Financeiro</span>
                    </h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Visualize e organize seus lançamentos por mês</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Real / Planejado dropdown */}
                    <div className="relative">
                        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 h-9 px-4 rounded-lg border border-zinc-700 bg-card text-sm font-semibold text-zinc-300 hover:border-blue-500 transition-colors">
                            {mode === "real" ? "Real" : "Planejado"}
                            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 top-11 z-50 bg-card border border-zinc-700 rounded-lg overflow-hidden shadow-xl w-36">
                                {(["real", "planejado"] as const).map((m) => (
                                    <button key={m} onClick={() => { setMode(m); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${mode === m ? "bg-blue-600 text-foreground" : "text-zinc-300 hover:bg-zinc-800"}`}>
                                        {m === "real" ? "Real" : "Planejado"}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => setIagoOpen(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg border border-zinc-700 bg-card text-sm font-semibold text-zinc-300 hover:border-blue-500/50 transition-colors">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 flex items-center justify-center text-[9px] font-black text-foreground shrink-0">I</span>
                        Assistente IA
                    </button>
                    <Button onClick={openNew} className="bg-[#0056b3] hover:bg-[#004494] text-foreground text-xs font-bold uppercase tracking-wider gap-2 h-9 px-5 shadow-[0_0_20px_rgba(0,86,179,0.25)]">
                        <Plus size={15} /> Novo
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-zinc-500 gap-2">
                    <Loader2 size={20} className="animate-spin" /> Carregando lançamentos...
                </div>
            ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex gap-4 overflow-x-auto pb-4 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {allMonths.map((mk) => {
                            const stats = getMonthStats(mk);
                            const monthCats = monthMap[mk] || {};

                            return (
                                <div key={mk} className="w-72 shrink-0 flex flex-col">
                                    {/* Column header */}
                                    <div className="bg-card border border-zinc-800 rounded-xl p-4 mb-3">
                                        <h2 className="text-sm font-bold text-foreground mb-3 capitalize">{getMonthLabel(mk)}</h2>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Entradas</span>
                                                <span className="text-emerald-400 font-bold">+{formatBRL(stats.entradas)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500 italic">(-) Impostos Total</span>
                                                <span className="text-amber-400 font-bold">{formatBRL(stats.impostos)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-zinc-800 pt-1 mt-1">
                                                <span className="text-zinc-400">Saldo pós-impostos</span>
                                                <span className={`font-bold ${stats.saldoPos >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatBRL(stats.saldoPos)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Saídas</span>
                                                <span className="text-rose-400 font-bold">-{formatBRL(stats.saidas)}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-700">
                                            <div>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Saldo Líquido</p>
                                                <p className={`text-sm font-extrabold ${stats.saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatBRL(stats.saldo)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category sections */}
                                    <div className="flex flex-col gap-2 flex-1">
                                        {allCategories.map((cat) => {
                                            const catTxs = monthCats[cat.id] || [];
                                            const drpId = `${mk}||${cat.id}`;
                                            return (
                                                <div key={cat.id}>
                                                    <div className="flex items-center gap-2 px-1 mb-1">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                                        <span className="text-xs font-semibold text-zinc-400">{cat.name}</span>
                                                        <span className="text-[10px] text-zinc-600">({catTxs.length})</span>
                                                    </div>
                                                    <Droppable droppableId={drpId}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.droppableProps}
                                                                className={`min-h-[52px] rounded-lg border transition-colors ${snapshot.isDraggingOver ? "border-blue-500/50 bg-blue-500/5" : "border-zinc-800 bg-card/20"} p-1.5 space-y-1.5`}
                                                            >
                                                                {catTxs.map((t, idx) => (
                                                                    <Draggable key={t.id} draggableId={t.id} index={idx}>
                                                                        {(provided, snapshot) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                {...provided.dragHandleProps}
                                                                                onClick={() => openEdit(t)}
                                                                                className={`bg-card border rounded-lg p-3 group transition-all cursor-pointer ${snapshot.isDragging ? "border-blue-500 shadow-lg shadow-blue-500/10" : "border-zinc-800 hover:border-zinc-600"}`}
                                                                            >
                                                                                <div className="flex justify-between items-start gap-1 mb-1.5">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                                                                                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                                                                                            {t.notes?.includes(TAX_MARKER) ? "%" : t.type === "Entrada" ? "↑" : "↓"}
                                                                                        </div>
                                                                                        <p className="text-xs font-semibold text-zinc-200 leading-tight">{t.name}</p>
                                                                                        {t.receipt_url && (
                                                                                            <div className="w-4 h-4 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0" title="Comprovante Anexado">
                                                                                                <Paperclip size={8} />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                                        <button onClick={() => openEdit(t)} className="w-5 h-5 rounded flex items-center justify-center text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                                                                                            <Pencil size={9} />
                                                                                        </button>
                                                                                        <button onClick={() => { deleteTransaction(t.id).then(loadData); }} className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                                                                                            <Trash2 size={10} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                <p className={`text-sm font-bold ${t.type === "Entrada" ? "text-emerald-400" : t.notes?.includes(TAX_MARKER) ? "text-amber-400" : "text-rose-400"}`}>
                                                                                    {t.type === "Entrada" ? "+" : "-"} {formatBRL(t.amount)}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 mt-2">
                                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${t.status === "Pago" ? "bg-emerald-500/15 text-emerald-400" : t.status === "Atrasado" ? "bg-rose-500/15 text-rose-400" : t.status === "Agendado" ? "bg-blue-500/15 text-blue-400" : "bg-zinc-800 text-zinc-500"}`}>
                                                                                        {t.status}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-zinc-600 ml-auto">{fmtDate(t.due_date)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                ))}
                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DragDropContext>
            )}

            <Suspense fallback={<ModalFallback />}>
                <TransactionModal open={modalOpen} onClose={() => { setModalOpen(false); setEditTx(null); }} onSaved={loadData} categories={categories} projects={projects} entities={entities} editTx={editTx as any} mode={mode} />
            </Suspense>
            <Suspense fallback={null}>
                <IagoModal
                    open={iagoOpen}
                    onClose={() => setIagoOpen(false)}
                    pageTitle={`Kanban Financeiro (${mode === "real" ? "Real" : "Planejado"})`}
                    context={{ modo: mode, totalLancamentos: transactions.length }}
                />
            </Suspense>
        </div>
    );
}
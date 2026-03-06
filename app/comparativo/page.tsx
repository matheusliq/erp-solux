"use client";

import { useState, useEffect, useCallback } from "react";
import {
    CheckCircle2, XCircle, TrendingUp, TrendingDown, Loader2,
    ChevronUp, ChevronDown, Minus, AlertTriangle
} from "lucide-react";
import { getComparativo } from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categorias";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
    id: string;
    name: string;
    amount: number;
    type: string;
    due_date: string | Date;
    categories: { id: string; name: string; color: string } | null;
}
interface Category { id: string; name: string; color: string; type: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
    return `R$${v.toFixed(0)}`;
};

function getMonthKey(d: string | Date) {
    const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
    return format(date, "MMM/yy", { locale: ptBR });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl">
            <p className="font-bold text-zinc-200 mb-2">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
                    <span className="text-zinc-400">{p.name}:</span>
                    <span className="font-bold text-white">{formatBRL(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ComparativoPage() {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const defaultStart = threeMonthsAgo.toISOString().split("T")[0];
    const defaultEnd = now.toISOString().split("T")[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [filterCategory, setFilterCategory] = useState("todas");

    const [real, setReal] = useState<Transaction[]>([]);
    const [planned, setPlanned] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [compRes, catRes] = await Promise.all([
            getComparativo(startDate, endDate),
            getCategories(),
        ]);
        if (compRes.success) {
            setReal((compRes.real || []) as Transaction[]);
            setPlanned((compRes.planned || []) as Transaction[]);
        }
        if (catRes.success) setCategories((catRes.data || []) as Category[]);
        setLoading(false);
    }, [startDate, endDate]);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Compute summaries ───────────────────────────────────────────────────
    const applyFilter = (arr: Transaction[]) =>
        filterCategory === "todas" ? arr : arr.filter((t) => t.categories?.id === filterCategory);

    const filteredReal = applyFilter(real);
    const filteredPlanned = applyFilter(planned);

    const sum = (arr: Transaction[], type: "Entrada" | "Saida") =>
        arr.filter((t) => type === "Entrada" ? t.type === "Entrada" : t.type !== "Entrada")
            .reduce((a, t) => a + t.amount, 0);

    const realEntradas = sum(filteredReal, "Entrada");
    const realSaidas = sum(filteredReal, "Saida");
    const planEntradas = sum(filteredPlanned, "Entrada");
    const planSaidas = sum(filteredPlanned, "Saida");

    const realSaldo = realEntradas - realSaidas;
    const planSaldo = planEntradas - planSaidas;

    const diffEntradas = realEntradas - planEntradas;
    const diffSaidas = realSaidas - planSaidas;
    const diffSaldo = realSaldo - planSaldo;

    // ─── Monthly chart data ──────────────────────────────────────────────────
    const monthlyMap: Record<string, { real: number; planejado: number }> = {};
    filteredReal.filter((t) => t.type !== "Entrada").forEach((t) => {
        const k = getMonthKey(t.due_date);
        if (!monthlyMap[k]) monthlyMap[k] = { real: 0, planejado: 0 };
        monthlyMap[k].real += t.amount;
    });
    filteredPlanned.filter((t) => t.type !== "Entrada").forEach((t) => {
        const k = getMonthKey(t.due_date);
        if (!monthlyMap[k]) monthlyMap[k] = { real: 0, planejado: 0 };
        monthlyMap[k].planejado += t.amount;
    });
    const chartData = Object.entries(monthlyMap).map(([month, vals]) => ({
        month, real: vals.real, planejado: vals.planejado,
    })).sort((a, b) => a.month.localeCompare(b.month));

    // ─── Category comparison ─────────────────────────────────────────────────
    const catMap: Record<string, { catId: string; name: string; color: string; real: number; planned: number }> = {};
    [...filteredReal, ...filteredPlanned].forEach((t) => {
        if (!t.categories) return;
        if (!catMap[t.categories.id]) {
            catMap[t.categories.id] = { catId: t.categories.id, name: t.categories.name, color: t.categories.color, real: 0, planned: 0 };
        }
    });
    filteredReal.filter((t) => t.type !== "Entrada").forEach((t) => {
        if (t.categories?.id && catMap[t.categories.id]) catMap[t.categories.id].real += t.amount;
    });
    filteredPlanned.filter((t) => t.type !== "Entrada").forEach((t) => {
        if (t.categories?.id && catMap[t.categories.id]) catMap[t.categories.id].planned += t.amount;
    });
    const catComparison = Object.values(catMap);

    // ─── Diff badge ──────────────────────────────────────────────────────────
    const DiffBadge = ({ diff, invert = false }: { diff: number; invert?: boolean }) => {
        const positive = invert ? diff < 0 : diff > 0;
        const neutral = Math.abs(diff) < 0.01;
        return (
            <span className={`text-sm font-bold ${neutral ? "text-zinc-400" : positive ? "text-emerald-400" : "text-rose-400"}`}>
                {neutral ? "—" : `${diff > 0 ? "+" : ""}${formatBRL(diff)}`}
            </span>
        );
    };

    return (
        <div className="p-8 h-full bg-background text-white font-sans flex flex-col gap-5 overflow-y-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Real <span className="text-zinc-500 font-light">vs</span>
                    <span className="text-blue-500 font-light"> Planejado</span>
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">Compare seus gastos reais com o orçamento planejado</p>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Período Inicial</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-10 text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg px-3 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Período Final</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-10 text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg px-3 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Categoria</label>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full h-10 text-sm bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg px-3 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                        <option value="todas">Todas categorias</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-zinc-500 gap-2">
                    <Loader2 size={18} className="animate-spin" /> Carregando dados...
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            {
                                label: "Entradas",
                                icon: CheckCircle2,
                                iconColor: "text-emerald-400",
                                realVal: realEntradas,
                                planVal: planEntradas,
                                diff: diffEntradas,
                                invert: false,
                                goodMsg: "Melhor que o planejado",
                                badMsg: "Abaixo do planejado",
                            },
                            {
                                label: "Saídas",
                                icon: XCircle,
                                iconColor: "text-rose-400",
                                realVal: realSaidas,
                                planVal: planSaidas,
                                diff: diffSaidas,
                                invert: true,
                                goodMsg: "Dentro do orçamento",
                                badMsg: "Acima do orçamento",
                            },
                            {
                                label: "Saldo Líquido Final",
                                icon: TrendingUp,
                                iconColor: "text-blue-400",
                                realVal: realSaldo,
                                planVal: planSaldo,
                                diff: diffSaldo,
                                invert: false,
                                goodMsg: "Melhor que o planejado",
                                badMsg: "Abaixo do planejado",
                            },
                        ].map(({ label, icon: Icon, iconColor, realVal, planVal, diff, invert, goodMsg, badMsg }) => {
                            const isGood = invert ? diff <= 0 : diff >= 0;
                            return (
                                <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                                        <Icon size={14} className={iconColor} />
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Real:</span>
                                            <span className="font-bold text-zinc-200">{formatBRL(realVal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Planejado:</span>
                                            <span className="font-bold text-blue-400">{formatBRL(planVal)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
                                            <span className="text-zinc-400 font-semibold">Diferença:</span>
                                            <DiffBadge diff={diff} invert={invert} />
                                        </div>
                                    </div>
                                    {Math.abs(diff) > 0.01 && (
                                        <div className={`mt-3 flex items-center gap-1.5 text-[10px] font-bold ${isGood ? "text-emerald-400" : "text-amber-400"}`}>
                                            {isGood ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                            {isGood ? goodMsg : badMsg}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-[1.3fr_1fr] gap-4">
                        {/* Bar chart */}
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                            <p className="text-sm font-bold text-zinc-200 mb-4">Comparação Mensal (Saídas)</p>
                            {chartData.length === 0 ? (
                                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Sem dados no período</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={chartData} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={fmtShort} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff08" }} />
                                        <Legend formatter={(v) => <span style={{ color: "#a1a1aa", fontSize: 11 }}>{v === "real" ? "Real" : "Planejado"}</span>} />
                                        <Bar dataKey="real" name="real" fill="#f87171" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="planejado" name="planejado" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.6} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Category table */}
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 overflow-hidden">
                            <p className="text-sm font-bold text-zinc-200 mb-4">Por Categoria (Saídas)</p>
                            {catComparison.length === 0 ? (
                                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Sem dados no período</div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Header */}
                                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[10px] font-bold text-zinc-600 uppercase tracking-widest border-b border-zinc-800 pb-2">
                                        <span>Categoria</span>
                                        <span className="text-right">Real</span>
                                        <span className="text-right">Plan.</span>
                                        <span className="text-right">Diff</span>
                                    </div>
                                    {catComparison.map((c) => {
                                        const diff = c.real - c.planned;
                                        const isOver = diff > 0;
                                        return (
                                            <div key={c.catId} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center text-xs py-1.5 border-b border-zinc-800/40">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                    <span className="text-zinc-300 font-medium truncate">{c.name}</span>
                                                    {isOver && <AlertTriangle size={10} className="text-amber-400 shrink-0" />}
                                                </div>
                                                <span className="text-right text-rose-400 font-bold">{fmtShort(c.real)}</span>
                                                <span className="text-right text-blue-400 font-bold">{fmtShort(c.planned)}</span>
                                                <span className={`text-right font-bold ${isOver ? "text-rose-400" : diff < 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                                                    {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${fmtShort(diff)}`}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

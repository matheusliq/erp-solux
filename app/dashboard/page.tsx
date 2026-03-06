"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, TrendingDown, DollarSign, AlertTriangle,
    ArrowUpCircle, ArrowDownCircle, Receipt, CalendarDays, Loader2,
    ChevronRight, X
} from "lucide-react";
import { getTransactions } from "@/app/actions/transactions";
import { getProjects } from "@/app/actions/projetos";
import { PieChart, Landmark } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Tx {
    id: string; name: string; amount: number; type: string;
    status: string; due_date: string; notes: string | null;
    categories: { name: string; color: string } | null;
    entities: { name: string } | null;
    projects: { id: string; name: string } | null;
}

// ── Simple Bar Chart SVG (no library) ──────────────────────────────────────
function BarChart({ data, height = 160 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
    if (!data.length || data.every(d => d.value === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Sem dados para exibir
            </div>
        );
    }
    const max = Math.max(...data.map(d => d.value));
    const w = 100 / data.length;
    return (
        <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
            {data.map((d, i) => {
                const barH = max === 0 ? 0 : (d.value / max) * (height - 24);
                const x = i * w + w * 0.2;
                const bw = w * 0.6;
                const y = height - barH - 20;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={bw} height={barH} rx="2" fill={d.color} fillOpacity="0.85" />
                        <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="5" fill="#71717a" fontFamily="sans-serif">
                            {d.label}
                        </text>
                        <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="4.5" fill="#a1a1aa" fontFamily="sans-serif">
                            {d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value.toFixed(0)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// ── Simple Line Chart SVG ───────────────────────────────────────────────────
function LineChart({ data, height = 160 }: {
    data: { label: string; entradas: number; saidas: number }[];
    height?: number;
}) {
    if (!data.length || data.every(d => d.entradas === 0 && d.saidas === 0)) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Sem dados para exibir
            </div>
        );
    }
    const max = Math.max(...data.flatMap(d => [d.entradas, d.saidas]), 1);
    const w = 100;
    const h = height - 20;
    const step = w / Math.max(data.length - 1, 1);

    const toPoint = (i: number, v: number) => {
        const x = i * step;
        const y = h - (v / max) * (h - 16);
        return `${x},${y}`;
    };

    const entPath = data.map((d, i) => (i === 0 ? "M" : "L") + toPoint(i, d.entradas)).join(" ");
    const saiPath = data.map((d, i) => (i === 0 ? "M" : "L") + toPoint(i, d.saidas)).join(" ");

    return (
        <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
                <line key={i} x1="0" y1={h - f * (h - 16)} x2="100" y2={h - f * (h - 16)}
                    stroke="#27272a" strokeWidth="0.5" />
            ))}
            <path d={entPath} fill="none" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={saiPath} fill="none" stroke="#f43f5e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => (
                <text key={i} x={i * step} y={height - 4} textAnchor="middle" fontSize="4.5" fill="#71717a" fontFamily="sans-serif">
                    {d.label}
                </text>
            ))}
            {/* Legend */}
            <circle cx="5" cy="8" r="2" fill="#10b981" />
            <text x="9" y="11" fontSize="4" fill="#10b981" fontFamily="sans-serif">Entradas</text>
            <circle cx="35" cy="8" r="2" fill="#f43f5e" />
            <text x="39" y="11" fontSize="4" fill="#f43f5e" fontFamily="sans-serif">Saídas</text>
        </svg>
    );
}

// ── Month key helper ────────────────────────────────────────────────────────
const monthLabel = (mk: string) => {
    const [y, m] = mk.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};
const getMonthKey = (d: string) => d?.slice(0, 7) || "";

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardPage() {
    const [allTx, setAllTx] = useState<Tx[]>([]);
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSocietarioModal, setShowSocietarioModal] = useState(false);

    // Filtros
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [showPeriod, setShowPeriod] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [resTx, resProj] = await Promise.all([
                getTransactions({
                    statusIn: ["Pago", "Atrasado", "Cancelado"],
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                }),
                getProjects()
            ]);
            if (resTx.success) setAllTx((resTx.data || []) as Tx[]);
            if (resProj.success) setAllProjects(resProj.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [startDate, endDate]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Calculations ──────────────────────────────────────────────────────────
    const TAX = "[IMPOSTO]";
    const entradas = allTx.filter(t => t.type === "Entrada");
    const saidas = allTx.filter(t => t.type !== "Entrada");
    const impostos = saidas.filter(t => t.notes?.includes(TAX));
    const atrasados = allTx.filter(t => t.status === "Atrasado");

    const totalEntradas = entradas.reduce((a, t) => a + t.amount, 0);
    const totalSaidas = saidas.reduce((a, t) => a + t.amount, 0);
    const totalImpostos = impostos.reduce((a, t) => a + t.amount, 0);
    const saldo = totalEntradas - totalSaidas;

    // ── CFO: Rateio Societário de Obras ───────────────────────────────────────
    const parseSplits = (s: any) => {
        if (!s) return [];
        if (typeof s === "string") {
            try { return JSON.parse(s); } catch { return []; }
        }
        return Array.isArray(s) ? s : [];
    };

    const projectsWithSplit = allProjects
        .map(p => ({ ...p, parsed_splits: parseSplits(p.partners_split) }))
        .filter(p => p.parsed_splits.length > 0)
        .map(p => {
            const projTx = saidas.filter(t => t.projects?.id === p.id);
            const custos = projTx.reduce((a, t) => a + t.amount, 0);

            const orcamento = p.contract_value || 0;
            const reserva = p.budget_solux_reserve || 0;
            const montanteDistribuivel = orcamento - reserva;
            const lucroRestante = montanteDistribuivel - custos;

            return {
                ...p,
                orcamento,
                reserva,
                custos,
                montanteDistribuivel,
                lucroRestante,
                splits: p.parsed_splits.map((s: any) => ({
                    name: s.name,
                    percentage: parseFloat(s.percentage) || 0,
                    value: ((parseFloat(s.percentage) || 0) / 100) * lucroRestante
                }))
            };
        });

    // ── CFO: Caixa Solux ──────────────────────────────────────────────────────
    const despesasOperacionaisSolux = saidas.filter(t => !t.projects?.id).reduce((a, t) => a + t.amount, 0);
    const reservasObrasDashboard = allProjects.reduce((a, p) => a + (p.budget_solux_reserve || 0), 0);
    const caixaSolux = reservasObrasDashboard - despesasOperacionaisSolux;

    // ── CFO: Reembolsos Societários Pendentes ────────────────────────────────
    const reembolsosPendentes = saidas.reduce((acc: Record<string, number>, t) => {
        if (t.notes?.includes("[REEMBOLSO:")) {
            const match = t.notes.match(/\[REEMBOLSO:(.*?)\]/);
            if (match && match[1]) {
                const name = match[1];
                acc[name] = (acc[name] || 0) + t.amount;
            }
        }
        return acc;
    }, {});
    const totalReembolsos = Object.values(reembolsosPendentes).reduce((a, b) => a + b, 0);

    // ── Monthly bar data ──────────────────────────────────────────────────────
    const monthlyMap: Record<string, { ent: number; sai: number }> = {};
    allTx.forEach(t => {
        const mk = getMonthKey(t.due_date);
        if (!monthlyMap[mk]) monthlyMap[mk] = { ent: 0, sai: 0 };
        if (t.type === "Entrada") monthlyMap[mk].ent += t.amount;
        else monthlyMap[mk].sai += t.amount;
    });
    const sortedMonths = Object.keys(monthlyMap).sort();

    const barDataEntradas = sortedMonths.map(mk => ({
        label: monthLabel(mk), value: monthlyMap[mk].ent, color: "#10b981"
    }));
    const barDataSaidas = sortedMonths.map(mk => ({
        label: monthLabel(mk), value: monthlyMap[mk].sai, color: "#f43f5e"
    }));
    const lineData = sortedMonths.map(mk => ({
        label: monthLabel(mk),
        entradas: monthlyMap[mk].ent,
        saidas: monthlyMap[mk].sai,
    }));

    // ── Category totals for saídas ────────────────────────────────────────────
    const catMap: Record<string, { name: string; color: string; total: number }> = {};
    saidas.forEach(t => {
        const key = t.categories?.name || "Sem categoria";
        const color = t.categories?.color || "#52525b";
        if (!catMap[key]) catMap[key] = { name: key, color, total: 0 };
        catMap[key].total += t.amount;
    });
    const topCategories = Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 5);
    const totalCatSaidas = topCategories.reduce((a, c) => a + c.total, 0);

    const StatCard = ({ label, value, sub, icon: Icon, color, bg }: any) => (
        <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 overflow-hidden">
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-15 ${bg}`} />
            <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                <div className={`p-1.5 rounded-lg ${bg} bg-opacity-20`}><Icon size={16} className={color} /></div>
            </div>
            <p className={`text-2xl font-extrabold tracking-tight ${color}`}>{formatBRL(value)}</p>
            {sub && <p className="text-[11px] text-zinc-500 mt-1.5">{sub}</p>}
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-zinc-950 text-white min-h-full font-sans">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Dashboard <span className="text-blue-500 font-light">CFO</span>
                    </h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Visão financeira consolidada do período</p>
                </div>
                <button
                    onClick={() => setShowPeriod(!showPeriod)}
                    className={`flex items-center gap-2 text-xs border rounded-lg px-4 py-2 transition-colors ${showPeriod ? "bg-blue-600/20 border-blue-500 text-blue-300" : "bg-zinc-900 border-zinc-700 text-zinc-300"}`}
                >
                    <CalendarDays size={14} />
                    {startDate && endDate ? `${new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")} → ${new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}` : "Filtrar Período"}
                </button>
            </div>

            {showPeriod && (
                <div className="flex items-center gap-3 mb-6 bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">De</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 focus:outline-none focus:border-blue-500" />
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Até</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 focus:outline-none focus:border-blue-500" />
                    <button onClick={loadData} className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-md">Aplicar</button>
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(""); setEndDate(""); }} className="h-8 px-3 text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 rounded-md">Limpar</button>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20 text-zinc-500 gap-2">
                    <Loader2 size={20} className="animate-spin" /> Carregando dados...
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard label="Saldo Líquido" value={saldo} sub={`${entradas.length} entradas · ${saidas.length} saídas`}
                            icon={saldo >= 0 ? TrendingUp : TrendingDown} color={saldo >= 0 ? "text-emerald-400" : "text-rose-400"} bg={saldo >= 0 ? "bg-emerald-500" : "bg-rose-500"} />
                        <StatCard label="Total de Entradas" value={totalEntradas} sub={`${entradas.length} lançamentos`}
                            icon={ArrowUpCircle} color="text-emerald-400" bg="bg-emerald-500" />
                        <StatCard label="Total de Saídas" value={totalSaidas} sub={`${saidas.length} lançamentos`}
                            icon={ArrowDownCircle} color="text-rose-400" bg="bg-rose-500" />
                        <StatCard label="Impostos + Retenção" value={totalImpostos} sub={`${impostos.length} lançamentos`}
                            icon={Receipt} color="text-amber-400" bg="bg-amber-500" />
                    </div>

                    {/* Alert: atrasados */}
                    {atrasados.length > 0 && (
                        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-5 py-3 mb-6">
                            <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                            <p className="text-sm text-rose-300">
                                <span className="font-bold">{atrasados.length} lançamento{atrasados.length > 1 ? "s" : ""} em atraso</span>
                                {" — "}Total: {formatBRL(atrasados.reduce((a, t) => a + t.amount, 0))}
                            </p>
                        </div>
                    )}

                    {/* CFO Special KPIs */}
                    <div className="mb-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-1 border border-blue-500/30 bg-blue-500/5 rounded-xl p-5 overflow-hidden relative flex flex-col justify-between">
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 bg-blue-500" />
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                        <Landmark size={18} /> Caixa Solux
                                    </h3>
                                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Reserva Obras - Custos Operacionais</p>
                                </div>
                            </div>
                            <p className={`text-4xl font-black mt-2 tracking-tighter ${caixaSolux >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {formatBRL(caixaSolux)}
                            </p>
                            <div className="mt-4 pt-4 border-t border-blue-500/10 flex justify-between text-xs font-medium">
                                <span className="text-blue-300">Reserva Projetos: {formatBRL(reservasObrasDashboard)}</span>
                                <span className="text-rose-300">Despesas: {formatBRL(despesasOperacionaisSolux)}</span>
                            </div>
                        </div>

                        {/* Reembolsos */}
                        <div className="lg:col-span-1 border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-5 overflow-hidden relative flex flex-col justify-between">
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 bg-indigo-500" />
                            <div>
                                <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                                    <Receipt size={18} /> Reembolsos Pendentes
                                </h3>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Valores pagos por sócios</p>
                            </div>

                            {totalReembolsos === 0 ? (
                                <p className="text-sm font-bold text-zinc-500 mt-4">Nenhum pendente</p>
                            ) : (
                                <div className="mt-4 space-y-2 relative z-10 w-full">
                                    {Object.entries(reembolsosPendentes).map(([name, val]) => (
                                        <div key={name} className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg">
                                            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">{name}</span>
                                            <span className="text-sm font-black text-indigo-400">{formatBRL(val)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-2 border border-zinc-800 bg-zinc-900/40 rounded-xl p-5 overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                                        <PieChart size={16} className="text-indigo-400" /> Distribuição Societária Líquida
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Total consolidado por sócio · todas as obras</p>
                                </div>
                                {projectsWithSplit.length > 0 && (
                                    <button
                                        onClick={() => setShowSocietarioModal(true)}
                                        className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/60 px-2.5 py-1.5 rounded-lg transition-colors"
                                    >
                                        <ChevronRight size={11} /> Mostrar detalhes
                                    </button>
                                )}
                            </div>

                            {projectsWithSplit.length === 0 ? (
                                <div className="text-center py-6 text-zinc-500 text-sm">Nenhuma obra com rateio societário configurado.</div>
                            ) : (() => {
                                // Aggregate totals per partner across all obras
                                const totals: Record<string, number> = {};
                                projectsWithSplit.forEach(p => {
                                    p.splits.forEach((s: any) => {
                                        totals[s.name] = (totals[s.name] || 0) + s.value;
                                    });
                                });
                                return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {Object.entries(totals).map(([name, value]) => (
                                            <div key={name} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-center">
                                                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2">
                                                    <span className="text-indigo-300 text-sm font-black">{name[0]}</span>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{name}</p>
                                                <p className={`text-base font-extrabold mt-1 ${value >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                    {formatBRL(value)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Modal: Distribuição por Obra */}
                    {showSocietarioModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSocietarioModal(false)}>
                            <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                                    <div>
                                        <h3 className="font-bold text-white flex items-center gap-2"><PieChart size={16} className="text-indigo-400" /> Detalhamento por Obra</h3>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Distribuição líquida para cada sócio por obra</p>
                                    </div>
                                    <button onClick={() => setShowSocietarioModal(false)} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"><X size={16} /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* Total row */}
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Total Consolidado</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {Object.entries(projectsWithSplit.reduce((acc: Record<string, number>, p) => {
                                                p.splits.forEach((s: any) => { acc[s.name] = (acc[s.name] || 0) + s.value; });
                                                return acc;
                                            }, {})).map(([name, val]) => (
                                                <div key={name} className="text-center">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-bold">{name}</p>
                                                    <p className={`text-sm font-extrabold ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatBRL(val)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-zinc-800" />
                                    {/* Per-obra rows */}
                                    {projectsWithSplit.map(p => (
                                        <div key={p.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-bold text-zinc-100">{p.name}</h4>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.lucroRestante >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                                    Líquido: {formatBRL(p.lucroRestante)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {p.splits.map((s: any) => (
                                                    <div key={s.name} className="bg-zinc-800/50 rounded-lg p-2.5 text-center">
                                                        <p className="text-[9px] uppercase font-bold text-zinc-500 mb-1">{s.name} ({s.percentage}%)</p>
                                                        <p className={`text-xs font-extrabold ${s.value >= 0 ? "text-emerald-300" : "text-rose-400"}`}>{formatBRL(s.value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Entradas por mês */}
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-4">Entradas por Mês</h3>
                            <BarChart data={barDataEntradas} height={160} />
                        </div>
                        {/* Cash Flow line */}
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-4">Fluxo de Caixa — Entradas vs Saídas</h3>
                            <LineChart data={lineData} height={160} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Saídas por mês */}
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-4">Comparação Mensal (Saídas)</h3>
                            <BarChart data={barDataSaidas} height={140} />
                        </div>

                        {/* Top categorias */}
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-4">Saídas por Categoria</h3>
                            {topCategories.length === 0 ? (
                                <p className="text-zinc-600 text-sm text-center py-8">Sem dados</p>
                            ) : (
                                <div className="space-y-3">
                                    {topCategories.map(c => {
                                        const pct = totalCatSaidas > 0 ? (c.total / totalCatSaidas) * 100 : 0;
                                        return (
                                            <div key={c.name}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                        <span className="text-zinc-300 font-medium">{c.name}</span>
                                                    </div>
                                                    <span className="text-zinc-400">{formatBRL(c.total)}</span>
                                                </div>
                                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                                                </div>
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
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus, Filter, X, Search, ArrowUpCircle, ArrowDownCircle,
    Wallet, Pencil, Trash2, Info, CalendarDays, Lightbulb, Loader2, Check
} from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPlannedTransactions, createTransaction, updateTransaction, deleteTransaction } from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categorias";
import { getProjects } from "@/app/actions/projetos";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
    id: string;
    name: string;
    amount: number;
    type: string;
    status: string;
    due_date: string | Date;
    categories: { id: string; name: string; color: string } | null;
    projects: { id: string; name: string } | null;
    entities: { name: string } | null;
    notes: string | null;
}
interface Category {
    id: string;
    name: string;
    color: string;
    type: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
    return date.toLocaleDateString("pt-BR");
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PlanejadoPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("todos");
    const [filterCategory, setFilterCategory] = useState("todas");
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "", amount: "", type: "saida",
        due_date: "", category_id: "", project_id: "", notes: "",
    });

    const handleOpenNew = () => {
        setEditId(null);
        setForm({ name: "", amount: "", type: "saida", due_date: "", category_id: "", project_id: "", notes: "" });
        setModalOpen(true);
    };

    const handleEdit = (t: Transaction) => {
        setEditId(t.id);
        setForm({
            name: t.name,
            amount: t.amount.toString(),
            type: t.type,
            due_date: typeof t.due_date === "string" ? t.due_date : new Date(t.due_date).toISOString().split("T")[0],
            category_id: t.categories?.id || "",
            project_id: t.projects?.id || "",
            notes: t.notes || "",
        });
        setModalOpen(true);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        const [txRes, catRes, projRes] = await Promise.all([
            getPlannedTransactions(),
            getCategories(),
            getProjects(),
        ]);
        if (txRes.success) setTransactions((txRes.data || []) as Transaction[]);
        if (catRes.success) setCategories((catRes.data || []) as Category[]);
        if (projRes.success) setProjects(projRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Summary ─────────────────────────────────────────────────────────────
    const entradas = transactions.filter((t) => t.type === "Entrada");
    const saidas = transactions.filter((t) => t.type !== "Entrada");
    const totalEntradas = entradas.reduce((a, t) => a + t.amount, 0);
    const totalSaidas = saidas.reduce((a, t) => a + t.amount, 0);
    const saldo = totalEntradas - totalSaidas;

    // ─── Filter ───────────────────────────────────────────────────────────────
    const filtered = transactions.filter((t) => {
        const okSearch = t.name.toLowerCase().includes(search.toLowerCase());
        const okType = filterType === "todos" || (filterType === "entrada" && t.type === "Entrada") || (filterType === "saida" && t.type !== "Entrada");
        const okCat = filterCategory === "todas" || t.categories?.id === filterCategory;
        return okSearch && okType && okCat;
    });

    // ─── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.name || !form.amount || !form.due_date) return;
        setSaving(true);
        const payload = {
            name: form.name,
            amount: parseFloat(form.amount.replace(",", ".")),
            type: form.type,
            status: "Agendado",
            due_date: form.due_date,
            category_id: form.category_id || undefined,
            project_id: form.project_id || undefined,
            notes: form.notes || undefined,
        };

        const res = editId
            ? await updateTransaction(editId, payload)
            : await createTransaction(payload);

        if (res.success) {
            await loadData();
            setModalOpen(false);
            setEditId(null);
            setForm({ name: "", amount: "", type: "saida", due_date: "", category_id: "", project_id: "", notes: "" });
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        await deleteTransaction(id);
        await loadData();
    };

    return (
        <div className="p-4 md:p-8 min-h-full bg-background text-white font-sans flex flex-col gap-5">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Planejamento <span className="text-blue-500 font-light">Financeiro</span>
                    </h1>
                    <p className="text-xs text-zinc-500 mt-0.5">Defina suas metas e orçamentos</p>
                </div>
                <Button
                    onClick={handleOpenNew}
                    className="bg-[#0056b3] hover:bg-[#004494] text-white text-xs font-bold uppercase tracking-wider gap-2 h-9 px-5 shadow-[0_0_20px_rgba(0,86,179,0.25)]"
                >
                    <Plus size={15} /> Novo Planejamento
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: "Entradas", value: totalEntradas, count: entradas.length, color: "text-emerald-400", icon: ArrowUpCircle, iconColor: "text-emerald-400" },
                    { label: "Saídas", value: totalSaidas, count: saidas.length, color: "text-rose-400", icon: ArrowDownCircle, iconColor: "text-rose-400" },
                    { label: "Saldo", value: saldo, count: transactions.length, color: saldo >= 0 ? "text-emerald-400" : "text-rose-400", icon: Wallet, iconColor: "text-blue-400" },
                ].map(({ label, value, count, color, icon: Icon, iconColor }) => (
                    <div key={label} className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 overflow-hidden">
                        <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-15 ${iconColor.replace("text-", "bg-")}`} />
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                            <Icon size={15} className={iconColor} />
                        </div>
                        <p className={`text-2xl font-extrabold tracking-tight mt-2 ${color}`}>{formatBRL(value)}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            {count} previstos
                        </div>
                    </div>
                ))}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <Lightbulb size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs font-bold text-blue-400">Dica</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Os lançamentos planejados servem como referência para comparação com os gastos reais.
                        Use para definir orçamentos mensais e metas de economia.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Filter size={13} />
                    <span className="font-semibold">Filtros</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="todos">Todos os tipos</option>
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                    </select>
                    <select
                        className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
                        defaultValue="todos"
                    >
                        <option value="todos">Todos status</option>
                        <option value="agendado">Agendado</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="todas">Todas categorias</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <select
                        className="h-8 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors"
                        defaultValue="todos"
                    >
                        <option value="todos">Todos centros</option>
                    </select>
                    <button className="h-8 flex items-center gap-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-3 hover:border-blue-500 transition-colors">
                        <CalendarDays size={13} /> Período
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 mb-8 flex flex-col">
                <div className="p-3 border-b border-zinc-800">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar planejamentos..."
                            className="w-full h-9 pl-9 pr-4 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_80px] text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-5 py-3 border-b border-zinc-800/60">
                    <span>Nome</span>
                    <span>Valor</span>
                    <span>Data</span>
                    <span>Categoria</span>
                    <span>Centro de Custo</span>
                    <span />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
                        <Loader2 size={18} className="animate-spin" /> Carregando...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-600">
                        <Info size={28} />
                        <p className="text-sm">Nenhum lançamento planejado encontrado.</p>
                        <button onClick={handleOpenNew} className="mt-1 text-xs text-blue-500 hover:underline">
                            Criar novo planejamento →
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/50">
                        {filtered.map((t) => {
                            const isEntrada = t.type === "Entrada";
                            return (
                                <div key={t.id} className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_80px] items-center px-5 py-3.5 hover:bg-zinc-800/30 transition-colors group">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isEntrada ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                                            {isEntrada ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                                        </div>
                                        <span className="text-sm font-semibold text-zinc-200">{t.name}</span>
                                    </div>
                                    <span className={`text-sm font-bold ${isEntrada ? "text-emerald-400" : "text-amber-400"}`}>
                                        {isEntrada ? "+" : "-"} {formatBRL(t.amount)}
                                    </span>
                                    <span className="text-sm text-zinc-400">{fmtDate(t.due_date)}</span>
                                    <div className="flex items-center gap-1.5">
                                        {t.categories && (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.categories.color }} />
                                                <span className="text-sm text-zinc-400">{t.categories.name}</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-sm text-zinc-500 truncate max-w-[120px]">{t.projects?.name || "Geral"}</span>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                        <button onClick={() => handleEdit(t)} className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all">
                                            <Pencil size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="w-7 h-7 rounded-md bg-zinc-800 hover:bg-rose-900/60 border border-zinc-700 hover:border-rose-700 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="bg-background border border-zinc-800 text-white max-w-xl max-h-[85vh] overflow-y-auto p-0 rounded-xl shadow-2xl">
                    <DialogHeader className="p-6 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
                        <DialogTitle className="text-xl font-bold">{editId ? "Editar Planejamento" : "Novo Planejamento"}</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Tipo</Label>
                                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        <SelectItem value="entrada">💰 Entrada</SelectItem>
                                        <SelectItem value="saida">💸 Saída</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Categoria</Label>
                                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10 text-zinc-400"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Centro de Custo</Label>
                                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 h-10 text-zinc-400"><SelectValue placeholder="Geral / Nenhum" /></SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        <SelectItem value="none">Centro de Custo Solux</SelectItem>
                                        {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Nome *</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aluguel de equipamentos" className="bg-zinc-900 border-zinc-800 h-10 placeholder:text-zinc-600" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Valor *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">R$</span>
                                    <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="pl-10 bg-zinc-900 border-zinc-800 h-10 font-bold text-blue-500" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Data *</Label>
                                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="bg-zinc-900 border-zinc-800 h-10 text-zinc-300 [color-scheme:dark]" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[11px] font-bold text-zinc-500 uppercase">Observações</Label>
                                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="..." className="bg-zinc-900 border-zinc-800 resize-none h-16 placeholder:text-zinc-700" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-zinc-900/50 border-t border-zinc-800 sticky bottom-0 backdrop-blur-sm gap-3">
                        <Button variant="ghost" onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-white hover:bg-zinc-800 font-bold uppercase text-[11px]">Cancelar</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !form.name || !form.amount || !form.due_date}
                            className="h-11 px-8 font-bold uppercase text-[11px] tracking-widest bg-[#0056b3] hover:bg-[#004494] text-white disabled:opacity-50"
                        >
                            {saving ? <><Loader2 size={15} className="animate-spin mr-2" /> Salvando...</> : <><Check size={15} className="mr-2" /> Salvar Planejamento</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

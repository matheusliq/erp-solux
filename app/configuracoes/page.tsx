"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Plus, HardHat, Tag, Users, Landmark,
    Mail, FileText, Palette, Pencil, Check, Loader2, Trash2, Phone,
    DollarSign, Building2, X, ArrowUpCircle, ArrowDownCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCategory, getCategories, updateCategory, deleteCategory } from "@/app/actions/categorias";
import { getEntities, createEntity, updateEntity, deleteEntity } from "@/app/actions/entidades";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projetos";

// ── Valid entity types that the DB CHECK constraint accepts ──────────────────
// The constraint "entities_type_check" expects lowercase values.
// If your constraint uses different values, update this list.
const ENTITY_TYPES = [
    { value: "cliente", label: "Cliente" },
    { value: "fornecedor", label: "Fornecedor" },
    { value: "subcontratado", label: "Subcontratado" },
    { value: "parceiro", label: "Parceiro" },
];

const PROJECT_STATUS = [
    { value: "negotiation", label: "🤝 Em Negociação" },
    { value: "active", label: "🟢 Ativo" },
    { value: "paused", label: "⏸️ Pausado" },
    { value: "completed", label: "✅ Concluído" },
];

// ── 12 preset UX colors ─────────────────────────────────────────────────────
const PRESET_COLORS = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f43f5e", // rose
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#ec4899", // pink
    "#14b8a6", // teal
    "#6366f1", // indigo
    "#a78bfa", // purple-light
];

const STATUS_COLORS: Record<string, string> = {
    negotiation: "text-amber-400 bg-amber-500/10",
    active: "text-emerald-400 bg-emerald-500/10",
    paused: "text-zinc-400 bg-zinc-700/30",
    completed: "text-blue-400 bg-blue-500/10",
};
const STATUS_LABELS: Record<string, string> = {
    negotiation: "Em Negociação", active: "Ativo", paused: "Pausado", completed: "Concluído"
};

// ── Formatador BRL (also used inline) ────────────────────────────────────────
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── ProjectFinancialSummary ───────────────────────────────────────────────────
function ProjectFinancialSummary({
    projectId, contractValue, soluxReserve, partnersSplit,
}: {
    projectId: string;
    contractValue?: number;
    soluxReserve?: number;
    partnersSplit: any[];
}) {
    const [entradas, setEntradas] = useState<number | null>(null);
    const [saidas, setSaidas] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const id = projectId === "null" ? "null" : projectId;
        fetch(`/api/extrato?type=obra&id=${id}`)
            .then(r => r.json())
            .then((data: any) => {
                if (cancelled) return;
                const list: any[] = Array.isArray(data) ? data : (data?.transactions || []);
                const paidList = list.filter((t: any) => t.status === "Pago");

                const totalEntradas = paidList
                    .filter((t: any) => t.type === "Entrada" || t.type === "entrada")
                    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

                const totalSaidas = paidList
                    .filter((t: any) => t.type === "Sa_da" || t.type === "Saída" || t.type === "saida")
                    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

                setEntradas(totalEntradas);
                setSaidas(totalSaidas);
            })
            .catch(() => {
                if (!cancelled) {
                    setEntradas(null);
                    setSaidas(null);
                }
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    const saldo = entradas !== null && saidas !== null
        ? entradas - (soluxReserve || 0) - saidas
        : null;

    return (
        <div className="space-y-1.5">
            {contractValue !== undefined && (
                <div className="flex items-baseline gap-1.5 opacity-60">
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest w-20 shrink-0">Orçamento</span>
                    <span className="text-xs font-bold text-zinc-400">{fmtBRL(contractValue)}</span>
                </div>
            )}
            <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest w-20 shrink-0">Entradas</span>
                {loading
                    ? <span className="text-[11px] text-zinc-600 animate-pulse">…</span>
                    : <span className="text-[11px] font-bold text-emerald-400">{entradas !== null ? `+ ${fmtBRL(entradas)}` : "—"}</span>}
            </div>
            {soluxReserve !== undefined && soluxReserve > 0 && (
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest w-20 shrink-0">Reserva</span>
                    <span className="text-[11px] font-bold text-rose-400">- {fmtBRL(soluxReserve)}</span>
                </div>
            )}
            <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest w-20 shrink-0">Saídas</span>
                {loading
                    ? <span className="text-[11px] text-zinc-600 animate-pulse">…</span>
                    : <span className="text-[11px] font-bold text-rose-500">{saidas !== null ? `- ${fmtBRL(saidas)}` : "—"}</span>}
            </div>
            <div className="flex items-baseline gap-1.5 pt-1 border-t border-zinc-800/50 mt-1.5">
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest w-20 shrink-0">Saldo</span>
                {loading
                    ? <span className="text-[11px] text-zinc-600 animate-pulse">…</span>
                    : saldo !== null
                        ? <span className={`text-xs font-bold ${saldo >= 0 ? "text-emerald-400" : "text-rose-500"}`}>{fmtBRL(saldo)}</span>
                        : <span className="text-[11px] text-zinc-600">—</span>}
            </div>
            {partnersSplit.length > 0 && (
                <div className="flex gap-1 flex-wrap pt-1">
                    {partnersSplit.map((s: any, i: number) => (
                        <span key={i} className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{s.name} {s.percentage}%</span>
                    ))}
                </div>
            )}
        </div>
    );
}



export default function ConfiguracoesPage() {
    const [activeTab, setActiveTab] = useState("obras");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    // ── Extrato ───────────────────────────────────────────────────────────────
    const [extratoItem, setExtratoItem] = useState<any>(null);
    const [extratoType, setExtratoType] = useState<"obra" | "entidade" | null>(null);
    const [extratoTx, setExtratoTx] = useState<any[]>([]);
    const [extratoLoading, setExtratoLoading] = useState(false);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [listaCategorias, setListaCategorias] = useState<any[]>([]);
    const [listaEntidades, setListaEntidades] = useState<any[]>([]);
    const [listaProjetos, setListaProjetos] = useState<any[]>([]);
    // ── Entity filters ────────────────────────────────────────────────────────
    const [entSearchQuery, setEntSearchQuery] = useState("");
    const [entFilterType, setEntFilterType] = useState("todos");

    // ── Category form ─────────────────────────────────────────────────────────
    const [catName, setCatName] = useState("");
    const [catColor, setCatColor] = useState("#ef4444");
    const [catType, setCatType] = useState("saida");

    // ── Entity form ───────────────────────────────────────────────────────────
    const [entName, setEntName] = useState("");
    const [entType, setEntType] = useState("cliente");
    const [entEmail, setEntEmail] = useState("");
    const [entPhone, setEntPhone] = useState("");
    const [entDocument, setEntDocument] = useState("");

    // ── Project form ──────────────────────────────────────────────────────────
    const [projName, setProjName] = useState("");
    const [projClient, setProjClient] = useState("");
    const [projDesc, setProjDesc] = useState("");
    const [projValue, setProjValue] = useState("");
    const [projStatus, setProjStatus] = useState("negotiation");
    const [projSoluxReserve, setProjSoluxReserve] = useState("");
    const [projPartnersSplit, setProjPartnersSplit] = useState<any[]>([
        { name: "Matheus", percentage: "" },
        { name: "Sarah", percentage: "" },
        { name: "Maykon", percentage: "" }
    ]);

    const carregarDados = useCallback(async () => {
        setIsLoading(true);
        const [cats, ents, projs] = await Promise.all([
            getCategories(), getEntities(), getProjects()
        ]);
        if (cats.success) setListaCategorias(cats.data || []);
        if (ents.success) setListaEntidades(ents.data || []);
        if (projs.success) setListaProjetos(projs.data || []);
        setIsLoading(false);
    }, []);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    // ── Open extrato modal ──────────────────────────────────────
    const openExtrato = async (item: any, type: "obra" | "entidade") => {
        setExtratoItem(item);
        setExtratoType(type);
        setExtratoLoading(true);
        try {
            const res = await fetch(`/api/extrato?type=${type}&id=${item.id}`);
            const json = await res.json();
            setExtratoTx(json.transactions || []);
        } catch { setExtratoTx([]); }
        setExtratoLoading(false);
    };
    const closeExtrato = () => { setExtratoItem(null); setExtratoType(null); setExtratoTx([]); };

    const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


    const handleOpenModal = (item: any = null) => {
        setEditingItem(item);
        if (activeTab === "categorias") {
            setCatName(item?.name || "");
            setCatColor(item?.color || "#ef4444");
            setCatType(item ? (item.type === "Entrada" ? "entrada" : "saida") : "saida");
        } else if (activeTab === "entidades") {
            setEntName(item?.name || "");
            setEntType(item?.type || "cliente");
            setEntEmail(item?.email || "");
            setEntPhone(item?.phone || "");
            setEntDocument(item?.document || "");
        } else if (activeTab === "obras") {
            setProjName(item?.name || "");
            setProjClient(item?.client_name || "");
            setProjDesc(item?.description || "");
            setProjValue(item?.contract_value ? String(item.contract_value) : "");
            setProjStatus(item?.status || "negotiation");
            setProjSoluxReserve(item?.budget_solux_reserve ? String(item.budget_solux_reserve) : "");
            // Safely parse partners_split from DB (may come as string or array)
            const raw = item?.partners_split;
            let split: any[] = [];
            if (Array.isArray(raw)) split = raw;
            else if (typeof raw === "string") {
                try { split = JSON.parse(raw); } catch { split = []; }
            }
            setProjPartnersSplit(split.length > 0 ? split : []);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setEditingItem(null), 200);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        let response: any;

        if (activeTab === "categorias") {
            response = editingItem?.id
                ? await updateCategory(editingItem.id, { name: catName, color: catColor, type: catType })
                : await createCategory({ name: catName, color: catColor, type: catType });
        } else if (activeTab === "entidades") {
            const payload = {
                name: entName,
                type: entType, // lowercase — matches DB constraint
                email: entEmail || undefined,
                phone: entPhone || undefined,
                document: entDocument || undefined,
            };
            response = editingItem?.id
                ? await updateEntity(editingItem.id, payload)
                : await createEntity(payload);
        } else if (activeTab === "obras") {
            const payload = {
                name: projName,
                client_name: projClient || undefined,
                description: projDesc || undefined,
                contract_value: projValue ? parseFloat(projValue.replace(",", ".")) : undefined,
                budget_solux_reserve: projSoluxReserve ? parseFloat(projSoluxReserve.replace(",", ".")) : undefined,
                partners_split: projPartnersSplit.filter(p => p.percentage !== ""),
                status: projStatus,
            };
            response = editingItem?.id
                ? await updateProject(editingItem.id, payload)
                : await createProject(payload);
        }

        if (response?.success) {
            await carregarDados();
            handleCloseModal();
        } else {
            alert("Erro ao salvar: " + (response?.error || "Erro desconhecido"));
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (tab: string, id: string) => {
        if (!confirm("Excluir este item?")) return;
        let response;
        if (tab === "categorias") response = await deleteCategory(id);
        else if (tab === "entidades") response = await deleteEntity(id);
        else if (tab === "obras") response = await deleteProject(id);

        if (response && !response.success) {
            alert("Erro ao excluir: " + (response.error || "Erro desconhecido"));
        } else {
            await carregarDados();
        }
    };

    const isSaveDisabled = () => {
        if (activeTab === "categorias") return !catName;
        if (activeTab === "entidades") return !entName;
        if (activeTab === "obras") {
            if (!projName) return true;
            // Validate partners split sum = 100% if any is filled
            const total = projPartnersSplit.reduce((acc, p) => acc + (parseFloat(String(p.percentage).replace(",", ".")) || 0), 0);
            const hasAnyFilled = projPartnersSplit.some(p => p.percentage !== "");
            if (hasAnyFilled && Math.abs(total - 100) > 0.01) return true;
            return false;
        }
        return false;
    };

    const renderModalContent = () => {
        if (activeTab === "obras") return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Nome do Projeto / Obra *</Label>
                    <Input value={projName} onChange={e => setProjName(e.target.value)} placeholder="Ex: Edifício Omega Center" className="bg-zinc-900 border-zinc-800 h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Cliente</Label>
                        <Input value={projClient} onChange={e => setProjClient(e.target.value)} placeholder="Nome do cliente" className="bg-zinc-900 border-zinc-800 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Status</Label>
                        <Select value={projStatus} onValueChange={setProjStatus}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                {PROJECT_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Valor do Contrato</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-bold">R$</span>
                            <Input value={projValue} onChange={e => setProjValue(e.target.value)} placeholder="0,00" className="pl-9 bg-zinc-900 border-zinc-800 h-11 font-bold" />
                        </div>
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Descrição</Label>
                        <Input value={projDesc} onChange={e => setProjDesc(e.target.value)} placeholder="Detalhes do projeto..." className="bg-zinc-900 border-zinc-800 h-11" />
                    </div>

                    <div className="space-y-4 col-span-2 mt-4 pt-4 border-t border-zinc-800/80">
                        <div>
                            <p className="text-zinc-300 font-bold text-sm">Rateio Socieátrio da Obra</p>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">Configure o fundo de reserva da Solux e a divisão do lucro líquido</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Custo Operacional Fixo (Caixa Solux)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-bold">R$</span>
                                <Input value={projSoluxReserve} onChange={e => setProjSoluxReserve(e.target.value)} placeholder="0,00" className="pl-9 bg-zinc-900 border-zinc-800 h-11" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest flex justify-between">
                                <span>Participação dos Sócios (%)</span>
                                {(() => {
                                    const total = projPartnersSplit.reduce((acc, p) => acc + (parseFloat(String(p.percentage).replace(",", ".")) || 0), 0);
                                    if (total === 100) return <span className="text-emerald-500">100% Fechado</span>;
                                    if (total > 0 && total !== 100) return <span className="text-rose-500">Total: {total}% (Precisa ser 100%)</span>;
                                    return <span className="text-zinc-500">Opcional</span>;
                                })()}
                            </Label>
                            <div className="space-y-2">
                                {projPartnersSplit.map((partner, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <Input
                                            value={partner.name}
                                            onChange={e => {
                                                const newSplit = [...projPartnersSplit];
                                                newSplit[index] = { ...newSplit[index], name: e.target.value };
                                                setProjPartnersSplit(newSplit);
                                            }}
                                            placeholder="Nome do sócio"
                                            className="bg-zinc-950 border-zinc-800 h-9 flex-1 font-semibold"
                                        />
                                        <div className="relative w-24">
                                            <Input
                                                value={partner.percentage}
                                                onChange={e => {
                                                    const newSplit = [...projPartnersSplit];
                                                    newSplit[index] = { ...newSplit[index], percentage: e.target.value };
                                                    setProjPartnersSplit(newSplit);
                                                }}
                                                placeholder="0"
                                                className="bg-zinc-950 border-zinc-800 h-9 pr-7 text-center font-mono"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px] font-bold">%</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setProjPartnersSplit(prev => prev.filter((_, i) => i !== index))}
                                            className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setProjPartnersSplit(prev => [...prev, { name: "", percentage: "" }])}
                                    className="w-full h-9 border border-dashed border-zinc-700 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={13} /> Adicionar Sócio
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );

        if (activeTab === "categorias") return (
            <div className="space-y-5">
                <div className="space-y-2">
                    <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Nome da Categoria *</Label>
                    <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Manutenção de Equipamentos" className="bg-zinc-900 border-zinc-800 h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Cor Visual</Label>
                        <div className="grid grid-cols-6 gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setCatColor(color)}
                                    title={color}
                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${catColor === color ? "border-white scale-110" : "border-transparent hover:border-zinc-500"}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        <p className="text-[10px] text-zinc-600">Cor selecionada: <span className="font-mono" style={{ color: catColor }}>{catColor}</span></p>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Natureza</Label>
                        <Select value={catType} onValueChange={setCatType}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                <SelectItem value="entrada">📈 Receita / Entrada</SelectItem>
                                <SelectItem value="saida">📉 Despesa / Saída</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div className="w-8 h-8 rounded-md shrink-0" style={{ backgroundColor: catColor }} />
                    <div>
                        <p className="text-sm font-semibold text-zinc-200">{catName || "Nome da categoria"}</p>
                        <p className="text-[10px] text-zinc-500">{catType === "entrada" ? "Receita / Entrada" : "Despesa / Saída"}</p>
                    </div>
                </div>
            </div>
        );

        if (activeTab === "entidades") return (
            <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Razão Social / Nome *</Label>
                        <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="Nome completo" className="bg-zinc-900 border-zinc-800 h-11" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Tipo</Label>
                        <Select value={entType} onValueChange={setEntType}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 h-11"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                {ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">CPF / CNPJ</Label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                            <Input value={entDocument} onChange={e => setEntDocument(e.target.value)} placeholder="00.000.000/0000-00" className="pl-9 bg-zinc-900 border-zinc-800 h-11 font-mono" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">E-mail</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                            <Input type="email" value={entEmail} onChange={e => setEntEmail(e.target.value)} placeholder="financeiro@empresa.com" className="pl-9 bg-zinc-900 border-zinc-800 h-11" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-zinc-400 uppercase text-[10px] font-bold tracking-widest">Telefone</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                            <Input value={entPhone} onChange={e => setEntPhone(e.target.value)} placeholder="(27) 99999-9999" className="pl-9 bg-zinc-900 border-zinc-800 h-11" />
                        </div>
                    </div>
                </div>
            </div>
        );
        return null;
    };

    const newLabel = activeTab === "obras" ? "Nova Obra" : activeTab === "categorias" ? "Nova Categoria" : "Novo Cliente";

    return (
        <div className="p-4 md:p-8 min-h-full bg-zinc-950 text-white font-sans">
            <div className="flex flex-wrap justify-between items-end mb-10 gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="h-1 w-8 bg-[#0056b3] rounded-full" />
                        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Base de Parâmetros</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-[#0056b3] hover:bg-[#004494] text-xs font-bold uppercase tracking-widest px-8 py-6 gap-2 shadow-[0_10px_20px_rgba(0,86,179,0.2)]">
                    <Plus size={18} /> {newLabel}
                </Button>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="bg-zinc-950 border border-zinc-800 text-white max-w-lg p-0 overflow-hidden flex flex-col shadow-2xl max-h-[85vh]">
                        <DialogHeader className="p-8 border-b border-zinc-900 bg-zinc-900/30 shrink-0">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3 tracking-tight">
                                {editingItem ? <Pencil size={22} className="text-[#0056b3]" /> : <Plus size={22} className="text-[#0056b3]" />}
                                {editingItem ? "Editar" : newLabel}
                            </DialogTitle>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                                {editingItem ? `Editando: ${editingItem.name}` : "Preencha os campos abaixo"}
                            </p>
                        </DialogHeader>
                        <div className="p-8 flex-1 overflow-y-auto">{renderModalContent()}</div>
                        <DialogFooter className="p-8 border-t border-zinc-900 bg-zinc-900/30 shrink-0">
                            <Button variant="ghost" onClick={handleCloseModal} className="text-zinc-500 hover:text-white">Cancelar</Button>
                            <Button onClick={handleSave} disabled={isSubmitting || isSaveDisabled()} className="flex-1 bg-[#0056b3] hover:bg-[#004494] font-bold uppercase text-xs tracking-widest py-6 gap-2 disabled:opacity-50">
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                {isSubmitting ? "Salvando..." : editingItem ? "Salvar Alterações" : "Concluir Cadastro"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="obras" onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-zinc-900/80 border border-zinc-800 p-1.5 mb-10 h-14 flex gap-2 w-full max-w-2xl rounded-xl">
                    {[
                        { value: "obras", label: "Centros de Custo", icon: Landmark },
                        { value: "categorias", label: "Categorias", icon: Tag },
                        { value: "entidades", label: "Clientes / Fornecedores", icon: Users },
                    ].map(({ value, label, icon: Icon }) => (
                        <TabsTrigger key={value} value={value} className="flex-1 gap-2 text-white/50 font-bold uppercase text-[10px] tracking-wider data-[state=active]:bg-[#0056b3] data-[state=active]:text-white rounded-lg">
                            <Icon size={15} /> {label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ── Obras/Projetos ── */}
                <TabsContent value="obras" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-3 flex justify-center py-10 text-zinc-500"><Loader2 className="animate-spin mr-2" /> Carregando...</div>
                    ) : (
                        [
                            { id: "null", name: "Centro de Custo Solux", status: "active", client_name: "Administrativo & Sede", is_default: true },
                            ...listaProjetos
                        ].map(p => {
                            const parsedSplit = typeof p.partners_split === "string" ? (() => { try { return JSON.parse(p.partners_split); } catch { return []; } })() : (Array.isArray(p.partners_split) ? p.partners_split : []);
                            return (
                                <div key={p.id} className="relative bg-zinc-900/20 border border-zinc-800 p-5 rounded-xl hover:border-blue-500/40 transition-all group cursor-pointer" onClick={() => !p.is_default && handleOpenModal(p)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${p.is_default ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
                                            <Building2 size={18} />
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "text-zinc-400 bg-zinc-800"}`}>
                                            {STATUS_LABELS[p.status] || p.status}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-white text-sm leading-tight">{p.name}</h3>
                                    {p.client_name && <p className="text-[10px] text-zinc-500 mt-0.5 mb-2">{p.client_name}</p>}

                                    {/* Financial summary */}
                                    <ProjectFinancialSummary
                                        projectId={p.id}
                                        contractValue={p.contract_value ? Number(p.contract_value) : undefined}
                                        soluxReserve={p.budget_solux_reserve ? Number(p.budget_solux_reserve) : undefined}
                                        partnersSplit={parsedSplit}
                                    />

                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                                        <button onClick={e => { e.stopPropagation(); openExtrato(p, "obra"); }} title="Extrato" className="w-6 h-6 rounded bg-zinc-800 hover:bg-blue-900 flex items-center justify-center text-zinc-400 hover:text-blue-400"><FileText size={11} /></button>
                                        {!p.is_default && (
                                            <>
                                                <button onClick={e => { e.stopPropagation(); handleOpenModal(p); }} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white">
                                                    <Pencil size={11} />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete("obras", p.id); }} className="w-6 h-6 rounded bg-zinc-800 hover:bg-rose-900 flex items-center justify-center text-zinc-400 hover:text-rose-400">
                                                    <Trash2 size={11} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </TabsContent>

                {/* ── Categorias ── */}
                <TabsContent value="categorias" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {isLoading ? (
                        <div className="col-span-3 flex justify-center py-10 text-zinc-500"><Loader2 className="animate-spin mr-2" /> Carregando...</div>
                    ) : listaCategorias.length === 0 ? (
                        <div className="col-span-3 text-center py-10 text-zinc-500">Nenhuma categoria encontrada.</div>
                    ) : (
                        listaCategorias.map(cat => (
                            <div key={cat.id} onClick={() => handleOpenModal(cat)} style={{ borderLeftColor: cat.color || "#ef4444" }} className="bg-zinc-900/20 border-l-4 border-y border-r border-zinc-800 p-4 rounded-r-xl flex justify-between items-center group hover:bg-zinc-900/40 cursor-pointer transition-all">
                                <div>
                                    <h3 className="font-bold text-white text-sm">{cat.name}</h3>
                                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-1">
                                        {cat.type === "Entrada" ? "Receita / Entrada" : "Despesa / Saída"}
                                    </p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(cat); }} className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete("categorias", cat.id); }} className="w-8 h-8 rounded bg-zinc-800 hover:bg-rose-900/60 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </TabsContent>

                {/* ── Entidades ── */}
                <TabsContent value="entidades" className="space-y-4">
                    {/* Filtro por tipo — pills */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: "todos", label: "Todos" },
                            { value: "cliente", label: "Clientes" },
                            { value: "fornecedor", label: "Fornecedores" },
                            { value: "subcontratado", label: "Subcontratados" },
                            { value: "parceiro", label: "Parceiros" },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setEntFilterType(opt.value)}
                                className={[
                                    "h-8 px-4 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
                                    entFilterType === opt.value
                                        ? "bg-[#0056b3] text-white border-blue-600"
                                        : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300",
                                ].join(" ")}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(() => {
                            const filtered = listaEntidades
                                .filter(e => entFilterType === "todos" || e.type === entFilterType);
                            if (isLoading) return <div className="col-span-3 flex justify-center py-10 text-zinc-500"><Loader2 className="animate-spin mr-2" /> Carregando...</div>;
                            if (filtered.length === 0) return (
                                <div className="col-span-3 text-center py-12 text-zinc-500">
                                    <Users size={32} className="mx-auto mb-3 text-zinc-700" />
                                    <p>Nenhum resultado encontrado.</p>
                                </div>
                            );
                            const typeLabel: Record<string, string> = { cliente: "Cliente", fornecedor: "Fornecedor", subcontratado: "Subcontratado", parceiro: "Parceiro" };
                            return filtered.map(ent => (
                                <div key={ent.id} className="relative bg-zinc-900/20 border border-zinc-800 p-5 rounded-xl hover:border-blue-500/40 transition-all group cursor-pointer" onClick={() => handleOpenModal(ent)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Users size={18} />
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                                            {typeLabel[ent.type] || ent.type || "Cliente"}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-white text-sm">{ent.name}</h3>
                                    {ent.email && <p className="text-[10px] text-zinc-500 mt-1 truncate">{ent.email}</p>}
                                    {ent.phone && <p className="text-[10px] text-zinc-600 truncate">{ent.phone}</p>}
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                                        <button onClick={e => { e.stopPropagation(); openExtrato(ent, "entidade"); }} title="Extrato" className="w-6 h-6 rounded bg-zinc-800 hover:bg-blue-900 flex items-center justify-center text-zinc-400 hover:text-blue-400"><FileText size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); handleOpenModal(ent); }} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"><Pencil size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete("entidades", ent.id); }} className="w-6 h-6 rounded bg-zinc-800 hover:bg-rose-900 flex items-center justify-center text-zinc-400 hover:text-rose-400"><Trash2 size={11} /></button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ── Modal de Extrato ───────────────────────────────────────────── */}
            {extratoItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeExtrato}>
                    <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
                            <div>
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <FileText size={16} className="text-blue-400" /> Extrato — {extratoItem.name}
                                </h3>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{extratoType === "obra" ? "Centro de Custo" : "Cliente / Fornecedor"} · Lançamentos vinculados</p>
                            </div>
                            <button onClick={closeExtrato} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800"><X size={16} /></button>
                        </div>
                        {(() => {
                            const entradas = extratoTx.filter(t => t.type === "Entrada").reduce((a, t) => a + t.amount, 0);
                            const saidas = extratoTx.filter(t => t.type !== "Entrada").reduce((a, t) => a + t.amount, 0);
                            const saldo = entradas - saidas;
                            return (
                                <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800 shrink-0">
                                    <div className="bg-zinc-950 px-4 py-3 text-center">
                                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest flex justify-center items-center gap-1"><ArrowUpCircle size={10} className="text-emerald-400" />Entradas</p>
                                        <p className="text-sm font-extrabold text-emerald-400">{formatBRL(entradas)}</p>
                                    </div>
                                    <div className="bg-zinc-950 px-4 py-3 text-center">
                                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest flex justify-center items-center gap-1"><ArrowDownCircle size={10} className="text-rose-400" />Saídas</p>
                                        <p className="text-sm font-extrabold text-rose-400">{formatBRL(saidas)}</p>
                                    </div>
                                    <div className="bg-zinc-950 px-4 py-3 text-center">
                                        <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Saldo</p>
                                        <p className={`text-sm font-extrabold ${saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatBRL(saldo)}</p>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
                            {extratoLoading ? (
                                <div className="flex items-center justify-center py-12 text-zinc-500 gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Carregando...</div>
                            ) : extratoTx.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2"><FileText size={24} /><p className="text-sm">Nenhum lançamento vinculado</p></div>
                            ) : (
                                extratoTx.map(tx => {
                                    const isEntrada = tx.type === "Entrada";
                                    return (
                                        <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/40 transition-colors">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isEntrada ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                                                {isEntrada ? <ArrowUpCircle size={13} className="text-emerald-400" /> : <ArrowDownCircle size={13} className="text-rose-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-200 truncate">{tx.name}</p>
                                                <p className="text-[10px] text-zinc-500">
                                                    {tx.due_date ? new Date(tx.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                                                    {tx.category && <> · {tx.category.name}</>}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${isEntrada ? "text-emerald-400" : "text-rose-400"}`}>{isEntrada ? "+" : "-"}{formatBRL(tx.amount)}</p>
                                                <p className="text-[9px] text-zinc-600 uppercase">{tx.status}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
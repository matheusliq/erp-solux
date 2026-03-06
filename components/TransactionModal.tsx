"use client";

/**
 * Shared TransactionModal — used by Inbox (/app/inbox) and Kanban (/app/lancamentos).
 * Extracted from page files to reduce per-page bundle size.
 */

import { useState, useEffect, useRef } from "react";
import {
    Calculator, Check, Loader2, CalendarIcon, X, HandCoins, Copy, CheckCheck,
    Paperclip, UploadCloud, CheckCircle2, Trash
} from "lucide-react";
import CalendarPicker from "@/components/CalendarPicker";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createTransaction, updateTransaction } from "@/app/actions/transactions";
import { supabase } from "@/lib/supabase";

const TAX_MARKER = "[IMPOSTO]";

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);

function inferStatus(dateISO: string, mode: "real" | "planejado"): string {
    if (mode === "planejado") return "Agendado";
    if (!dateISO) return "Pago";
    const today = todayISO();
    if (dateISO > today) return "Agendado";
    if (dateISO < today) return "Atrasado";
    return "Pago"; // today
}

// ── Minimal date-picker field with CalendarPicker popover ────────────────────
function formatDisplayDate(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function DatePickerField({
    value, onChange, placeholder = "DD/MM/AAAA", label = "Selecionar data"
}: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full h-10 flex items-center justify-between px-3 rounded-lg border bg-card text-sm transition-colors ${open ? "border-blue-500 text-zinc-200" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon size={14} className="text-zinc-600" />
                    <span className={value ? "text-zinc-200" : "text-zinc-600"}>{value ? formatDisplayDate(value) : placeholder}</span>
                </div>
                {value && (
                    <X size={12} className="text-zinc-600 hover:text-zinc-300" onClick={e => { e.stopPropagation(); onChange(""); }} />
                )}
            </button>
            {open && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 z-[200] max-w-[calc(100vw-2rem)] sm:max-w-none bg-[#0d0f12] border border-zinc-800 rounded-xl shadow-2xl p-3" style={{ width: "260px" }}>
                    <CalendarPicker
                        value={value}
                        onChange={v => { onChange(v); setOpen(false); }}
                    />
                </div>
            )}
        </div>
    );
}



export interface Category {
    id: string; name: string; color: string; type: string;
}

export interface Project {
    id: string; name: string;
}

export interface Entity {
    id: string; name: string;
}

export interface TransactionForModal {
    id: string; name: string; amount: number; type: string; status: string;
    due_date: string; notes: string | null;
    categories: { id: string; name: string; color: string; type: string } | null;
    entities?: { id: string; name: string } | null;
    projects?: { id: string; name: string } | null;
    receipt_url?: string | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    categories: Category[];
    projects: Project[];
    entities?: Entity[];
    editTx: TransactionForModal | null;
    /** "real" hides "Agendado" option; "planejado" forces Agendado */
    mode?: "real" | "planejado";
}

export default function TransactionModal({ open, onClose, onSaved, categories, projects, entities = [], editTx, mode = "real" }: Props) {
    const isEdit = !!editTx;
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isTax, setIsTax] = useState(false);
    const [isReimbursement, setIsReimbursement] = useState(false);
    const [reimbursementPerson, setReimbursementPerson] = useState("");
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "", amount: "", type: "saida", status: "Pago",
        due_date: "", payment_date: "", category_id: "", project_id: "", entity_id: "", notes: "",
    });

    const handleCopyId = () => {
        if (!editTx) return;
        navigator.clipboard.writeText(editTx.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        if (!open) return;
        if (isEdit && editTx) {
            const notesRaw = editTx.notes || "";
            const isReimbursed = notesRaw.includes("[REEMBOLSO:");
            let person = "";
            let cleanedNotes = notesRaw.replace(TAX_MARKER, "").trim();
            if (isReimbursed) {
                const match = cleanedNotes.match(/\[REEMBOLSO:(.*?)\]/);
                if (match) person = match[1];
                cleanedNotes = cleanedNotes.replace(/\[REEMBOLSO:.*?\]/g, "").trim();
            }

            setIsReimbursement(isReimbursed);
            setReimbursementPerson(person);
            setForm({
                name: editTx.name,
                amount: String(editTx.amount),
                type: editTx.type === "Entrada" ? "entrada" : "saida",
                status: editTx.status,
                due_date: editTx.due_date || "",
                payment_date: "",
                category_id: editTx.categories?.id || "",
                project_id: editTx.projects?.id || "",
                entity_id: editTx.entities?.id || "",
                notes: cleanedNotes,
            });
        } else {
            setIsTax(false);
            setIsReimbursement(false);
            setReimbursementPerson("");
            setCopied(false);
            setReceiptUrl(null);
            const defaultDate = todayISO();
            setForm({
                name: "", amount: "",
                type: "saida",
                status: inferStatus(defaultDate, mode),
                due_date: defaultDate, payment_date: "", category_id: "", project_id: "", entity_id: "", notes: "",
            });
        }
    }, [editTx, open, mode]);

    const filteredCategories = categories.filter(c =>
        form.type === "entrada" ? c.type === "Entrada" : c.type !== "Entrada"
    );

    const statusOptions = mode === "planejado"
        ? [{ value: "Agendado", label: "📅 Agendado" }]
        : [
            { value: "Pago", label: "✅ Pago" },
            { value: "Agendado", label: "📅 Agendado" },
            { value: "Atrasado", label: "⚠️ Atrasado" },
            { value: "Cancelado", label: "❌ Cancelado" },
        ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingReceipt(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Assumimos que existe um bucket chamado 'receipts' público ou anon
            const { data, error } = await supabase.storage
                .from('receipts')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(filePath);

            setReceiptUrl(publicUrl);
        } catch (err) {
            console.error("Erro ao subir anexo:", err);
            alert("Falha ao subir arquivo. Tem certeza que o bucket 'receipts' existe no Supabase?");
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleStatusChange = (v: string) => {
        if (v === "Pago" && !receiptUrl) {
            alert("Você precisa anexar um comprovante (NF ou recibo) para marcar este lançamento como Pago.");
            return;
        }
        setForm({ ...form, status: v });
    };

    const handleSave = async () => {
        if (!form.name || !form.amount || !form.due_date) return;
        setSaving(true);
        const payload = {
            name: form.name,
            amount: parseFloat(form.amount.replace(",", ".")),
            type: form.type,
            status: form.status,
            due_date: form.due_date,
            payment_date: form.payment_date || undefined,
            category_id: form.category_id || undefined,
            project_id: form.project_id || undefined,
            entity_id: form.entity_id || undefined,
            notes: [
                isTax ? TAX_MARKER : "",
                isReimbursement && reimbursementPerson && form.type === "saida" ? `[REEMBOLSO:${reimbursementPerson}]` : "",
                form.notes || ""
            ].filter(Boolean).join(" ") || undefined,
            is_tax: isTax,
            receipt_url: receiptUrl || undefined,
        };
        try {
            if (isEdit && editTx) {
                await updateTransaction(editTx.id, payload as any);
            } else {
                await createTransaction(payload);
            }
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-background border border-zinc-800 text-foreground max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-0 rounded-xl shadow-2xl">
                <DialogHeader className="p-6 border-b border-zinc-800 bg-card/50 flex flex-row justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                    <DialogTitle className="text-xl font-bold">
                        {isEdit ? "Editar Lançamento" : mode === "planejado" ? "Novo Lançamento Planejado" : "Novo Lançamento"}
                    </DialogTitle>
                    {isEdit && editTx && (
                        <button
                            onClick={handleCopyId}
                            title="Clique para copiar o ID"
                            className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${copied
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50"
                                }`}
                        >
                            <span className="font-bold uppercase tracking-wider text-[9px] opacity-70">ID</span>
                            <span className="max-w-[120px] truncate">{editTx.id}</span>
                            {copied
                                ? <CheckCheck size={12} className="text-emerald-400 shrink-0" />
                                : <Copy size={12} className="shrink-0 opacity-60" />}
                        </button>
                    )}
                </DialogHeader>
                <div className="p-6 space-y-5">
                    {/* Tax and Reimbursement Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between bg-card border border-zinc-800 p-4 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Calculator className={isTax ? "text-amber-500" : "text-zinc-500"} size={18} />
                                <div>
                                    <Label className="text-sm font-bold text-zinc-200">Deconto (Imposto)?</Label>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Cálculo líquido</p>
                                </div>
                            </div>
                            <Switch checked={isTax} onCheckedChange={setIsTax} className="data-[state=checked]:bg-amber-500" />
                        </div>
                        {form.type === "saida" && (
                            <div className={`flex flex-col justify-center bg-card border border-zinc-800 p-3 rounded-lg transition-colors ${isReimbursement ? "border-indigo-500/50 bg-indigo-500/5" : ""}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <HandCoins className={isReimbursement ? "text-indigo-400" : "text-zinc-500"} size={18} />
                                        <div>
                                            <Label className="text-sm font-bold text-zinc-200">É um reembolso?</Label>
                                        </div>
                                    </div>
                                    <Switch checked={isReimbursement} onCheckedChange={setIsReimbursement} className="data-[state=checked]:bg-indigo-500" />
                                </div>
                                {isReimbursement && (
                                    <Select value={reimbursementPerson} onValueChange={setReimbursementPerson}>
                                        <SelectTrigger className="h-8 text-xs bg-background border-zinc-800"><SelectValue placeholder="Sócio favorecido..." /></SelectTrigger>
                                        <SelectContent className="bg-card border-zinc-800 text-foreground">
                                            <SelectItem value="Matheus">Matheus</SelectItem>
                                            <SelectItem value="Maykon">Maykon</SelectItem>
                                            <SelectItem value="Sarah">Sarah</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Tipo</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category_id: "" })}>
                                <SelectTrigger className="bg-card border-zinc-800 h-10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-zinc-800 text-foreground">
                                    <SelectItem value="entrada">💰 Entrada</SelectItem>
                                    <SelectItem value="saida">💸 Saída</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Status</Label>
                            <Select value={form.status} onValueChange={handleStatusChange}>
                                <SelectTrigger className={`bg-card border-zinc-800 h-10 ${form.status === "Pago" && !receiptUrl ? "border-rose-500 text-rose-400" : ""}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-zinc-800 text-foreground">
                                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.status === "Pago" && !receiptUrl && (
                                <p className="text-[9px] text-rose-400 font-bold mt-1">Requer anexo para salvar</p>
                            )}
                        </div>
                        {/* Name */}
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Nome *</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pagamento fornecedor X" className="bg-card border-zinc-800 h-10 placeholder:text-zinc-600" />
                        </div>
                        {/* Amount */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Valor *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">R$</span>
                                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="pl-10 bg-card border-zinc-800 h-10 font-bold text-blue-400" />
                            </div>
                        </div>
                        {/* Category */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">
                                Categoria <span className="normal-case font-normal text-zinc-600">({form.type === "entrada" ? "Entradas" : "Saídas"})</span>
                            </Label>
                            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                                <SelectTrigger className="bg-card border-zinc-800 h-10 text-zinc-400"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                                <SelectContent className="bg-card border-zinc-800 text-foreground">
                                    {filteredCategories.length === 0
                                        ? <div className="py-3 text-center text-xs text-zinc-500">Nenhuma categoria disponível</div>
                                        : filteredCategories.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                    {c.name}
                                                </span>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Cost Center */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Centro de Custo</Label>
                            <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                                <SelectTrigger className="bg-card border-zinc-800 h-10 text-zinc-400">
                                    <SelectValue placeholder="Geral / Nenhum" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-zinc-800 text-foreground">
                                    <SelectItem value="none">Centro de Custo Solux</SelectItem>
                                    {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Entity (Destinatário/Cliente) */}
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Destinatário / Cliente</Label>
                            <Select value={form.entity_id} onValueChange={(v) => setForm({ ...form, entity_id: v === "none" ? "" : v })}>
                                <SelectTrigger className="bg-card border-zinc-800 h-10 text-zinc-400">
                                    <SelectValue placeholder="Opcional" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-zinc-800 text-foreground">
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Due date */}
                        <div className="space-y-1.5 relative">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Data de Vencimento *</Label>
                            <DatePickerField
                                value={form.due_date}
                                onChange={v => {
                                    const newStatus = !isEdit ? inferStatus(v, mode) : form.status;
                                    setForm({ ...form, due_date: v, status: newStatus });
                                }}
                                placeholder="DD/MM/AAAA"
                                label="Selecionar data"
                            />
                        </div>
                        {/* Payment date */}
                        <div className="space-y-1.5 relative">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Data de Pagamento</Label>
                            <DatePickerField
                                value={form.payment_date}
                                onChange={v => setForm({ ...form, payment_date: v })}
                                placeholder="DD/MM/AAAA"
                                label="Selecionar data"
                            />
                        </div>
                        {/* Anexo de Documento / Comprovante */}
                        <div className="col-span-2 space-y-1.5 mt-2">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Anexo (NF / Comprovante) {form.status === "Pago" && <span className="text-rose-400 font-bold ml-1">*Obrigatório</span>}</Label>

                            {!receiptUrl ? (
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        disabled={uploadingReceipt}
                                        onChange={handleFileUpload}
                                    />
                                    <div className={`flex items-center justify-center gap-2 h-16 border-2 border-dashed rounded-xl transition-colors ${uploadingReceipt ? "border-blue-500/50 bg-blue-500/5 text-blue-400" : "border-zinc-800 bg-card/50 text-zinc-500 group-hover:bg-zinc-800/80 group-hover:border-zinc-700"}`}>
                                        {uploadingReceipt ? (
                                            <><Loader2 size={16} className="animate-spin" /> <span className="text-xs font-bold">Enviando anexo...</span></>
                                        ) : (
                                            <><UploadCloud size={18} /> <span className="text-xs font-medium">Clique ou arraste um arquivo (PDF/Imagem)</span></>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/5 p-3 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <Paperclip size={14} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Anexo Confirmado</p>
                                            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-400 hover:text-emerald-300 transition-colors underline underline-offset-2">Visualizar arquivo</a>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setReceiptUrl(null)}
                                        className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="Remover anexo"
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Notes */}
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-[11px] font-bold text-zinc-500 uppercase">Observações</Label>
                            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="..." className="bg-card border-zinc-800 resize-none h-16 placeholder:text-zinc-700" />
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-card/50 border-t border-zinc-800 sticky bottom-0 backdrop-blur-sm gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-zinc-500 hover:text-foreground hover:bg-zinc-800 font-bold uppercase text-[11px]">Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !form.name || !form.amount || !form.due_date || (form.status === "Pago" && !receiptUrl)}
                        className={`h-11 px-8 font-bold uppercase text-[11px] tracking-widest ${isTax ? "bg-amber-600 hover:bg-amber-700" : "bg-[#0056b3] hover:bg-[#004494]"} text-foreground disabled:opacity-50`}
                    >
                        {saving ? <><Loader2 size={15} className="animate-spin mr-2" />Salvando...</> : <><Check size={15} className="mr-2" />{isEdit ? "Salvar Alterações" : isTax ? "Confirmar Imposto" : "Salvar Lançamento"}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

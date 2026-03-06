import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, X, ChevronRight, CheckCircle2, Clock, HandCoins } from "lucide-react";

interface Transaction {
    id: string;
    name: string;
    amount: number;
    status: string;
    notes: string | null;
    due_date?: string;
}

interface ReembolsoModalProps {
    open: boolean;
    onClose: () => void;
    reembolsos: Transaction[];
}

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ReembolsoModal({ open, onClose, reembolsos }: ReembolsoModalProps) {
    // Organiza por sócio
    const socios = ["Sarah", "Matheus", "Maykon"];
    const [selectedSocio, setSelectedSocio] = useState<string | null>(null);

    // Agrupa dados
    const dataBySocio = socios.map(socio => {
        const txs = reembolsos.filter(t => t.notes?.includes(`[REEMBOLSO:${socio}]`));
        const pendentes = txs.filter(t => t.status !== "Pago");
        const recebidos = txs.filter(t => t.status === "Pago");

        const valorPendente = pendentes.reduce((a, t) => a + t.amount, 0);
        const valorRecebido = recebidos.reduce((a, t) => a + t.amount, 0);

        return {
            name: socio,
            txs,
            pendentes,
            recebidos,
            valorPendente,
            valorRecebido
        };
    });

    const activeData = selectedSocio ? dataBySocio.find(d => d.name === selectedSocio) : null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="bg-background border border-zinc-800 text-foreground max-w-3xl max-h-[85vh] overflow-hidden p-0 rounded-2xl shadow-2xl flex flex-col">
                <DialogHeader className="p-6 border-b border-zinc-800 bg-card/50 flex flex-row justify-between items-center shrink-0">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <HandCoins className="text-indigo-400" /> Detalhamento de Reembolsos
                        </DialogTitle>
                        <p className="text-xs text-zinc-500 mt-1">Saldos pendentes e recebidos por sócio</p>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Resumo Societário (Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {dataBySocio.map(d => (
                            <div
                                key={d.name}
                                onClick={() => setSelectedSocio(d.name === selectedSocio ? null : d.name)}
                                className={`border rounded-xl p-5 cursor-pointer transition-all ${selectedSocio === d.name
                                        ? "bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30"
                                        : "bg-card/40 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50"
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-zinc-200">{d.name}</h3>
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/20">
                                        {d.name.substring(0, 2).toUpperCase()}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">A Receber</p>
                                        <p className="text-xl font-black text-rose-400">{formatBRL(d.valorPendente)}</p>
                                    </div>
                                    <div className="border-t border-zinc-800 pt-3">
                                        <p className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Já Recebido</p>
                                        <p className="text-sm font-bold text-emerald-400">{formatBRL(d.valorRecebido)}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                                    <ChevronRight size={14} className={selectedSocio === d.name ? "rotate-90 transition-transform" : "transition-transform"} />
                                    {selectedSocio === d.name ? "Ocultar extrato" : "Ver extrato"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Extrato Detalhado do Sócio Selecionado */}
                    {activeData && (
                        <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                            <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                                Extrato Detalhado: <span className="text-indigo-400">{activeData.name}</span>
                            </h3>

                            {activeData.txs.length === 0 ? (
                                <div className="bg-card/30 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-sm">
                                    Nenhum reembolso registrado para este sócio.
                                </div>
                            ) : (
                                <div className="bg-card/30 border border-zinc-800 rounded-xl overflow-hidden">
                                    <div className="grid grid-cols-[1fr_120px_100px_80px] px-4 py-3 border-b border-zinc-800 bg-card/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        <span>Descrição</span>
                                        <span>Valor</span>
                                        <span>Data</span>
                                        <span>Status</span>
                                    </div>
                                    <div className="divide-y divide-zinc-800/50">
                                        {activeData.txs.sort((a, b) => (b.due_date || "").localeCompare(a.due_date || "")).map(tx => (
                                            <div key={tx.id} className="grid grid-cols-[1fr_120px_100px_80px] items-center px-4 py-3 group hover:bg-zinc-800/20 transition-colors">
                                                <div className="min-w-0 pr-4">
                                                    <p className="text-sm font-semibold text-zinc-200 truncate">{tx.name}</p>
                                                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5" title="ID da Transação">#{tx.id}</p>
                                                </div>
                                                <span className="text-sm font-bold text-zinc-300">{formatBRL(tx.amount)}</span>
                                                <span className="text-xs text-zinc-400">
                                                    {tx.due_date ? new Date(tx.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                                                </span>
                                                <div>
                                                    {tx.status === "Pago" ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                                                            <CheckCircle2 size={10} /> Pago
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                                                            <Clock size={10} /> {tx.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

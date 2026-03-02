/**
 * Iago Agent — Tool definitions and handlers for Gemini Function Calling
 *
 * Each tool has:
 *  - declaration: the JSON schema sent to the Gemini API
 *  - handler: the server-side function that executes the action
 */

import prisma from "@/lib/prisma";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Normalise date string: accept "hoje", "amanhã", relative or ISO. */
function resolveDate(raw: string): string {
    const today = new Date();
    const lower = raw.toLowerCase().trim();
    if (lower === "hoje") {
        // noop
    } else if (lower === "amanhã" || lower === "amanha") {
        today.setDate(today.getDate() + 1);
    } else if (lower === "ontem") {
        today.setDate(today.getDate() - 1);
    } else {
        // Try parsing ISO or common formats
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) return raw.slice(0, 10);
    }
    return today.toISOString().slice(0, 10);
}

/** Map "entrada"/"saída"/negative signals to DB enum */
function resolveType(type: string): "Entrada" | "Sa_da" {
    const t = type.toLowerCase();
    if (t === "entrada" || t === "income" || t === "receita") return "Entrada";
    return "Sa_da";
}

const sanitize = (t: any) => ({
    ...t,
    amount: t.amount ? Number(t.amount) : 0,
    due_date: t.due_date ? t.due_date.toISOString().split("T")[0] : null,
    payment_date: t.payment_date ? t.payment_date.toISOString().split("T")[0] : null,
    created_at: t.created_at ? t.created_at.toISOString() : null,
    updated_at: t.updated_at ? t.updated_at.toISOString() : null,
    categories: t.categories
        ? { ...t.categories, monthly_budget: t.categories.monthly_budget ? Number(t.categories.monthly_budget) : null }
        : null,
});

// ─── Tool Declarations (sent to Gemini) ──────────────────────────────────────
export const TOOL_DECLARATIONS = [
    {
        name: "list_transactions",
        description:
            "Lista/busca lançamentos financeiros do sistema com filtros opcionais. Use para responder perguntas sobre transações, listar atrasados, filtrar por categoria, período, etc.",
        parameters: {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    enum: ["todos", "entrada", "saida"],
                    description: "Filtrar por tipo de lançamento",
                },
                status: {
                    type: "string",
                    enum: ["todos", "Pago", "Atrasado", "Cancelado", "Agendado"],
                    description: "Filtrar pelo status do lançamento",
                },
                category_name: {
                    type: "string",
                    description: "Filtrar por nome de categoria (busca parcial)",
                },
                start_date: {
                    type: "string",
                    description: "Data de início (YYYY-MM-DD) para filtro de vencimento",
                },
                end_date: {
                    type: "string",
                    description: "Data de fim (YYYY-MM-DD) para filtro de vencimento",
                },
                search: {
                    type: "string",
                    description: "Busca textual no nome/descrição do lançamento",
                },
                limit: {
                    type: "number",
                    description: "Máximo de resultados (padrão: 50)",
                },
            },
            required: [],
        },
    },
    {
        name: "create_transaction",
        description:
            "Cria um novo lançamento financeiro. Valor negativo indica automaticamente Saída. Se o tipo não for especificado, infira pelo contexto da conversa.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Nome/descrição do lançamento" },
                amount: {
                    type: "number",
                    description: "Valor em reais. Pode ser negativo — nesse caso será tratado como Saída",
                },
                type: {
                    type: "string",
                    enum: ["entrada", "saida"],
                    description: "Tipo do lançamento. Inferido automaticamente se amount < 0",
                },
                due_date: {
                    type: "string",
                    description: "Data de vencimento. Aceita 'hoje', 'amanhã', 'ontem' ou YYYY-MM-DD",
                },
                status: {
                    type: "string",
                    enum: ["Pago", "Agendado", "Atrasado", "Cancelado"],
                    description: "Status do lançamento. Padrão: 'Pago' se data passada, 'Agendado' se futura",
                },
                category_name: {
                    type: "string",
                    description: "Nome da categoria (busca aproximada no banco)",
                },
                notes: { type: "string", description: "Observações adicionais" },
            },
            required: ["name", "amount", "due_date"],
        },
    },
    {
        name: "update_transaction",
        description: "Atualiza um lançamento existente pelo ID.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID do lançamento a ser atualizado" },
                name: { type: "string" },
                amount: { type: "number" },
                type: { type: "string", enum: ["entrada", "saida"] },
                due_date: { type: "string" },
                status: { type: "string", enum: ["Pago", "Agendado", "Atrasado", "Cancelado"] },
                category_name: { type: "string" },
                notes: { type: "string" },
            },
            required: ["id"],
        },
    },
    {
        name: "delete_transaction",
        description: "Deleta um lançamento pelo ID. Peça confirmação antes de deletar.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID do lançamento a deletar" },
            },
            required: ["id"],
        },
    },
    {
        name: "get_summary",
        description:
            "Retorna um resumo financeiro: totais de entradas, saídas, impostos, saldo líquido, quantidade de lançamentos atrasados, e saldo projetado (baseado em Agendados).",
        parameters: {
            type: "object",
            properties: {
                start_date: { type: "string", description: "Início do período (YYYY-MM-DD)" },
                end_date: { type: "string", description: "Fim do período (YYYY-MM-DD)" },
            },
            required: [],
        },
    },
    {
        name: "list_categories",
        description: "Lista as categorias financeiras cadastradas no sistema.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "get_projections",
        description:
            "Calcula projeções financeiras com base nos lançamentos Agendados, agrupados por mês, para os próximos N meses.",
        parameters: {
            type: "object",
            properties: {
                months: {
                    type: "number",
                    description: "Quantidade de meses à frente para projetar (padrão: 3)",
                },
            },
            required: [],
        },
    },
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        switch (name) {
            case "list_transactions":
                return await handleListTransactions(args);
            case "create_transaction":
                return await handleCreateTransaction(args);
            case "update_transaction":
                return await handleUpdateTransaction(args);
            case "delete_transaction":
                return await handleDeleteTransaction(args);
            case "get_summary":
                return await handleGetSummary(args);
            case "list_categories":
                return await handleListCategories();
            case "get_projections":
                return await handleGetProjections(args);
            default:
                return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
        }
    } catch (err: any) {
        console.error(`[iago-tools] ${name} error:`, err);
        return JSON.stringify({ error: err.message || "Erro interno" });
    }
}

async function handleListTransactions(args: any): Promise<string> {
    const where: any = {};
    if (args.type && args.type !== "todos") {
        where.type = args.type === "entrada" ? "Entrada" : "Sa_da";
    }
    if (args.status && args.status !== "todos") {
        where.status = args.status;
    }
    if (args.search) {
        where.name = { contains: args.search, mode: "insensitive" };
    }
    if (args.start_date || args.end_date) {
        where.due_date = {};
        if (args.start_date) where.due_date.gte = new Date(args.start_date);
        if (args.end_date) where.due_date.lte = new Date(args.end_date);
    }
    if (args.category_name) {
        where.categories = { name: { contains: args.category_name, mode: "insensitive" } };
    }

    const data = await prisma.transactions.findMany({
        where,
        include: { categories: true, entities: true, projects: true },
        orderBy: { due_date: "asc" },
        take: args.limit || 50,
    });

    const result = data.map(sanitize).map((t: any) => ({
        id: t.id,
        name: t.name,
        amount: t.amount,
        formatted: `${t.type === "Entrada" ? "+" : "-"} ${formatBRL(t.amount)}`,
        type: t.type,
        status: t.status,
        due_date: t.due_date,
        category: t.categories?.name || null,
        entity: t.entities?.name || null,
        project: t.projects?.name || null,
        notes: t.notes,
    }));

    return JSON.stringify({ total: result.length, transactions: result });
}

async function handleCreateTransaction(args: any): Promise<string> {
    const amount = Math.abs(Number(args.amount));
    // If original value was negative OR type says saida → Sa_da
    const type: "Entrada" | "Sa_da" =
        Number(args.amount) < 0 || args.type === "saida" ? "Sa_da" : "Entrada";

    const dueDate = resolveDate(args.due_date || "hoje");
    const isPast = new Date(dueDate) <= new Date();
    const status = args.status || (isPast ? "Pago" : "Agendado");

    // Resolve category if provided
    let category_id: string | undefined;
    if (args.category_name) {
        const cat = await prisma.categories.findFirst({
            where: { name: { contains: args.category_name, mode: "insensitive" } },
        });
        if (cat) category_id = cat.id;
    }

    const created = await prisma.transactions.create({
        data: {
            name: args.name,
            amount,
            type: type as any,
            status: status as any,
            due_date: new Date(dueDate),
            notes: args.notes,
            ...(category_id ? { categories: { connect: { id: category_id } } } : {}),
        },
        include: { categories: true },
    });

    return JSON.stringify({
        success: true,
        message: "Lançamento criado com sucesso!",
        transaction: {
            id: created.id,
            name: created.name,
            amount: Number(created.amount),
            type: created.type,
            status: created.status,
            due_date: created.due_date.toISOString().slice(0, 10),
            category: (created as any).categories?.name || null,
        },
    });
}

async function handleUpdateTransaction(args: any): Promise<string> {
    const { id, ...rest } = args;
    const updateData: any = { updated_at: new Date() };

    if (rest.name) updateData.name = rest.name;
    if (rest.amount !== undefined) updateData.amount = Math.abs(Number(rest.amount));
    if (rest.type) updateData.type = resolveType(rest.type);
    if (rest.due_date) updateData.due_date = new Date(resolveDate(rest.due_date));
    if (rest.status) updateData.status = rest.status;
    if (rest.notes !== undefined) updateData.notes = rest.notes;
    if (rest.category_name) {
        const cat = await prisma.categories.findFirst({
            where: { name: { contains: rest.category_name, mode: "insensitive" } },
        });
        if (cat) updateData.categories = { connect: { id: cat.id } };
    }

    const updated = await prisma.transactions.update({ where: { id }, data: updateData });
    return JSON.stringify({ success: true, message: "Lançamento atualizado.", id: updated.id });
}

async function handleDeleteTransaction(args: any): Promise<string> {
    await prisma.transactions.delete({ where: { id: args.id } });
    return JSON.stringify({ success: true, message: "Lançamento deletado." });
}

async function handleGetSummary(args: any): Promise<string> {
    const where: any = {};
    if (args.start_date || args.end_date) {
        where.due_date = {};
        if (args.start_date) where.due_date.gte = new Date(args.start_date);
        if (args.end_date) where.due_date.lte = new Date(args.end_date);
    }

    const txs = await prisma.transactions.findMany({
        where: { ...where, status: { in: ["Pago", "Atrasado", "Cancelado", "Agendado"] } },
        include: { categories: true },
    });

    let entradas = 0, saidas = 0, impostos = 0, agendadoEntradas = 0, agendadoSaidas = 0;
    let atrasados = 0;

    for (const t of txs) {
        const amt = Number(t.amount);
        const isTax = t.notes?.includes("[IMPOSTO]");
        const isEntrada = t.type === "Entrada";

        if (t.status === "Agendado") {
            if (isEntrada) agendadoEntradas += amt;
            else agendadoSaidas += amt;
        } else {
            if (isEntrada) entradas += amt;
            else if (isTax) impostos += amt;
            else saidas += amt;
        }
        if (t.status === "Atrasado") atrasados++;
    }

    const saldoLiquido = entradas - saidas - impostos;
    const saldoProjetado = saldoLiquido + agendadoEntradas - agendadoSaidas;

    return JSON.stringify({
        entradas: formatBRL(entradas),
        saidas: formatBRL(saidas),
        impostos: formatBRL(impostos),
        saldoLiquido: formatBRL(saldoLiquido),
        lancamentosAtrasados: atrasados,
        agendados: {
            entradas: formatBRL(agendadoEntradas),
            saidas: formatBRL(agendadoSaidas),
        },
        saldoProjetado: formatBRL(saldoProjetado),
        totalLancamentos: txs.length,
    });
}

async function handleListCategories(): Promise<string> {
    const cats = await prisma.categories.findMany({ orderBy: { name: "asc" } });
    return JSON.stringify(
        cats.map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color }))
    );
}

async function handleGetProjections(args: any): Promise<string> {
    const months = Number(args.months) || 3;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + months, 0);

    const txs = await prisma.transactions.findMany({
        where: {
            status: "Agendado",
            due_date: { gte: now, lte: end },
        },
        orderBy: { due_date: "asc" },
    });

    const byMonth: Record<string, { entradas: number; saidas: number; saldo: number; count: number }> = {};

    for (const t of txs) {
        const key = t.due_date.toISOString().slice(0, 7); // "YYYY-MM"
        if (!byMonth[key]) byMonth[key] = { entradas: 0, saidas: 0, saldo: 0, count: 0 };
        const amt = Number(t.amount);
        if (t.type === "Entrada") {
            byMonth[key].entradas += amt;
            byMonth[key].saldo += amt;
        } else {
            byMonth[key].saidas += amt;
            byMonth[key].saldo -= amt;
        }
        byMonth[key].count++;
    }

    const projection = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, stats]) => ({
            month,
            entradas: formatBRL(stats.entradas),
            saidas: formatBRL(stats.saidas),
            saldoPrevisto: formatBRL(stats.saldo),
            lancamentos: stats.count,
        }));

    return JSON.stringify({ mesesProjetados: months, projection });
}

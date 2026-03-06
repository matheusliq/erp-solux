"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// ─── Sanitizer ───────────────────────────────────────────────────────────────
const sanitize = (t: any) => ({
    ...t,
    amount: t.amount ? Number(t.amount) : 0,
    categories: t.categories
        ? {
            ...t.categories,
            monthly_budget: t.categories.monthly_budget
                ? Number(t.categories.monthly_budget)
                : null,
        }
        : null,
    projects: t.projects
        ? {
            ...t.projects,
            contract_value: t.projects.contract_value
                ? Number(t.projects.contract_value)
                : null,
            budget_solux_reserve: t.projects.budget_solux_reserve
                ? Number(t.projects.budget_solux_reserve)
                : null,
        }
        : null,
    // Ensure no other Decimal sneaks through
    due_date: t.due_date ? t.due_date.toISOString().split("T")[0] : null,
    payment_date: t.payment_date
        ? t.payment_date.toISOString().split("T")[0]
        : null,
    created_at: t.created_at ? t.created_at.toISOString() : null,
    updated_at: t.updated_at ? t.updated_at.toISOString() : null,
});

// ─── GET: List transactions ──────────────────────────────────────────────────
export async function getTransactions(filters?: {
    statusIn?: string[];
    startDate?: string;
    endDate?: string;
}) {
    try {
        const where: any = {};
        if (filters?.statusIn && filters.statusIn.length > 0) {
            where.status = { in: filters.statusIn };
        }
        if (filters?.startDate || filters?.endDate) {
            where.due_date = {};
            if (filters.startDate) where.due_date.gte = new Date(filters.startDate);
            if (filters.endDate) where.due_date.lte = new Date(filters.endDate);
        }

        const data = await prisma.transactions.findMany({
            where,
            include: {
                categories: true,
                entities: true,
                projects: true,
            },
            orderBy: { due_date: "asc" },
        });

        return { success: true, data: data.map(sanitize) };
    } catch (error) {
        console.error("getTransactions error:", error);
        return { success: false, error: "Falha ao buscar transações.", data: [] };
    }
}

// ─── GET: Real transactions only ─────────────────────────────────────────────
export async function getRealTransactions(startDate?: string, endDate?: string) {
    return getTransactions({
        statusIn: ["Pago", "Atrasado", "Cancelado"],
        startDate,
        endDate,
    });
}

// ─── GET: Planned transactions only ─────────────────────────────────────────
export async function getPlannedTransactions(startDate?: string, endDate?: string) {
    return getTransactions({
        statusIn: ["Agendado"],
        startDate,
        endDate,
    });
}

// ─── CREATE transaction ──────────────────────────────────────────────────────
export async function createTransaction(data: {
    name: string;
    amount: number;
    type: string;
    status: string;
    due_date: string;
    payment_date?: string;
    category_id?: string;
    entity_id?: string;
    project_id?: string;
    notes?: string;
    is_tax?: boolean;
}) {
    try {
        let userId: string | null = null;
        try {
            const session = await getServerSession(authOptions);
            userId = (session?.user as any)?.id ?? null;
        } catch (_) { /* auth not critical for this action */ }

        const dbType = data.type === "entrada" ? "Entrada" : "Sa_da";
        const validStatuses = ["Pago", "Agendado", "Atrasado", "Cancelado"];
        const dbStatus = validStatuses.includes(data.status) ? data.status : "Agendado";

        const created = await prisma.transactions.create({
            data: {
                name: data.name,
                amount: data.amount,
                type: dbType as any,
                status: dbStatus as any,
                due_date: new Date(data.due_date),
                payment_date: data.payment_date ? new Date(data.payment_date) : undefined,
                notes: data.notes || (data.is_tax ? "[IMPOSTO]" : undefined),
                // Use relation connect pattern for FKs
                ...(data.category_id ? { categories: { connect: { id: data.category_id } } } : {}),
                ...(data.entity_id ? { entities: { connect: { id: data.entity_id } } } : {}),
                ...(data.project_id ? { projects: { connect: { id: data.project_id } } } : {}),
                ...(userId ? { users: { connect: { id: userId } } } : {}),
            },
        });

        // Audit Log
        await prisma.audit_logs.create({
            data: {
                action: "Criação",
                entity_type: "Lançamento",
                entity_id: created.id,
                user_id: userId || null,
                details: {
                    new: {
                        name: created.name,
                        amount: Number(created.amount),
                        type: created.type,
                        status: created.status,
                    }
                }
            }
        });

        revalidatePath("/lancamentos");
        revalidatePath("/planejado");
        revalidatePath("/comparativo");
        revalidatePath("/inbox");

        return { success: true, data: sanitize(created) };
    } catch (error) {
        console.error("createTransaction error:", error);
        return { success: false, error: "Falha ao criar transação." };
    }
}

// ─── UPDATE transaction ──────────────────────────────────────────────────────
export async function updateTransaction(
    id: string,
    data: Partial<{
        name: string;
        amount: number;
        type: string;
        status: string;
        due_date: string;
        payment_date: string;
        category_id: string;
        entity_id: string;
        project_id: string;
        notes: string;
        is_tax: boolean;
    }>
) {
    try {
        let userId: string | null = null;
        try {
            const session = await getServerSession(authOptions);
            userId = (session?.user as any)?.id ?? null;
        } catch (_) { /* auth not critical for this action */ }

        const oldTx = await prisma.transactions.findUnique({ where: { id } });
        if (!oldTx) throw new Error("Lançamento não encontrado");

        const { type, due_date, payment_date, category_id, entity_id, project_id, is_tax, name, amount, status, notes } = data;

        const updateData: any = { updated_at: new Date() };
        if (name !== undefined) updateData.name = name;
        if (amount !== undefined) updateData.amount = amount;
        if (status !== undefined) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;

        // Convert enum type
        if (type) updateData.type = type === "entrada" ? "Entrada" : "Sa_da";
        // Convert date strings to Date objects
        if (due_date) updateData.due_date = new Date(due_date);
        if (payment_date) updateData.payment_date = new Date(payment_date);
        // Use relation connect/disconnect for FK fields
        if (category_id !== undefined) {
            updateData.categories = category_id
                ? { connect: { id: category_id } }
                : { disconnect: true };
        }
        if (entity_id !== undefined) {
            updateData.entities = entity_id
                ? { connect: { id: entity_id } }
                : { disconnect: true };
        }
        if (project_id !== undefined) {
            updateData.projects = project_id
                ? { connect: { id: project_id } }
                : { disconnect: true };
        }
        // notes: [IMPOSTO] marker
        if (is_tax !== undefined) {
            if (is_tax) {
                updateData.notes = "[IMPOSTO]";
            } else if (data.notes !== undefined) {
                // keep notes as-is (already in rest)
            } else {
                // clear notes if is_tax toggled off and no explicit notes
                if (!data.notes) updateData.notes = null;
            }
        }

        const updated = await prisma.transactions.update({
            where: { id },
            data: updateData,
        });

        // Audit Log - gather changed fields
        const changes: Record<string, { old: any, new: any }> = {};
        if (data.name && data.name !== oldTx.name) changes.name = { old: oldTx.name, new: data.name };
        if (data.amount && data.amount !== Number(oldTx.amount)) changes.amount = { old: Number(oldTx.amount), new: data.amount };
        if (updateData.type && updateData.type !== oldTx.type) changes.type = { old: oldTx.type, new: updateData.type };
        if (data.status && data.status !== oldTx.status) changes.status = { old: oldTx.status, new: data.status };
        if (updateData.due_date && updateData.due_date.getTime() !== oldTx.due_date.getTime()) changes.due_date = { old: oldTx.due_date.toISOString(), new: updateData.due_date.toISOString() };
        if (category_id !== undefined && category_id !== oldTx.category_id) changes.category_id = { old: oldTx.category_id, new: category_id || null };
        if (project_id !== undefined && project_id !== oldTx.project_id) changes.project_id = { old: oldTx.project_id, new: project_id || null };
        if (entity_id !== undefined && entity_id !== oldTx.entity_id) changes.entity_id = { old: oldTx.entity_id, new: entity_id || null };

        if (Object.keys(changes).length > 0) {
            await prisma.audit_logs.create({
                data: {
                    action: "Atualização",
                    entity_type: "Lançamento",
                    entity_id: id,
                    user_id: userId || null,
                    details: changes
                }
            });
        }

        revalidatePath("/lancamentos");
        revalidatePath("/planejado");
        revalidatePath("/comparativo");
        revalidatePath("/inbox");
        revalidatePath("/auditoria");

        return { success: true, data: sanitize(updated) };
    } catch (error) {
        console.error("updateTransaction error:", error);
        return { success: false, error: "Falha ao atualizar transação." };
    }
}

// ─── DELETE transaction ──────────────────────────────────────────────────────
export async function deleteTransaction(id: string) {
    try {
        let userId: string | null = null;
        try {
            const session = await getServerSession(authOptions);
            userId = (session?.user as any)?.id ?? null;
        } catch (_) { /* auth not critical for this action */ }

        const oldTx = await prisma.transactions.findUnique({ where: { id } });

        await prisma.transactions.delete({ where: { id } });

        if (oldTx) {
            await prisma.audit_logs.create({
                data: {
                    action: "Exclusão",
                    entity_type: "Lançamento",
                    entity_id: id,
                    user_id: userId || null,
                    details: {
                        old: {
                            name: oldTx.name,
                            amount: Number(oldTx.amount),
                        }
                    }
                }
            });
        }

        revalidatePath("/lancamentos");
        revalidatePath("/planejado");
        revalidatePath("/comparativo");
        revalidatePath("/inbox");
        revalidatePath("/auditoria");

        return { success: true };
    } catch (error) {
        console.error("deleteTransaction error:", error);
        return { success: false, error: "Falha ao deletar transação." };
    }
}

// ─── GET: Comparativo (real vs planejado no mesmo período) ───────────────────
export async function getComparativo(startDate: string, endDate: string) {
    try {
        const [realRes, plannedRes] = await Promise.all([
            getRealTransactions(startDate, endDate),
            getPlannedTransactions(startDate, endDate),
        ]);

        return {
            success: true,
            real: realRes.data || [],
            planned: plannedRes.data || [],
        };
    } catch (error) {
        console.error("getComparativo error:", error);
        return { success: false, real: [], planned: [] };
    }
}

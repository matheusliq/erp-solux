"use server";

import prisma from "@/lib/prisma";

/**
 * Seed audit_logs table with existing transactions.
 * Called once via /api/audit-seed route to backfill historical data.
 */
export async function seedAuditLogs() {
    try {
        // Always delete and re-seed to ensure correct user_id linkage
        await prisma.audit_logs.deleteMany({});

        const transactions = await prisma.transactions.findMany({
            include: { categories: true, projects: true, users: true },
            orderBy: { created_at: "asc" },
        });

        let created = 0;
        for (const tx of transactions) {
            await prisma.audit_logs.create({
                data: {
                    action: "Criação (histórico)",
                    entity_type: "Lançamento",
                    entity_id: tx.id,
                    user_id: tx.created_by || null,
                    details: {
                        note: "Registro retroativo gerado pelo seed de auditoria",
                        new: {
                            name: tx.name,
                            amount: Number(tx.amount),
                            type: tx.type,
                            status: tx.status,
                            due_date: tx.due_date?.toISOString().split("T")[0] || null,
                        },
                    },
                    // Use created_at from original transaction if available
                    created_at: tx.created_at || new Date(),
                },
            });
            created++;
        }

        return { success: true, message: `Seed concluído. ${created} registros criados.`, count: created };
    } catch (error: any) {
        console.error("seedAuditLogs error:", error);
        return { success: false, message: String(error?.message || error), count: 0 };
    }
}

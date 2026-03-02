"use server";

import prisma from "@/lib/prisma";

// ─── Audit: list all audit logs ──────────────────────
export async function getAuditLogs(filters?: {
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
}) {
    try {
        const where: any = {};
        if (filters?.startDate || filters?.endDate) {
            where.created_at = {};
            if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
            if (filters.endDate) {
                const endD = new Date(filters.endDate);
                endD.setHours(23, 59, 59, 999);
                where.created_at.lte = endD;
            }
        }
        if (filters?.search) {
            where.OR = [
                { entity_id: { equals: filters.search } }
            ];
            // Prisma JSON search is complex, we just allow exact UUID searches for simplicity
        }

        const data = await prisma.audit_logs.findMany({
            where,
            include: {
                users: true,
            },
            orderBy: { created_at: "desc" },
            take: filters?.limit || 200,
        });

        const sanitized = data.map((log) => ({
            id: log.id,
            action: log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            details: log.details,
            created_at: log.created_at ? log.created_at.toISOString() : null,
            created_by_name: log.users?.username || log.users?.name || "Sistema",
        }));

        return { success: true, data: sanitized };
    } catch (error) {
        console.error("getAuditLogs error:", error);
        return { success: false, data: [] };
    }
}

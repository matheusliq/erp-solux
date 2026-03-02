import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "obra" | "entidade"
    const id = searchParams.get("id");

    if (!id || !type) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        const where: any = type === "obra"
            ? { project_id: id === "null" ? null : id }
            : { entity_id: id === "null" ? null : id };

        const data = await prisma.transactions.findMany({
            where,
            include: {
                categories: true,
                entities: true,
                projects: true,
                users: true,
            },
            orderBy: { due_date: "desc" },
            take: 500,
        });

        const transactions = data.map(t => ({
            id: t.id,
            name: t.name,
            type: t.type,
            status: t.status,
            amount: Number(t.amount),
            due_date: t.due_date ? t.due_date.toISOString().split("T")[0] : null,
            payment_date: t.payment_date ? t.payment_date.toISOString().split("T")[0] : null,
            category: t.categories ? { name: t.categories.name, color: t.categories.color } : null,
            entity: t.entities ? { name: t.entities.name } : null,
            project: t.projects ? { name: t.projects.name } : null,
            created_by_name: t.users?.name || null,
        }));

        return NextResponse.json({ transactions });
    } catch (error) {
        console.error("extrato error:", error);
        return NextResponse.json({ error: "Erro ao buscar extrato" }, { status: 500 });
    }
}

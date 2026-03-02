"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getEntities() {
    try {
        const data = await prisma.entities.findMany({ orderBy: { name: "asc" } });
        return { success: true, data };
    } catch (error) {
        console.error("getEntities error:", error);
        return { success: false, error: "Falha ao buscar entidades.", data: [] };
    }
}

export async function createEntity(data: {
    name: string;
    type?: string;
    document?: string;
    phone?: string;
    email?: string;
}) {
    try {
        const created = await prisma.entities.create({ data });
        revalidatePath("/configuracoes");
        revalidatePath("/inbox");
        return { success: true, data: created };
    } catch (error) {
        console.error("createEntity error:", error);
        return { success: false, error: "Falha ao criar entidade." };
    }
}

export async function updateEntity(id: string, data: {
    name?: string;
    type?: string;
    document?: string;
    phone?: string;
    email?: string;
}) {
    try {
        const updated = await prisma.entities.update({ where: { id }, data });
        revalidatePath("/configuracoes");
        return { success: true, data: updated };
    } catch (error) {
        console.error("updateEntity error:", error);
        return { success: false, error: "Falha ao atualizar entidade." };
    }
}

export async function deleteEntity(id: string) {
    try {
        await prisma.entities.delete({ where: { id } });
        revalidatePath("/configuracoes");
        return { success: true };
    } catch (error) {
        console.error("deleteEntity error:", error);
        return { success: false, error: "Falha ao excluir entidade." };
    }
}

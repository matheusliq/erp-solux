"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// FUNÇÃO AUXILIAR: Transforma Objetos Complexos em Tipos Nativos (Sanitização)
const sanitizeCategory = (cat: any) => ({
    ...cat,
    // Converte o Objeto Decimal do Prisma para um número comum que o Front-end aceita
    monthly_budget: cat.monthly_budget ? Number(cat.monthly_budget) : null,
});

export async function createCategory(data: { name: string; color: string; type: string }) {
    try {
        const dbType = data.type === "entrada" ? "Entrada" : "Sa_da";
        const newCategory = await prisma.categories.create({
            data: {
                name: data.name,
                color: data.color,
                type: dbType,
            },
        });
        revalidatePath("/configuracoes");
        return { success: true, data: sanitizeCategory(newCategory) };
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        return { success: false, error: "Falha ao conectar com o banco de dados." };
    }
}

export async function getCategories() {
    try {
        const categorias = await prisma.categories.findMany({
            orderBy: { name: 'asc' }
        });

        // Passa todas as categorias pelo "tradutor" antes de mandar para a tela
        const sanitizedData = categorias.map(sanitizeCategory);

        return { success: true, data: sanitizedData };
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        return { success: false, error: "Falha ao buscar categorias." };
    }
}

export async function updateCategory(id: string, data: { name: string; color: string; type: string }) {
    try {
        const dbType = data.type === "entrada" ? "Entrada" : "Sa_da";
        const updatedCategory = await prisma.categories.update({
            where: { id },
            data: {
                name: data.name,
                color: data.color,
                type: dbType,
            },
        });
        revalidatePath("/configuracoes");
        return { success: true, data: sanitizeCategory(updatedCategory) };
    } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
        return { success: false, error: "Falha ao atualizar categoria." };
    }
}
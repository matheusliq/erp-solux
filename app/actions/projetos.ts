"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getProjects() {
    try {
        const data = await prisma.projects.findMany({ orderBy: { created_at: "desc" } });
        return {
            success: true,
            data: data.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                client_name: p.client_name,
                status: p.status,
                start_date: p.start_date ? p.start_date.toISOString() : null,
                deadline: p.deadline ? p.deadline.toISOString() : null,
                contract_value: p.contract_value ? Number(p.contract_value) : null,
                budget_solux_reserve: p.budget_solux_reserve ? Number(p.budget_solux_reserve) : null,
                partners_split: p.partners_split || null,
                created_at: p.created_at ? p.created_at.toISOString() : null
            }))
        };
    } catch (error) {
        console.error("getProjects error:", error);
        return { success: false, error: "Falha ao buscar projetos.", data: [] };
    }
}

export async function createProject(data: {
    name: string;
    description?: string;
    client_name?: string;
    contract_value?: number;
    status?: string;
    budget_solux_reserve?: number;
    partners_split?: any;
}) {
    try {
        const created = await prisma.projects.create({
            data: {
                name: data.name,
                description: data.description,
                client_name: data.client_name,
                contract_value: data.contract_value,
                budget_solux_reserve: data.budget_solux_reserve,
                partners_split: data.partners_split ?? undefined,
                status: (data.status as any) || "negotiation",
            },
        });
        revalidatePath("/configuracoes");
        return {
            success: true,
            data: {
                id: created.id,
                name: created.name,
                description: created.description,
                client_name: created.client_name,
                status: created.status,
                start_date: created.start_date ? created.start_date.toISOString() : null,
                deadline: created.deadline ? created.deadline.toISOString() : null,
                contract_value: created.contract_value ? Number(created.contract_value) : null,
                budget_solux_reserve: created.budget_solux_reserve ? Number(created.budget_solux_reserve) : null,
                partners_split: created.partners_split || null,
                created_at: created.created_at ? created.created_at.toISOString() : null
            }
        };
    } catch (error) {
        console.error("createProject error:", error);
        return { success: false, error: "Falha ao criar projeto." };
    }
}

export async function updateProject(id: string, data: {
    name?: string;
    description?: string;
    client_name?: string;
    contract_value?: number;
    status?: string;
    budget_solux_reserve?: number;
    partners_split?: any;
}) {
    try {
        const updated = await prisma.projects.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                client_name: data.client_name,
                contract_value: data.contract_value,
                budget_solux_reserve: data.budget_solux_reserve,
                partners_split: data.partners_split ?? undefined,
                status: data.status as any,
            },
        });
        revalidatePath("/configuracoes");
        return {
            success: true,
            data: {
                id: updated.id,
                name: updated.name,
                description: updated.description,
                client_name: updated.client_name,
                status: updated.status,
                start_date: updated.start_date ? updated.start_date.toISOString() : null,
                deadline: updated.deadline ? updated.deadline.toISOString() : null,
                contract_value: updated.contract_value ? Number(updated.contract_value) : null,
                budget_solux_reserve: updated.budget_solux_reserve ? Number(updated.budget_solux_reserve) : null,
                partners_split: updated.partners_split || null,
                created_at: updated.created_at ? updated.created_at.toISOString() : null
            }
        };
    } catch (error) {
        console.error("updateProject error:", error);
        return { success: false, error: "Falha ao atualizar projeto." };
    }
}

export async function deleteProject(id: string) {
    try {
        await prisma.projects.delete({ where: { id } });
        revalidatePath("/configuracoes");
        return { success: true };
    } catch (error: any) {
        console.error("deleteProject error:", error);
        if (error.code === 'P2003') {
            return { success: false, error: "Não é possível excluir esta obra pois existem lançamentos financeiros vinculados a ela." };
        }
        return { success: false, error: "Falha ao excluir projeto." };
    }
}

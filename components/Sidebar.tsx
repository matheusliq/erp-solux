"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    Inbox,
    KanbanSquare,
    CalendarRange,
    BarChart3,
    LayoutDashboard,
    Settings,
    Bot,
    LogOut,
    User,
    Menu,
    X,
    ShieldCheck,
    ChevronRight,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_GROUPS = [
    {
        label: "Operacional",
        items: [
            {
                href: "/inbox", icon: Inbox, label: "Inbox"
            },
            {
                href: "/lancamentos", icon: KanbanSquare, label: "Kanban"
            },
            {
                href: "/planejado", icon: CalendarRange, label: "Planejado"
            },
            { href: "/comparativo", icon: BarChart3, label: "Planejado vs Real" },
        ],
    },
    {
        label: "Estratégico",
        items: [
            {
                href: "/dashboard", icon: LayoutDashboard, label: "Dashboard CFO"
            },
            {
                href: "/dashboard-planejado", icon: LayoutDashboard, label: "Dashboard Planejado"
            },
            { href: "/iago", icon: Bot, label: "Iago (AI Assistant)" },
        ],
    },
    {
        label: "Sistema",
        items: [
            {
                href: "/configuracoes", icon: Settings, label: "Configurações"
            },
            { href: "/auditoria", icon: ShieldCheck, label: "Auditoria Geral" },
        ],
    },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    const isActive = (href: string) =>
        pathname === href || (href !== "/" && pathname.startsWith(href));

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 pt-6 pb-4 flex items-center justify-center">
                < Image src="/logo.png" alt="Solux" width={110} height={35} className="object-contain" priority />
            </div >

            {/* Nav */}
            < nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
                {
                    NAV_GROUPS.map((group) => (
                        <div key={group.label}>
                            <p className="px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[0.2em] text-zinc-600">
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {
                                    group.items.map(({ href, icon: Icon, label }) => {
                                        const active = isActive(href);
                                        return (
                                            <Link
                                                key={href}
                                                href={href}
                                                onClick={onNavigate}
                                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${active
                                                    ? "bg-[#0056b3]/15 text-blue-400"
                                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-card/60"
                                                    }`}
                                            >
                                                {active && (
                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                                                )}
                                                <Icon
                                                    size={16}
                                                    className={`shrink - 0 transition - colors ${active ? "text-blue-400" : "text-zinc-600 group-hover:text-zinc-400"}`}
                                                />
                                                < span className="flex-1 truncate">{label}</span>
                                                {active && <ChevronRight size={12} className="text-blue-500/50 shrink-0" />}
                                            </Link>
                                        );
                                    })
                                }
                            </div >
                        </div >
                    ))
                }
            </nav >

            {/* Footer */}
            < div className="px-3 pb-4 pt-3 border-t border-zinc-800/60 flex flex-col gap-3">
                <div className="flex px-1 items-center justify-between">
                    <ThemeToggle />
                </div>
                {
                    session?.user && (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-card/50 border border-zinc-800/50">
                            < div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-foreground shrink-0 text-xs font-bold">
                                {session.user.name?.[0]?.toUpperCase() || <User size={12} />}
                            </div >
                            <span className="flex-1 truncate text-xs font-semibold text-zinc-300">{session.user.name}</span>
                            < button
                                onClick={() => signOut()
                                }
                                className="text-zinc-600 hover:text-rose-400 transition-colors p-1 rounded-md hover:bg-zinc-800"
                                title="Sair"
                            >
                                <LogOut size={13} />
                            </button >
                        </div >
                    )}
                <div className="flex justify-center">
                    < Image src="/sublogo.png" alt="Solux Pinturas" width={90} height={90} unoptimized className="object-contain opacity-30 hover:opacity-70 transition-opacity" />
                </div >
            </div >
        </div >
    );
}

export default function Sidebar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-card border border-zinc-800 flex items-center justify-center text-foreground shadow-xl"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
            >
                <Menu size={18} />
            </button >

            {/* Mobile overlay */}
            {
                mobileOpen && (
                    <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
                        < div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        < aside
                            className="absolute left-0 top-0 h-full w-72 bg-[#0d0f12] border-r border-zinc-800/60 flex flex-col z-50 shadow-2xl"
                            onClick={(e) => e.stopPropagation()
                            }
                        >
                            <div className="flex items-center justify-end px-4 pt-4">
                                < button onClick={() => setMobileOpen(false)
                                } className="text-zinc-500 hover:text-foreground p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                                    < X size={18} />
                                </button >
                            </div >
                            <SidebarContent onNavigate={() => setMobileOpen(false)} />
                        </aside >
                    </div >
                )}

            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-60 flex-col h-screen shrink-0 bg-[#0d0f12] border-r border-zinc-800/60">
                < SidebarContent />
            </aside >
        </>
    );
}
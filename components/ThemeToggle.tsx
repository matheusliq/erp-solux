"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <button
                onClick={() => setTheme("light")}
                title="Modo Claro"
                className={`p-2 rounded-md transition-all ${theme === 'light' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}>
                <Sun size={15} />
            </button>
            <button
                onClick={() => setTheme("dark")}
                title="Modo Escuro"
                className={`p-2 rounded-md transition-all ${theme === 'dark' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}>
                <Moon size={15} />
            </button>
            <button
                onClick={() => setTheme("system")}
                title="Usar Sistema"
                className={`p-2 rounded-md transition-all ${theme === 'system' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}>
                <Monitor size={15} />
            </button>
        </div>
    );
}

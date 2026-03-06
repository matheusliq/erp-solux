"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const res = await signIn("credentials", {
            username: username.trim(),
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Usuário ou senha inválidos.");
            setLoading(false);
        } else {
            router.push("/inbox");
            router.refresh(); // Force session update
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 font-sans">
            <div className="w-full max-w-sm p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col items-center">
                <Image
                    src="/logo.png"
                    alt="Solux Pinturas"
                    width={160}
                    height={160}
                    className="mb-8 drop-shadow-lg"
                    priority
                />

                <h1 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">
                    Finance <span className="text-blue-500 font-light">OS</span>
                </h1>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-xs text-red-400 text-center font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="seu.usuario"
                            required
                            className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 pr-11 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !username || !password}
                        className="w-full h-11 mt-4 bg-[#0056b3] hover:bg-[#004494] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(0,86,179,0.25)] flex items-center justify-center transition-all"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrar no Sistema"}
                    </button>
                </form>
            </div>
        </div>
    );
}

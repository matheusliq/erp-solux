import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // ── Turbopack (faster dev server) ──────────────────────────────────────────
    // pg and prisma are marked as serverExternalPackages so they bypass
    // Turbopack's bundler (which doesn't support native Node addons)
    serverExternalPackages: ["pg", "pg-native", "@prisma/client", "prisma"],

    // ── Aggressive tree-shaking for large icon/UI libraries ────────────────────
    // Instead of importing entire lucide-react or shadcn barrel exports,
    // Next.js will only bundle the specific icons/components actually used
    experimental: {
        optimizePackageImports: [
            "lucide-react",
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
            "@radix-ui/react-tabs",
        ],
    },
};

export default nextConfig;

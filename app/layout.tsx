import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ERP SOLUX",
  description: "ERP Premium da Solux Pinturas",
};

import { Providers } from "@/app/providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground flex h-screen overflow-hidden`}>
        <Providers>
          {/* O nosso novo Menu Lateral */}
          <Sidebar />

          {/* A área principal onde o Kanban e outras telas vão aparecer */}
          <main className="flex-1 overflow-y-auto bg-background pt-16 md:pt-0">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
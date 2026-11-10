import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Creative Ops — Creative Production Workspace",
  description: "Управление задачами креативной performance-команды",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>{children}<Toaster position="top-right" richColors closeButton /></ThemeProvider>
      </body>
    </html>
  );
}

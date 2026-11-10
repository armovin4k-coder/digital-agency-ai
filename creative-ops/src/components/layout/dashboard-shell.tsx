"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import type { Role } from "@prisma/client";
import { Activity, BarChart3, ClipboardList, LogOut, Plus, Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type Props = {
  user: { id: string; name: string; email: string; role: Role; avatar: string | null };
  children: ReactNode;
};

const roleNames: Record<Role, string> = {
  BUYER: "Байер",
  CREATIVE: "Креативщик",
  MANAGER: "Руководитель",
};

export function DashboardShell({ user, children }: Props) {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Доска задач", icon: ClipboardList, show: true },
    { href: "/tasks/new", label: "Новая задача", icon: Plus, show: user.role === "BUYER" },
    { href: "/analytics", label: "Аналитика", icon: BarChart3, show: user.role === "MANAGER" },
    { href: "/history", label: "История", icon: Activity, show: true },
    { href: "/settings", label: "Настройки", icon: Settings, show: user.role === "MANAGER" },
  ].filter((item) => item.show);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand-lockup" aria-label="Creative Ops — главная">
          <span className="brand-mark-small">CO</span>
          <span><strong>Creative Ops</strong><small>WORKSPACE</small></span>
        </Link>
        <div className="workspace-switcher"><span className="workspace-dot" /> Performance Team <span className="workspace-chevron">⌄</span></div>
        <p className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav className="sidebar-nav" aria-label="Основная навигация">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={17} strokeWidth={1.8} /> <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-profile">
            <span className="avatar avatar-profile">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <span className="user-profile-copy"><strong>{user.name}</strong><small>{roleNames[user.role]}</small></span>
            <button className="icon-button signout-button" onClick={() => void signOut({ callbackUrl: "/login" })} title="Выйти" aria-label="Выйти"><LogOut size={16} /></button>
          </div>
          <div className="sidebar-version"><Sparkles size={13} /> Creative Ops · MVP</div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{pathname === "/tasks/new" ? "Новая задача" : pathname.startsWith("/tasks/") ? "Карточка задачи" : pathname.startsWith("/analytics") ? "Аналитика" : pathname.startsWith("/history") ? "История" : pathname.startsWith("/settings") ? "Настройки" : "Доска задач"}</strong></div>
          <div className="topbar-right"><ThemeToggle /><span className="topbar-status"><i /> Командное пространство</span><span className="avatar avatar-top">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span></div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

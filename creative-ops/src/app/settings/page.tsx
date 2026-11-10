import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.MANAGER) redirect("/");
  const people = await prisma.user.findMany({ where: { role: { in: [Role.BUYER, Role.CREATIVE, Role.MANAGER] } }, select: { id: true, name: true, email: true, role: true, avatar: true, isDemo: true, _count: { select: { buyerTasks: true, assignedTasks: true } } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  const roleNames: Record<Role, string> = { BUYER: "Байер", CREATIVE: "Креативщик", MANAGER: "Руководитель" };
  return <DashboardShell user={user}><div className="settings-page"><div className="page-heading-row"><div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot"/> WORKSPACE ADMIN</div><h1>Настройки пространства</h1><p className="page-subtitle">Участники команды и текущая конфигурация рабочего пространства.</p></div></div><section className="settings-card"><div className="table-card-heading"><div><h2>Команда</h2><p>Управление участниками доступно в рамках текущей модели ролей.</p></div><span>{people.length} пользователей</span></div><div className="responsive-table"><table><thead><tr><th>Участник</th><th>Роль</th><th>Создано задач</th><th>Назначено задач</th><th>Аккаунт</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><small className="table-subline">{person.email}</small></td><td><span className="role-pill">{roleNames[person.role]}</span></td><td>{person._count.buyerTasks}</td><td>{person._count.assignedTasks}</td><td>{person.isDemo ? <span className="demo-state">Демо</span> : <span className="active-state">Обычный</span>}</td></tr>)}</tbody></table></div></section><section className="settings-card settings-notes"><h2>Параметры безопасности</h2><div><strong>Авторизация</strong><span>NextAuth Credentials · JWT-сессия · пароль хранится в bcrypt-хеше.</span></div><div><strong>Разграничение доступа</strong><span>BUYER видит только собственные задачи; CREATIVE — новые и назначенные ему; MANAGER — все.</span></div><div><strong>Файлы</strong><span>Vercel Blob в режиме private; выдача проходит через авторизованный endpoint с повторной проверкой доступа к задаче.</span></div><div><strong>Журналирование</strong><span>Действия пользователей записываются в ActivityLog в одной транзакции с изменением задачи.</span></div></section></div></DashboardShell>;
}

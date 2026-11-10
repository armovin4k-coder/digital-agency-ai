"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Clock3, CreditCard, ListTodo, RefreshCw, Timer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

type AnalyticsData = {
  period: { from: string; to: string };
  kpi: { totalTasks: number; inProgress: number; overdue: number; averageProductionHours: number | null; averageFullCycleHours: number | null; aiCredits: number };
  statuses: Array<{ status: string; label: string; count: number }>;
  workload: Array<{ id: string; name: string; active: number }>;
  performerTime: Array<{ id: string; name: string; averageHours: number; completed: number }>;
  creditsByService: Array<{ service: string; credits: number }>;
  creditsByPerson: Array<{ id: string; name: string; credits: number }>;
  overdueByPerson: Array<{ id: string; name: string; count: number }>;
  performers: Array<{ id: string; name: string; tasks: number; completed: number; averageHours: number | null; revisions: number; credits: number }>;
};

const colors = ["#8b83ed", "#65a6e8", "#e6b15d", "#e17b83", "#5ab995", "#9b86cf", "#7bb8b1"];
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

export function AnalyticsDashboard({ initialData }: { initialData: AnalyticsData }) {
  const [data, setData] = useState(initialData);
  const [from, setFrom] = useState(dateInput(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(dateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const rangeLabel = useMemo(() => `${new Date(`${from}T00:00:00`).toLocaleDateString("ru-RU")} — ${new Date(`${to}T00:00:00`).toLocaleDateString("ru-RU")}`, [from, to]);

  async function applyRange() {
    if (from > to) { toast.error("Начало периода не может быть позже окончания."); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?from=${from}&to=${to}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось загрузить аналитику.");
      setData(payload.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки аналитики."); }
    finally { setLoading(false); }
  }

  const kpis = [
    { label: "Всего задач", value: data.kpi.totalTasks, icon: ListTodo, color: "purple" },
    { label: "В работе", value: data.kpi.inProgress, icon: Clock3, color: "blue" },
    { label: "Просрочено", value: data.kpi.overdue, icon: TriangleAlert, color: "orange" },
    { label: "Среднее производство", value: data.kpi.averageProductionHours === null ? "—" : `${formatNumber(data.kpi.averageProductionHours)} ч`, icon: Timer, color: "green" },
    { label: "AI-кредиты", value: formatNumber(data.kpi.aiCredits), icon: CreditCard, color: "violet" },
  ];

  return <div className="analytics-page">
    <div className="page-heading-row"><div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot" /> TEAM INTELLIGENCE</div><h1>Аналитика команды</h1><p className="page-subtitle">Нагрузка, сроки производства, качество итераций и использование AI.</p></div></div>
    <div className="analytics-filter"><div className="analytics-range-label"><CalendarDays size={16}/><div><strong>Период отчёта</strong><small>{rangeLabel}</small></div></div><label>С <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>По <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><button className="primary-button" disabled={loading} onClick={() => void applyRange()}><RefreshCw size={14} className={loading ? "spin" : ""}/> Обновить</button></div>
    <div className="analytics-kpis">{kpis.map((item) => <div className="analytics-kpi" key={item.label}><span className={`analytics-kpi-icon ${item.color}`}><item.icon size={18}/></span><div><strong>{item.value}</strong><small>{item.label}</small></div></div>)}</div>
    <div className="analytics-grid">
      <ChartCard title="Задачи по статусам" subtitle="Распределение задач, созданных в выбранный период"><ResponsiveContainer width="100%" height={250}><BarChart data={data.statuses} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="count" name="Задач" radius={[6,6,0,0]} fill="#7569e8"/></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Загрузка креативщиков" subtitle="Текущие активные задачи команды"><ResponsiveContainer width="100%" height={250}><BarChart data={data.workload} layout="vertical" margin={{ top: 4, right: 12, left: 22, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf0f5"/><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="active" name="Активные задачи" fill="#63a8e7" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Среднее время производства" subtitle="От первого взятия до окончательной приёмки, часы"><ResponsiveContainer width="100%" height={250}><BarChart data={data.performerTime} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="averageHours" name="Среднее, ч" fill="#5ab995" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="AI-расходы по сервисам" subtitle="Количество кредитов, без пересчёта в деньги"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={data.creditsByService} dataKey="credits" nameKey="service" cx="50%" cy="50%" outerRadius={82} innerRadius={42} paddingAngle={3}>{data.creditsByService.map((entry, index) => <Cell key={entry.service} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value) => formatNumber(Number(value))}/><Legend wrapperStyle={{ fontSize: 10 }}/></PieChart></ResponsiveContainer></ChartCard>
      <ChartCard title="AI-расходы по исполнителям" subtitle="По автору записи расхода"><ResponsiveContainer width="100%" height={250}><BarChart data={data.creditsByPerson} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="credits" name="Кредиты" fill="#9a83d6" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Просрочки по исполнителям" subtitle="Активные задачи с истёкшим дедлайном"><ResponsiveContainer width="100%" height={250}><BarChart data={data.overdueByPerson} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="count" name="Просрочки" fill="#df8589" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>
    </div>
    <section className="analytics-table-card"><div className="table-card-heading"><div><h2>Эффективность исполнителей</h2><p>Среднее производство рассчитывается по завершённым задачам.</p></div><span>{data.performers.length} исполнителей</span></div><div className="responsive-table"><table><thead><tr><th>Исполнитель</th><th>Задач</th><th>Завершено</th><th>Ср. время</th><th>Правки</th><th>AI-кредиты</th></tr></thead><tbody>{data.performers.map((person) => <tr key={person.id}><td><strong>{person.name}</strong></td><td>{person.tasks}</td><td>{person.completed}</td><td>{person.averageHours === null ? "—" : `${formatNumber(person.averageHours)} ч`}</td><td>{person.revisions}</td><td>{formatNumber(person.credits)}</td></tr>)}</tbody></table></div><div className="analytics-footnote">Полный цикл от создания до приёмки: {data.kpi.averageFullCycleHours === null ? "недостаточно данных" : `${formatNumber(data.kpi.averageFullCycleHours)} ч в среднем`}.</div></section>
  </div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="chart-card"><div className="chart-card-heading"><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>;
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";

type Log = { id: string; action: string; fromStatus: string | null; toStatus: string | null; createdAt: string; user: { id: string; name: string; role: string }; task: { id: string; offer: string; geo: string; status: string } };
type Result = { items: Log[]; page: number; limit: number; total: number; pages: number };
const actionNames: Record<string, string> = { TASK_CREATED: "Создана задача", TASK_UPDATED: "Изменено ТЗ", TASK_TAKEN: "Задача взята в работу", TASK_REVISION_STARTED: "Начата работа над правками", TASK_SUBMITTED: "Результат отправлен на проверку", TASK_ACCEPTED: "Работа принята", TASK_RETURNED_FOR_REVISION: "Возврат на правки", COMMENT_ADDED: "Добавлен комментарий", ATTACHMENT_ADDED: "Добавлен файл", AI_USAGE_ADDED: "Добавлен AI-расход", ASSIGNEE_REASSIGNED: "Переназначен исполнитель" };
const roleNames: Record<string, string> = { BUYER: "Байер", CREATIVE: "Креативщик", MANAGER: "Руководитель" };
const dateTime = (date: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

export function HistoryFeed({ initial }: { initial: Result }) {
  const [data, setData] = useState(initial);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: "30" });
      if (action) params.set("action", action); if (q.trim()) params.set("q", q.trim()); if (from) params.set("from", from); if (to) params.set("to", to);
      const response = await fetch(`/api/activity?${params}`, { cache: "no-store" }); const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось загрузить историю.");
      setData(payload); setPage(nextPage);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки."); }
    finally { setLoading(false); }
  }, [action, q, from, to]);

  return <div className="history-page"><div className="page-heading-row"><div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot"/> AUDIT TRAIL</div><h1>История действий</h1><p className="page-subtitle">Единая лента операций по задачам, доступная в рамках вашей роли.</p></div><div className="history-total"><Activity size={16}/><strong>{data.total}</strong><span>событий</span></div></div>
    <div className="history-filters"><label className="history-search"><Search size={15}/><input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(1); }} placeholder="Задача, исполнитель или действие"/></label><select value={action} onChange={(event) => setAction(event.target.value)}><option value="">Все действия</option>{Object.entries(actionNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label><CalendarDays size={14}/><input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label><span>До</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}/></label><button className="primary-button" disabled={loading} onClick={() => void load(1)}>Применить</button></div>
    <section className="history-card">{loading ? <div className="detail-empty">Загружаем события…</div> : data.items.length ? <div className="history-list">{data.items.map((item) => <article className="history-row" key={item.id}><span className={`history-icon history-${item.action.toLowerCase()}`}><Activity size={15}/></span><div className="history-row-main"><strong>{actionNames[item.action] ?? item.action}</strong><p><b>{item.user.name}</b> · {roleNames[item.user.role] ?? item.user.role} · <Link href={`/tasks/${item.task.id}`}>{item.task.offer} ({item.task.geo})</Link></p>{item.fromStatus && item.toStatus ? <small>{item.fromStatus} → {item.toStatus}</small> : null}</div><time>{dateTime(item.createdAt)}</time></article>)}</div> : <div className="history-empty"><Activity size={25}/><strong>Событий не найдено</strong><p>Измените фильтры или выберите другой период.</p></div>}
      <div className="history-pagination"><span>Страница {data.page} из {Math.max(1, data.pages)} · {data.total} событий</span><div><button className="secondary-button" disabled={loading || page <= 1} onClick={() => void load(page - 1)}><ChevronLeft size={14}/> Назад</button><button className="secondary-button" disabled={loading || page >= data.pages} onClick={() => void load(page + 1)}>Далее <ChevronRight size={14}/></button></div></div>
    </section></div>;
}

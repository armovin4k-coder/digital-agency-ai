"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import type { Priority, Role, TaskStatus } from "@prisma/client";
import { AlertCircle, ArrowDownWideNarrow, CalendarClock, Check, CircleDot, Clock3, Filter, Loader2, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

type Person = { id: string; name: string; avatar: string | null };
type Task = {
  id: string; offer: string; geo: string; creativeType: string; quantity: number; description: string;
  priority: Priority; deadline: string; status: TaskStatus; buyerId: string; assigneeId: string | null;
  createdAt: string; takenAt: string | null; submittedAt: string | null; completedAt: string | null; revisionCount: number;
  buyer: Person; assignee: Person | null; _count: { attachments: number; comments: number; aiUsages: number };
};

type Props = { user: { id: string; name: string; role: Role } };

const columns: Array<{ id: TaskStatus; title: string; description: string }> = [
  { id: "NEW", title: "Новые", description: "Ожидают исполнителя" },
  { id: "IN_PROGRESS", title: "В работе", description: "В производстве" },
  { id: "REVIEW", title: "На проверке", description: "Ожидают приёмки" },
  { id: "REVISION", title: "Правки", description: "Нужны доработки" },
  { id: "DONE", title: "Готово", description: "Принятые работы" },
];

const priorityLabels: Record<Priority, string> = { LOW: "Низкий", NORMAL: "Обычный", HIGH: "Высокий", URGENT: "Срочный" };
const typeLabels: Record<string, string> = { STATIC: "Статика", VIDEO: "Видео", UGC: "UGC", BANNER: "Баннер", PREVIEW: "Превью", OTHER: "Другое" };
const allowedTargets: Record<Role, Partial<Record<TaskStatus, TaskStatus[]>>> = {
  BUYER: { REVIEW: ["DONE", "REVISION"] },
  CREATIVE: { NEW: ["IN_PROGRESS"], IN_PROGRESS: ["REVIEW"], REVISION: ["IN_PROGRESS"] },
  MANAGER: {},
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
}
function isOverdue(task: Task) { return task.status !== "DONE" && new Date(task.deadline).getTime() < Date.now(); }
function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }

function TaskCardContent({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  return <>
    <div className="task-card-top"><span className="task-offer">{task.offer}</span><span className={`priority-pill priority-${task.priority.toLowerCase()}`}><i />{priorityLabels[task.priority]}</span></div>
    <div className="task-geo-line"><span className="geo-chip">{task.geo}</span><span className="type-quantity">{typeLabels[task.creativeType] ?? task.creativeType} <b>× {task.quantity}</b></span></div>
    <p className="task-description">{task.description}</p>
    <div className="task-card-footer">
      <div className={`deadline${overdue ? " overdue" : ""}`} title={`Срок: ${new Date(task.deadline).toLocaleString("ru-RU")}`}>
        {overdue ? <AlertCircle size={13} /> : <CalendarClock size={13} />}<span>{formatDate(task.deadline)}</span>
      </div>
      <div className="task-card-meta">
        {task.revisionCount > 0 && <span className="mini-meta revision-meta" title="Количество возвратов"><RefreshCw size={12} />{task.revisionCount}</span>}
        {task._count.attachments > 0 && <span className="mini-meta" title="Вложения">↗ {task._count.attachments}</span>}
        {task.assignee ? <span className="avatar avatar-small" title={task.assignee.name}>{initials(task.assignee.name)}</span> : <span className="unassigned-avatar" title="Нет исполнителя"><UserRound size={13} /></span>}
      </div>
    </div>
  </>;
}

function TaskCard({ task, draggable = true }: { task: Task; draggable?: boolean }) {
  const router = useRouter();
  const canDrag = draggable && task.status !== "DONE";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canDrag, data: { task } });
  const style = { transform: CSS.Translate.toString(transform) };
  return <article ref={setNodeRef} style={style} {...(canDrag ? { ...attributes, ...listeners } : {})} role="link" tabIndex={0} aria-label={`Открыть задачу ${task.offer}, ${task.geo}`} onClick={() => router.push(`/tasks/${task.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/tasks/${task.id}`); }} className={`task-card task-card-clickable${isDragging ? " task-card-dragging" : ""}`}><TaskCardContent task={task} /></article>;
}

function TaskCardOverlay({ task }: { task: Task }) {
  return <article className="task-card task-card-overlay"><TaskCardContent task={task} /></article>;
}

function BoardColumn({ column, tasks, role, activeTask, overId }: { column: (typeof columns)[number]; tasks: Task[]; role: Role; activeTask: Task | null; overId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const validFromActive = activeTask ? (allowedTargets[role][activeTask.status] ?? []).includes(column.id) : false;
  const highlighted = isOver || overId === column.id;
  return (
    <section ref={setNodeRef} className={`board-column column-${column.id.toLowerCase()}${highlighted ? (validFromActive ? " column-drop-valid" : " column-drop-invalid") : ""}`} aria-label={`${column.title}, ${tasks.length} задач`}>
      <div className="column-heading"><div className="column-title-wrap"><span className={`column-indicator indicator-${column.id.toLowerCase()}`} /><div><h2>{column.title}</h2><p>{column.description}</p></div></div><span className="column-count">{tasks.length}</span></div>
      <div className="column-cards">{tasks.length === 0 ? <div className="column-empty"><span><CircleDot size={16} /></span><p>Задач пока нет</p></div> : tasks.map((task) => <TaskCard key={task.id} task={task} draggable={(allowedTargets[role][task.status] ?? []).length > 0} />)}</div>
      {highlighted && activeTask && <div className={`drop-hint ${validFromActive ? "valid" : "invalid"}`}>{validFromActive ? "Отпустите, чтобы изменить статус" : "Переход недоступен"}</div>}
    </section>
  );
}

export function KanbanBoard({ user }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [peopleError, setPeopleError] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [priority, setPriority] = useState("");
  const [geo, setGeo] = useState("");
  const [offer, setOffer] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadlineBefore, setDeadlineBefore] = useState("");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const requestId = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const loadTasks = useCallback(async (quiet = false) => {
    const currentRequestId = ++requestId.current;
    if (!quiet) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (priority) params.set("priority", priority);
      if (geo.trim()) params.set("geo", geo.trim());
      if (offer.trim()) params.set("offer", offer.trim());
      if (assigneeId) params.set("assigneeId", assigneeId);
      if (mine) params.set("mine", "true");
      const items: Task[] = [];
      let page = 1;
      let pages = 1;
      do {
        params.set("page", String(page));
        const response = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось загрузить задачи.");
        items.push(...(payload.items ?? []));
        pages = payload.pages ?? 1;
        page++;
      } while (page <= pages);
      if (currentRequestId === requestId.current) setTasks(items);
    } catch (caught) {
      if (currentRequestId === requestId.current) {
        setError(caught instanceof Error ? caught.message : "Не удалось загрузить задачи.");
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [priority, geo, offer, assigneeId, mine]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);
  useEffect(() => {
    const loadPeople = async () => {
      try {
        const response = await fetch("/api/users/creatives", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message ?? "Не удалось загрузить список исполнителей.");
        setPeople(data.items ?? []);
      } catch (caught) {
        setPeopleError(caught instanceof Error ? caught.message : "Не удалось загрузить список исполнителей.");
      }
    };
    void loadPeople();
  }, []);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (deadlineBefore && task.deadline.slice(0, 10) > deadlineBefore) return false;
    const q = search.trim().toLocaleLowerCase("ru-RU");
    if (!q) return true;
    return [task.offer, task.geo, task.description, task.buyer.name, task.assignee?.name ?? ""].some((value) => value.toLocaleLowerCase("ru-RU").includes(q));
  }), [tasks, search, deadlineBefore]);

  async function handleDragStart(event: DragStartEvent) {
    const found = tasks.find((task) => task.id === String(event.active.id));
    setActiveTask(found ?? null);
  }
  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null); setOverId(null);
    const task = tasks.find((item) => item.id === String(event.active.id));
    const target = event.over?.id as TaskStatus | undefined;
    if (!task || !target || target === task.status) return;
    const allowed = allowedTargets[user.role][task.status] ?? [];
    if (!allowed.includes(target)) { toast.error("Этот переход статуса вам недоступен."); return; }

    let comment: string | undefined;
    if (target === "REVISION") {
      const entered = window.prompt("Напишите, что необходимо исправить (обязательно):");
      if (!entered?.trim()) { toast.info("Возврат отменён: комментарий обязателен."); return; }
      comment = entered.trim();
    }
    if (target === "REVIEW") {
      const resultUrl = window.prompt("Вставьте ссылку на готовый результат (обязательно):");
      if (!resultUrl?.trim()) { toast.info("Сдача отменена: сначала добавьте результат."); return; }
      try { new URL(resultUrl); } catch { toast.error("Укажите корректную ссылку на результат."); return; }
      const attachmentResponse = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resultUrl.trim(), type: "RESULT", fileName: "Результат по ссылке" }),
      });
      if (!attachmentResponse.ok) {
        const payload = await attachmentResponse.json(); toast.error(payload?.error?.message ?? "Не удалось добавить результат."); return;
      }
    }
    try {
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: target, ...(comment ? { comment } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось изменить статус.");
      toast.success(`Статус задачи «${task.offer}» изменён.`);
      await loadTasks(true);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Ошибка изменения статуса."); await loadTasks(true); }
  }

  const counts = useMemo(() => Object.fromEntries(columns.map((column) => [column.id, visibleTasks.filter((task) => task.status === column.id).length])) as Record<TaskStatus, number>, [visibleTasks]);
  const hasFilters = Boolean(priority || geo || offer || assigneeId || deadlineBefore || mine || search);

  return (
    <div className="board-page">
      <div className="page-heading-row">
        <div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot" /> CREATIVE OPERATIONS</div><h1>Доска задач</h1><p className="page-subtitle">Единое пространство для постановки и производства креативов.</p></div>
        <div className="heading-actions"><button className="secondary-button" onClick={() => void loadTasks(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /> Обновить</button>{user.role === "BUYER" && <button className="primary-button header-create" onClick={() => router.push("/tasks/new")}><Plus size={16} /> Создать задачу</button>}</div>
      </div>
      <div className="board-summary-row"><div className="summary-stat"><span className="summary-icon summary-purple"><ClipboardIcon /></span><div><strong>{visibleTasks.length}</strong><small>Задач в выборке</small></div></div><div className="summary-stat"><span className="summary-icon summary-blue"><Clock3 size={17} /></span><div><strong>{counts.IN_PROGRESS}</strong><small>В работе</small></div></div><div className="summary-stat"><span className="summary-icon summary-orange"><AlertCircle size={17} /></span><div><strong>{visibleTasks.filter(isOverdue).length}</strong><small>Просрочено</small></div></div><div className="summary-stat"><span className="summary-icon summary-green"><Check size={17} /></span><div><strong>{counts.DONE}</strong><small>Готово</small></div></div></div>
      <div className="filter-panel">
        <div className="filter-panel-title"><SlidersHorizontal size={15} /><span>Фильтры</span></div>
        <label className="search-control"><Search size={15} /><input aria-label="Поиск по задачам" placeholder="Поиск по офферу, GEO, описанию…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Приоритет" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Все приоритеты</option><option value="URGENT">Срочный</option><option value="HIGH">Высокий</option><option value="NORMAL">Обычный</option><option value="LOW">Низкий</option></select>
        <input className="filter-input filter-geo" aria-label="Фильтр GEO" placeholder="GEO" maxLength={8} value={geo} onChange={(event) => setGeo(event.target.value.toUpperCase())} />
        <input className="filter-input filter-offer" aria-label="Фильтр оффера" placeholder="Оффер" value={offer} onChange={(event) => setOffer(event.target.value)} />
        <input className="filter-input" type="date" aria-label="Дедлайн не позднее" value={deadlineBefore} onChange={(event) => setDeadlineBefore(event.target.value)} />
        {user.role !== "CREATIVE" && <select aria-label="Исполнитель" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Все исполнители</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>}
        {user.role === "CREATIVE" && <button className={`mine-toggle${mine ? " active" : ""}`} onClick={() => setMine((value) => !value)}><UserRound size={14} /> Мои</button>}
        {peopleError && <p className="inline-error" role="status">{peopleError}</p>}
        {hasFilters && <button className="clear-filters" onClick={() => { setPriority(""); setGeo(""); setOffer(""); setAssigneeId(""); setDeadlineBefore(""); setMine(false); setSearch(""); }}>Сбросить</button>}
      </div>
      {error && <div className="inline-error"><AlertCircle size={17} /> <span>{error}</span><button onClick={() => void loadTasks()}>Повторить</button></div>}
      {loading ? <div className="board-loading"><Loader2 size={25} className="spin" /><span>Загружаем задачи…</span></div> : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={(event) => void handleDragEnd(event)} onDragCancel={() => { setActiveTask(null); setOverId(null); }} onDragOver={(event) => setOverId(event.over ? String(event.over.id) : null)}>
          <div className="kanban-board" aria-label="Канбан-доска">
            {columns.map((column) => <BoardColumn key={column.id} column={column} tasks={visibleTasks.filter((task) => task.status === column.id)} role={user.role} activeTask={activeTask} overId={overId} />)}
          </div>
          <DragOverlay>{activeTask ? <TaskCardOverlay task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      )}
      {!loading && !error && visibleTasks.length === 0 && <div className="empty-board"><span><Filter size={22} /></span><strong>{hasFilters ? "Ничего не найдено" : "Пока нет задач"}</strong><p>{hasFilters ? "Измените фильтры или сбросьте их." : user.role === "BUYER" ? "Создайте первую задачу, чтобы начать работу." : "Когда появятся задачи, они отобразятся здесь."}</p>{hasFilters && <button className="secondary-button" onClick={() => { setPriority(""); setGeo(""); setOffer(""); setAssigneeId(""); setMine(false); setSearch(""); }}>Сбросить фильтры</button>}</div>}
      <div className="board-footnote"><Sparkles size={13} /> Перетаскивайте карточки между колонками, чтобы менять статус. Доступные переходы зависят от вашей роли.</div>
    </div>
  );
}

function ClipboardIcon() { return <ArrowDownWideNarrow size={17} />; }

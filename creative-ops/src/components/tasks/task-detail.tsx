"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, FileImage, FileText, Film, History, Link2, Loader2, Paperclip, Plus, RefreshCw, Send, Timer, UserRound, X } from "lucide-react";
import type { Role, TaskStatus } from "@prisma/client";

type User = { id: string; name: string; role: Role };
type Person = { id: string; name: string; avatar?: string | null; role?: Role };
type Attachment = { id: string; url: string; storagePath: string | null; type: "REFERENCE" | "RESULT"; revisionRound: number; fileName: string | null; mimeType: string | null; sizeBytes: number | null; createdAt: string; user: Person };
type TaskData = {
  id: string; offer: string; geo: string; creativeType: string; quantity: number; description: string; references: string[]; priority: string; deadline: string; status: TaskStatus; buyerId: string; assigneeId: string | null; createdAt: string; takenAt: string | null; submittedAt: string | null; completedAt: string | null; revisionCount: number;
  buyer: Person; assignee: Person | null; attachments: Attachment[]; aiUsages: Array<{ id: string; service: string; credits: string; revisionRound: number; note: string | null; createdAt: string; user: Person }>; comments: Array<{ id: string; text: string; createdAt: string; user: Person }>; activityLogs: Array<{ id: string; action: string; fromStatus: TaskStatus | null; toStatus: TaskStatus | null; meta: unknown; createdAt: string; user: Person }>;
};
type TaskEditDraft = { offer: string; geo: string; creativeType: string; quantity: string; description: string; priority: string; deadline: string };

const statusNames: Record<TaskStatus, string> = { NEW: "Новые", IN_PROGRESS: "В работе", REVIEW: "На проверке", REVISION: "Правки", DONE: "Готово" };
const typeNames: Record<string, string> = { STATIC: "Статика", VIDEO: "Видео", UGC: "UGC", BANNER: "Баннер", PREVIEW: "Превью", OTHER: "Другое" };
const serviceNames = ["MIDJOURNEY", "RUNWAY", "CHATGPT", "KLING", "ELEVENLABS", "HEYGEN", "OTHER"];
const serviceLabels: Record<string, string> = { MIDJOURNEY: "Midjourney", RUNWAY: "Runway", CHATGPT: "ChatGPT", KLING: "Kling", ELEVENLABS: "ElevenLabs", HEYGEN: "HeyGen", OTHER: "Другое" };
const actionLabels: Record<string, string> = { TASK_CREATED: "Задача создана", TASK_UPDATED: "Техническое задание обновлено", TASK_TAKEN: "Задача взята в работу", TASK_REVISION_STARTED: "Начата работа над правками", TASK_SUBMITTED: "Результат отправлен на проверку", TASK_ACCEPTED: "Работа принята", TASK_RETURNED_FOR_REVISION: "Задача возвращена на правки", COMMENT_ADDED: "Добавлен комментарий", ATTACHMENT_ADDED: "Добавлен файл", AI_USAGE_ADDED: "Добавлен расход AI", ASSIGNEE_REASSIGNED: "Переназначен исполнитель" };
const dateTime = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const toDateTimeInput = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const duration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return "—";
  const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const days = Math.floor(ms / 86400000); const hours = Math.floor((ms % 86400000) / 3600000); const minutes = Math.floor((ms % 3600000) / 60000);
  return days ? `${days} д ${hours} ч` : hours ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
};
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

export function TaskDetail({ task: initialTask, user }: { task: TaskData; user: User }) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [revisionComment, setRevisionComment] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [aiService, setAiService] = useState("MIDJOURNEY");
  const [aiCredits, setAiCredits] = useState("1");
  const [aiNote, setAiNote] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultFiles, setResultFiles] = useState<File[]>([]);
  const [creatives, setCreatives] = useState<Person[]>([]);
  const [assignee, setAssignee] = useState(task.assigneeId ?? "");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<TaskEditDraft>(() => ({ offer: initialTask.offer, geo: initialTask.geo, creativeType: initialTask.creativeType, quantity: String(initialTask.quantity), description: initialTask.description, priority: initialTask.priority, deadline: toDateTimeInput(initialTask.deadline) }));
  const [linkReference, setLinkReference] = useState("");
  const currentRound = task.revisionCount;
  const creditsTotal = task.aiUsages.reduce((sum, item) => sum + Number(item.credits), 0);
  const roundGroups = useMemo(() => {
    const grouped = new Map<number, Attachment[]>();
    task.attachments.filter((item) => item.type === "RESULT").forEach((item) => grouped.set(item.revisionRound, [...(grouped.get(item.revisionRound) ?? []), item]));
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [task.attachments]);

  async function refreshTask() {
    const response = await fetch(`/api/tasks/${task.id}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось обновить задачу.");
    setTask(payload.data);
    router.refresh();
  }
  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось выполнить действие.");
    return payload.data;
  }
  async function transition(toStatus: TaskStatus, text?: string) {
    setPending(true);
    try { await post(`/api/tasks/${task.id}/status`, { toStatus, ...(text ? { comment: text } : {}) }); await refreshTask(); toast.success(`Статус изменён: ${statusNames[toStatus]}.`); setShowRevision(false); setRevisionComment(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка смены статуса."); }
    finally { setPending(false); }
  }
  async function addComment(event: FormEvent) {
    event.preventDefault(); if (!comment.trim()) return;
    setPending(true); try { await post(`/api/tasks/${task.id}/comments`, { text: comment.trim() }); setComment(""); await refreshTask(); toast.success("Комментарий добавлен."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось добавить комментарий."); } finally { setPending(false); }
  }
  async function addReference() {
    try { const url = new URL(linkReference); if (!(["http:", "https:"].includes(url.protocol))) throw new Error(); }
    catch { toast.error("Введите корректную HTTP/HTTPS ссылку."); return; }
    setPending(true); try { await post(`/api/tasks/${task.id}/attachments`, { url: linkReference, type: "REFERENCE", fileName: "Референс по ссылке", mimeType: "text/uri-list" }); setLinkReference(""); await refreshTask(); toast.success("Референс добавлен."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось добавить референс."); } finally { setPending(false); }
  }
  function handleResultFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf"]);
    const valid = picked.filter((file) => allowed.has(file.type) && file.size <= 25 * 1024 * 1024);
    if (valid.length !== picked.length) toast.error("Поддерживаются изображения, видео и PDF до 25 МБ.");
    setResultFiles((old) => [...old, ...valid].slice(0, 10)); event.target.value = "";
  }
  async function addResult() {
    if (!resultUrl.trim() && resultFiles.length === 0) { toast.error("Добавьте ссылку или файл результата."); return; }
    setPending(true); let failed = 0;
    try {
      if (resultUrl.trim()) {
        try { const parsed = new URL(resultUrl); if (!(["http:", "https:"].includes(parsed.protocol))) throw new Error(); await post(`/api/tasks/${task.id}/attachments`, { url: resultUrl, type: "RESULT", fileName: "Результат по ссылке", mimeType: "text/uri-list" }); }
        catch (error) { failed++; toast.error(error instanceof Error ? error.message : "Некорректная ссылка."); }
      }
      for (const file of resultFiles) {
        try {
          const blob = await upload(file.name, file, { access: "private", handleUploadUrl: "/api/upload", clientPayload: JSON.stringify({ kind: "task-result", taskId: task.id }) });
          await post(`/api/tasks/${task.id}/attachments`, { storagePath: blob.pathname, type: "RESULT", fileName: file.name, mimeType: file.type, sizeBytes: file.size });
        } catch { failed++; }
      }
      setResultUrl(""); setResultFiles([]); await refreshTask();
      if (failed) toast.warning(`Не удалось добавить ${failed} вложений.`); else toast.success("Результаты добавлены в текущий раунд.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка добавления результата."); }
    finally { setPending(false); }
  }
  async function addAiUsage(event: FormEvent) {
    event.preventDefault(); const credits = Number(aiCredits); if (!Number.isFinite(credits) || credits <= 0) { toast.error("Укажите положительное число кредитов."); return; }
    setPending(true); try { await post(`/api/tasks/${task.id}/ai-usage`, { service: aiService, credits, revisionRound: currentRound, note: aiNote }); setAiCredits("1"); setAiNote(""); await refreshTask(); toast.success("AI-расход добавлен."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить расход."); } finally { setPending(false); }
  }
  async function openAssign() {
    if (!creatives.length) { try { const response = await fetch("/api/users/creatives", { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error("Не удалось загрузить исполнителей."); setCreatives(payload.items ?? []); } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки исполнителей."); return; } }
    setAssignOpen(true);
  }
  async function saveAssignee() {
    if (!assignee) return; setPending(true); try { await post(`/api/tasks/${task.id}/assign`, { assigneeId: assignee }); await refreshTask(); setAssignOpen(false); toast.success("Исполнитель переназначен."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось переназначить."); } finally { setPending(false); }
  }
  function openEdit() {
    setEditDraft({ offer: task.offer, geo: task.geo, creativeType: task.creativeType, quantity: String(task.quantity), description: task.description, priority: task.priority, deadline: toDateTimeInput(task.deadline) });
    setEditOpen(true);
  }
  async function saveTaskEdit(event: FormEvent) {
    event.preventDefault();
    if (!editDraft.deadline || new Date(editDraft.deadline).getTime() <= Date.now()) { toast.error("Дедлайн должен быть в будущем."); return; }
    setPending(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer: editDraft.offer, geo: editDraft.geo.toUpperCase(), creativeType: editDraft.creativeType, quantity: Number(editDraft.quantity), description: editDraft.description, priority: editDraft.priority, deadline: new Date(editDraft.deadline).toISOString(), references: task.references }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось сохранить техническое задание.");
      await refreshTask(); setEditOpen(false); toast.success("Техническое задание обновлено.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка сохранения задачи."); }
    finally { setPending(false); }
  }

  const canEdit = user.role === "BUYER" && task.buyerId === user.id && task.status === "NEW";
  const canTake = user.role === "CREATIVE" && task.status === "NEW";
  const canStartRevision = user.role === "CREATIVE" && task.status === "REVISION" && task.assigneeId === user.id;
  const canSubmit = user.role === "CREATIVE" && task.status === "IN_PROGRESS" && task.assigneeId === user.id;
  const canReview = user.role === "BUYER" && task.status === "REVIEW" && task.buyerId === user.id;
  const canAddResult = user.role === "CREATIVE" && task.status === "IN_PROGRESS" && task.assigneeId === user.id;
  const canAddAi = canAddResult;
  const canReassign = user.role === "MANAGER" && ["IN_PROGRESS", "REVIEW", "REVISION"].includes(task.status);

  return <div className="task-detail-page">
    <Link href="/" className="back-link"><ArrowLeft size={15}/> Назад к доске</Link>
    <div className="task-detail-heading"><div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot"/> TASK WORKSPACE · {task.id.slice(-7).toUpperCase()}</div><h1>{task.offer}</h1><p className="page-subtitle">{task.geo} · {typeNames[task.creativeType] ?? task.creativeType} × {task.quantity} · дедлайн {dateTime(task.deadline)}</p></div><span className={`status-pill status-${task.status.toLowerCase()}`}>{statusNames[task.status]}</span></div>
    <div className="task-detail-layout">
      <div className="task-detail-main">
        <section className="detail-card"><div className="detail-card-heading"><div><h2>Техническое задание</h2><p>Исходные требования и параметры задачи</p></div><span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority === "URGENT" ? "Срочный" : task.priority === "HIGH" ? "Высокий" : task.priority === "LOW" ? "Низкий" : "Обычный"}</span></div><p className="task-brief-text">{task.description}</p><div className="detail-meta-grid"><Meta label="Создал" value={task.buyer.name}/><Meta label="Исполнитель" value={task.assignee?.name ?? "Не назначен"}/><Meta label="GEO" value={task.geo}/><Meta label="Количество" value={String(task.quantity)}/><Meta label="Раунд правок" value={String(task.revisionCount)}/><Meta label="Создана" value={dateTime(task.createdAt)}/></div>{task.references.length > 0 && <div className="detail-links"><strong>Ссылки из ТЗ</strong>{task.references.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer"><Link2 size={13}/>{url}</a>)}</div>}{user.role === "BUYER" && task.buyerId === user.id && task.status === "NEW" && <div className="reference-input-row detail-reference-add"><input type="url" placeholder="Добавить ссылку на референс" value={linkReference} onChange={(event) => setLinkReference(event.target.value)}/><button type="button" className="secondary-button" disabled={pending || !linkReference.trim()} onClick={() => void addReference()}><Plus size={13}/> Добавить</button></div>}</section>
        <section className="detail-card"><div className="detail-card-heading"><div><h2>Результаты и вложения</h2><p>Файлы сгруппированы по итерациям производства</p></div><span className="detail-count">{task.attachments.length} файлов</span></div>
          {task.attachments.filter((item) => item.type === "REFERENCE").length > 0 && <div className="attachment-group"><h3>Референсы</h3><div className="attachment-list">{task.attachments.filter((item) => item.type === "REFERENCE").map((item) => <AttachmentItem key={item.id} item={item}/>)}</div></div>}
          {roundGroups.length === 0 && <Empty text="Результаты пока не прикреплены."/>}
          {roundGroups.map(([round, items]) => <div className="attachment-group" key={round}><h3>Раунд {round + 1} {round === currentRound ? <span className="current-round-tag">Текущий</span> : null}</h3><div className="attachment-list">{items.map((item) => <AttachmentItem key={item.id} item={item}/>)}</div></div>)}
          {canAddResult && <div className="result-upload"><h3>Добавить результат · раунд {currentRound + 1}</h3><div className="reference-input-row"><input type="url" placeholder="https://ссылка-на-результат" value={resultUrl} onChange={(event) => setResultUrl(event.target.value)}/></div><label className="upload-dropzone compact-dropzone"><input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" onChange={handleResultFiles}/><Paperclip size={18}/><strong>Прикрепить файлы результата</strong><span>До 25 МБ каждый</span></label>{resultFiles.length > 0 && <p className="selected-file-note">Выбрано файлов: {resultFiles.length}</p>}<button className="primary-button" disabled={pending} onClick={() => void addResult()}><Plus size={14}/> Добавить результат</button></div>}
        </section>
        <section className="detail-card"><div className="detail-card-heading"><div><h2>AI-расходы</h2><p>Учёт кредитов по сервисам и раундам</p></div><strong className="credit-total">{creditsTotal.toFixed(2)} <small>кредитов</small></strong></div>
          {task.aiUsages.length ? <div className="responsive-table"><table><thead><tr><th>Сервис</th><th>Кредиты</th><th>Раунд</th><th>Исполнитель</th><th>Дата</th></tr></thead><tbody>{task.aiUsages.map((item) => <tr key={item.id}><td>{serviceLabels[item.service] ?? item.service}{item.note ? <small className="table-subline">{item.note}</small> : null}</td><td>{Number(item.credits).toFixed(2)}</td><td>{item.revisionRound + 1}</td><td>{item.user.name}</td><td>{dateTime(item.createdAt)}</td></tr>)}</tbody></table></div> : <Empty text="Расходы ещё не добавлены."/>}
          {canAddAi && <form className="ai-entry-form" onSubmit={addAiUsage}><label>Сервис<select value={aiService} onChange={(event) => setAiService(event.target.value)}>{serviceNames.map((service) => <option key={service} value={service}>{serviceLabels[service]}</option>)}</select></label><label>Кредиты<input type="number" min="0.0001" step="0.0001" value={aiCredits} onChange={(event) => setAiCredits(event.target.value)}/></label><label>Примечание<input value={aiNote} onChange={(event) => setAiNote(event.target.value)} placeholder="Например, 10 генераций" maxLength={2000}/></label><button className="primary-button" disabled={pending}><Plus size={14}/> Добавить расход</button></form>}
        </section>
        <section className="detail-card"><div className="detail-card-heading"><div><h2>Комментарии</h2><p>Обратная связь и рабочее обсуждение</p></div><span className="detail-count">{task.comments.length}</span></div><div className="comment-list">{task.comments.length ? task.comments.map((item) => <article className="comment-item" key={item.id}><span className="avatar avatar-comment">{initials(item.user.name)}</span><div className="comment-body"><div><strong>{item.user.name}</strong><time>{dateTime(item.createdAt)}</time></div><p>{item.text}</p></div></article>) : <Empty text="Комментариев пока нет."/>}</div><form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={5000} placeholder="Напишите комментарий…"/><button className="primary-button" disabled={pending || !comment.trim()}><Send size={14}/> Отправить</button></form></section>
        <section className="detail-card"><div className="detail-card-heading"><div><h2>История действий</h2><p>Неизменяемая лента событий задачи</p></div><History size={17} className="muted-icon"/></div><div className="task-event-list">{task.activityLogs.map((event) => <div className="task-event" key={event.id}><span className="event-dot"/><div><strong>{actionLabels[event.action] ?? event.action}</strong><p>{event.user.name}{event.fromStatus && event.toStatus ? ` · ${statusNames[event.fromStatus]} → ${statusNames[event.toStatus]}` : ""}</p><time>{dateTime(event.createdAt)}</time></div></div>)}</div></section>
      </div>
      <aside className="task-detail-aside">
        <section className="detail-card action-card"><h2>Действия</h2>{canEdit && <button className="secondary-button full-button" disabled={pending} onClick={openEdit}><FileText size={15}/> Редактировать ТЗ</button>}{canTake && <button className="primary-button full-button" disabled={pending} onClick={() => void transition("IN_PROGRESS")}><Check size={15}/> Взять задачу</button>}{canStartRevision && <button className="primary-button full-button" disabled={pending} onClick={() => void transition("IN_PROGRESS")}><RefreshCw size={15}/> Начать правки</button>}{canSubmit && <button className="primary-button full-button" disabled={pending || !task.attachments.some((item) => item.type === "RESULT" && item.revisionRound === currentRound)} onClick={() => void transition("REVIEW")}><Send size={15}/> Сдать на проверку</button>}{canReview && <><button className="primary-button full-button" disabled={pending} onClick={() => void transition("DONE")}><Check size={15}/> Принять работу</button>{!showRevision ? <button className="secondary-button full-button" onClick={() => setShowRevision(true)}><RefreshCw size={15}/> Вернуть на правки</button> : <div className="revision-feedback"><textarea rows={4} value={revisionComment} onChange={(event) => setRevisionComment(event.target.value)} placeholder="Что необходимо исправить?"/><button className="primary-button full-button" disabled={pending || !revisionComment.trim()} onClick={() => void transition("REVISION", revisionComment)}>Отправить на правки</button><button className="text-button" onClick={() => setShowRevision(false)}>Отмена</button></div>}</>}{canReassign && <button className="secondary-button full-button" onClick={() => void openAssign()}><UserRound size={15}/> Переназначить исполнителя</button>}{!canTake && !canStartRevision && !canSubmit && !canReview && !canReassign && <p className="action-hint">Для вашей роли сейчас нет доступных действий со статусом.</p>}</section>
        <section className="detail-card timeline-card"><h2>Временная шкала</h2><TimelineItem title="Создана" date={task.createdAt} durationText="" active/><TimelineItem title="Взята в работу" date={task.takenAt} durationText={duration(task.createdAt, task.takenAt)}/><TimelineItem title="Последняя сдача" date={task.submittedAt} durationText={duration(task.takenAt, task.submittedAt)}/><TimelineItem title="Завершена" date={task.completedAt} durationText={duration(task.submittedAt, task.completedAt)}/><div className="timeline-total"><span><Timer size={14}/> Полный цикл</span><strong>{duration(task.createdAt, task.completedAt)}</strong></div></section>
        <section className="detail-card compact-info"><div><span>Байер</span><strong>{task.buyer.name}</strong></div><div><span>Креативщик</span><strong>{task.assignee?.name ?? "Не назначен"}</strong></div><div><span>Возвраты на правки</span><strong>{task.revisionCount}</strong></div><div><span>AI-кредиты суммарно</span><strong>{creditsTotal.toFixed(2)}</strong></div></section>
      </aside>
    </div>
    {editOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}><section className="assign-modal task-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><button className="modal-close" aria-label="Закрыть" onClick={() => setEditOpen(false)}><X size={17}/></button><h2 id="edit-title">Редактировать техническое задание</h2><p>Изменения доступны автору только пока задача находится в статусе «Новые».</p><form onSubmit={saveTaskEdit} className="task-edit-form"><label>Оффер<input required minLength={2} maxLength={160} value={editDraft.offer} onChange={(event) => setEditDraft((draft) => ({ ...draft, offer: event.target.value }))}/></label><div className="edit-form-grid"><label>GEO<input required minLength={2} maxLength={8} value={editDraft.geo} onChange={(event) => setEditDraft((draft) => ({ ...draft, geo: event.target.value.toUpperCase() }))}/></label><label>Тип креатива<select value={editDraft.creativeType} onChange={(event) => setEditDraft((draft) => ({ ...draft, creativeType: event.target.value }))}>{Object.entries(typeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Количество<input type="number" required min={1} max={500} value={editDraft.quantity} onChange={(event) => setEditDraft((draft) => ({ ...draft, quantity: event.target.value }))}/></label><label>Приоритет<select value={editDraft.priority} onChange={(event) => setEditDraft((draft) => ({ ...draft, priority: event.target.value }))}><option value="LOW">Низкий</option><option value="NORMAL">Обычный</option><option value="HIGH">Высокий</option><option value="URGENT">Срочный</option></select></label></div><label>Описание<textarea required minLength={10} maxLength={10000} rows={5} value={editDraft.description} onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}/></label><label>Дедлайн<input required type="datetime-local" value={editDraft.deadline} onChange={(event) => setEditDraft((draft) => ({ ...draft, deadline: event.target.value }))}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditOpen(false)}>Отмена</button><button type="submit" className="primary-button" disabled={pending}>Сохранить изменения</button></div></form></section></div>}
    {assignOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignOpen(false); }}><section className="assign-modal" role="dialog" aria-modal="true" aria-labelledby="assign-title"><button className="modal-close" aria-label="Закрыть" onClick={() => setAssignOpen(false)}><X size={17}/></button><h2 id="assign-title">Переназначить задачу</h2><p>Руководитель меняет исполнителя, не затрагивая статус.</p><label>Новый исполнитель<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Выберите креативщика</option>{creatives.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><div className="modal-actions"><button className="secondary-button" onClick={() => setAssignOpen(false)}>Отмена</button><button className="primary-button" disabled={pending || !assignee || assignee === task.assigneeId} onClick={() => void saveAssignee()}>Сохранить</button></div></section></div>}
    {pending && <div className="pending-indicator"><Loader2 size={14} className="spin"/> Сохраняем изменения…</div>}
  </div>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="detail-meta"><small>{label}</small><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="detail-empty">{text}</div>; }
function AttachmentItem({ item }: { item: Attachment }) { const Icon = item.mimeType?.startsWith("video/") ? Film : item.mimeType?.startsWith("image/") ? FileImage : FileText; const href = item.storagePath ? `/api/attachments/${item.id}/file` : item.url; return <a className="attachment-item" href={href} target="_blank" rel="noreferrer"><span className="attachment-icon"><Icon size={16}/></span><span><strong>{item.fileName ?? "Вложение"}</strong><small>{item.user.name} · {dateTime(item.createdAt)}</small></span><Download size={14}/></a>; }
function TimelineItem({ title, date, durationText, active }: { title: string; date: string | null; durationText: string; active?: boolean }) { return <div className={`timeline-item${active ? " active" : ""}${date ? " complete" : ""}`}><span className="timeline-marker"/><div><strong>{title}</strong><small>{date ? dateTime(date) : "Ожидается"}</small>{durationText && date ? <em>{durationText}</em> : null}</div></div>; }

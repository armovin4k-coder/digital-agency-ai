"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarClock, FilePlus2, Link2, Loader2, Plus, Sparkles, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const creativeTypes = [
  ["STATIC", "Статика"], ["VIDEO", "Видео"], ["UGC", "UGC"], ["BANNER", "Баннер"], ["PREVIEW", "Превью"], ["OTHER", "Другое"],
];
const priorities = [["LOW", "Низкий"], ["NORMAL", "Обычный"], ["HIGH", "Высокий"], ["URGENT", "Срочный"]];

export function CreateTaskForm() {
  const router = useRouter();
  const [offer, setOffer] = useState("");
  const [geo, setGeo] = useState("BR");
  const [creativeType, setCreativeType] = useState("STATIC");
  const [quantity, setQuantity] = useState("3");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [deadline, setDeadline] = useState(() => {
    const value = new Date(Date.now() + 48 * 60 * 60 * 1000);
    value.setMinutes(0, 0, 0);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [referenceInput, setReferenceInput] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  function addReference() {
    const value = referenceInput.trim();
    if (!value) return;
    try { const parsed = new URL(value); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); }
    catch { toast.error("Введите корректную ссылку HTTP или HTTPS."); return; }
    if (references.includes(value)) { toast.info("Эта ссылка уже добавлена."); return; }
    if (references.length >= 30) { toast.error("Можно добавить не более 30 ссылок."); return; }
    setReferences((current) => [...current, value]); setReferenceInput("");
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf"]);
    const allowed = selected.filter((file) => allowedMime.has(file.type));
    const tooLarge = allowed.filter((file) => file.size > 25 * 1024 * 1024);
    if (allowed.length !== selected.length) toast.error("Можно прикреплять изображения, видео и PDF.");
    if (tooLarge.length) toast.error("Максимальный размер одного файла — 25 МБ.");
    const accepted = allowed.filter((file) => file.size <= 25 * 1024 * 1024);
    setFiles((current) => [...current, ...accepted].slice(0, 10));
    event.target.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError("");
    if (description.trim().length < 10) { setFormError("Опишите задачу подробнее — минимум 10 символов."); return; }
    if (new Date(deadline).getTime() <= Date.now()) { setFormError("Дедлайн должен быть в будущем."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer, geo, creativeType, quantity: Number(quantity), description, priority, deadline: new Date(deadline).toISOString(), references }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось создать задачу.");
      const taskId = payload.data.id as string;

      let failedAttachments = 0;
      const referenceResults = await Promise.allSettled(references.map((url) => fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: "REFERENCE", fileName: "Референс по ссылке", mimeType: "text/uri-list" }),
      })));
      failedAttachments += referenceResults.filter((result) => result.status === "rejected" || !result.value.ok).length;

      for (const file of files) {
        try {
          const blob = await upload(file.name, file, {
            access: "private",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ kind: "task-reference", taskId }),
          });
          const attachResponse = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath: blob.pathname, type: "REFERENCE", fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
          });
          if (!attachResponse.ok) failedAttachments += 1;
        } catch {
          failedAttachments += 1;
        }
      }

      if (failedAttachments) toast.warning(`Задача создана, но ${failedAttachments} вложений не удалось добавить. Их можно приложить позже.`);
      else toast.success("Задача создана и отправлена на доску.");
      router.push("/"); router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Произошла ошибка при создании задачи.";
      setFormError(message); toast.error(message);
    } finally { setPending(false); }
  }

  return (
    <div className="create-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> Назад к доске</Link>
      <div className="page-heading-row create-heading"><div><div className="eyebrow eyebrow-row"><span className="eyebrow-dot" /> TASK BRIEF</div><h1>Новая задача</h1><p className="page-subtitle">Сформулируйте понятное ТЗ — это ускорит производство и сократит количество правок.</p></div><span className="form-step-chip"><Sparkles size={14} /> Новая задача</span></div>
      <form className="task-form-layout" onSubmit={submit}>
        <div className="task-form-main">
          <section className="form-card"><div className="form-section-heading"><span className="form-section-icon"><FilePlus2 size={17} /></span><div><h2>Основная информация</h2><p>Что нужно создать и для какого оффера?</p></div></div>
            <div className="form-grid form-grid-two">
              <label className="field-label field-span-two">Оффер <span>*</span><Input required minLength={2} maxLength={160} placeholder="Например, Nutra — суставы" value={offer} onChange={(event) => setOffer(event.target.value)} /></label>
              <label className="field-label">GEO <span>*</span><input required minLength={2} maxLength={8} placeholder="BR" value={geo} onChange={(event) => setGeo(event.target.value.toUpperCase())} /></label>
              <label className="field-label">Тип креатива <span>*</span><select value={creativeType} onChange={(event) => setCreativeType(event.target.value)}>{creativeTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field-label">Количество <span>*</span><input required type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
              <label className="field-label">Приоритет <span>*</span><select value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </section>
          <section className="form-card"><div className="form-section-heading"><span className="form-section-icon"><ClipboardBriefcaseIcon /></span><div><h2>Техническое задание</h2><p>Опишите задачу, требования и критерии готовности.</p></div></div>
            <label className="field-label">Описание <span>*</span><Textarea required minLength={10} maxLength={10000} rows={7} placeholder="Опишите идею, целевую аудиторию, основные тезисы, обязательные элементы, ограничения и критерии готовности…" value={description} onChange={(event) => setDescription(event.target.value)} /><small className="field-hint">{description.length}/10 000 символов. Чем точнее бриф, тем меньше итераций.</small></label>
          </section>
          <section className="form-card"><div className="form-section-heading"><span className="form-section-icon"><Link2 size={17} /></span><div><h2>Референсы и материалы</h2><p>Добавьте ссылки и файлы, которые помогут выполнить задачу.</p></div></div>
            <div className="reference-input-row"><input aria-label="Ссылка на референс" type="url" placeholder="https://example.com/reference" value={referenceInput} onChange={(event) => setReferenceInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addReference(); } }} /><button type="button" className="secondary-button" onClick={addReference}><Plus size={15} /> Добавить</button></div>
            {references.length > 0 && <div className="reference-list">{references.map((reference) => <div className="reference-item" key={reference}><Link2 size={14} /><a href={reference} target="_blank" rel="noreferrer">{reference}</a><button type="button" aria-label="Удалить ссылку" onClick={() => setReferences((current) => current.filter((item) => item !== reference))}><Trash2 size={14} /></button></div>)}</div>}
            <label className="upload-dropzone"><input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" onChange={addFiles} /><UploadCloud size={22} /><strong>Нажмите, чтобы выбрать файлы</strong><span>Изображения, видео или PDF · до 25 МБ каждый · максимум 10 файлов</span></label>
            {files.length > 0 && <div className="selected-files">{files.map((file, index) => <div className="selected-file" key={`${file.name}-${index}`}><FilePlus2 size={14} /><span>{file.name}<small>{(file.size / (1024 * 1024)).toFixed(1)} МБ</small></span><button type="button" aria-label={`Удалить ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}</div>}
            <p className="upload-note"><ArrowUpRight size={13} /> Файлы хранятся в private Vercel Blob и доступны участникам с правом просмотра задачи. Для загрузки настройте BLOB_READ_WRITE_TOKEN; без него можно добавить ссылки на референсы.</p>
          </section>
        </div>
        <aside className="task-form-aside">
          <section className="form-card deadline-card"><div className="form-section-heading"><span className="form-section-icon"><CalendarClock size={17} /></span><div><h2>Срок выполнения</h2><p>Когда задача должна быть готова?</p></div></div><label className="field-label">Дедлайн <span>*</span><input required type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><div className="deadline-tip"><span className="tip-dot" /> Учитывайте время на проверку результата.</div></section>
          <section className="form-card publish-card"><h3>Перед отправкой</h3><ul><li>Указан понятный оффер и GEO</li><li>Выбран тип и количество креативов</li><li>Описаны требования к результату</li><li>Установлен реалистичный дедлайн</li></ul>{formError && <p className="form-error" role="alert">{formError}</p>}<Button className="primary-button publish-button" type="submit" disabled={pending}>{pending ? <><Loader2 size={16} className="spin" /> Создаём задачу…</> : <><Plus size={16} /> Создать задачу</>}</Button><p className="publish-hint">После создания задача появится в колонке «Новые».</p></section>
        </aside>
      </form>
    </div>
  );
}

function ClipboardBriefcaseIcon() { return <FilePlus2 size={17} />; }

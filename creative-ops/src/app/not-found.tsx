import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="error-screen">
      <section className="error-card">
        <span className="error-icon"><SearchX size={22} /></span>
        <p className="eyebrow">404 · CREATIVE OPS</p>
        <h1>Страница не найдена</h1>
        <p>Возможно, ссылка устарела или у вас нет доступа к этому ресурсу.</p>
        <Link className="primary-button" href="/"><ArrowLeft size={15} /> Вернуться к задачам</Link>
      </section>
    </main>
  );
}

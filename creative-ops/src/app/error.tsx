"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Creative Ops application error:", error); }, [error]);
  return (
    <main className="error-screen">
      <section className="error-card" role="alert">
        <span className="error-icon"><AlertTriangle size={22} /></span>
        <p className="eyebrow">CREATIVE OPS</p>
        <h1>Не удалось загрузить страницу</h1>
        <p>Произошла непредвиденная ошибка. Попробуйте обновить страницу. Если ошибка повторяется, обратитесь к администратору команды.</p>
        {error.digest ? <small>Код ошибки: {error.digest}</small> : null}
        <button className="primary-button" onClick={() => reset()}><RefreshCw size={15} /> Повторить</button>
      </section>
    </main>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { demoAccounts } from "@/lib/demo-accounts";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const demoPassword =
  process.env.NODE_ENV === "production" ? "" : process.env.NEXT_PUBLIC_DEMO_USER_PASSWORD ?? "";
const showDemoAccounts = process.env.NODE_ENV !== "production";

const roleLabels: Record<string, string> = {
  BUYER: "Байер",
  CREATIVE: "Креативщик",
  MANAGER: "Руководитель",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setPending(false);
    if (result?.error) {
      setError("Не удалось войти. Проверьте email и пароль.");
      return;
    }
    window.location.assign(result?.url ?? "/");
  }

  async function enterDemo(accountEmail: string) {
    setError("");
    setPending(true);
    const result = await signIn("credentials", {
      email: accountEmail,
      password: demoPassword,
      redirect: false,
      callbackUrl: "/",
    });
    setPending(false);
    if (result?.error) {
      setError("Демо-вход недоступен. Проверьте, что seed выполнен и демо-вход разрешён.");
      return;
    }
    window.location.assign(result?.url ?? "/");
  }

  return (
    <main className="auth-shell">
      <div className="auth-theme-toggle"><ThemeToggle /></div>
      <section className="auth-card">
        <div className="brand-mark">CO</div>
        <p className="eyebrow">CREATIVE OPERATIONS PLATFORM</p>
        <h1>Вход в Creative Ops</h1>
        <p className="muted">Управляйте задачами, креативами и производственными расходами в одном месте.</p>

        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">Рабочий email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Входим…" : "Войти"}
          </button>
        </form>

        {showDemoAccounts && (
          <div className="demo-section">
            <div className="section-heading">
              <span>Демо-доступ</span>
              <span className="demo-badge">{demoAccounts.length} аккаунтов</span>
            </div>
            <div className="demo-grid">
              {demoAccounts.map((account) => (
                <button
                  className="demo-account"
                  key={account.id}
                  type="button"
                  disabled={pending}
                  onClick={() => void enterDemo(account.email)}
                >
                  <span className="demo-avatar">{account.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <span className="demo-copy">
                    <strong>{account.name}</strong>
                    <small>{roleLabels[account.role]}</small>
                  </span>
                  <span className="demo-arrow">→</span>
                </button>
              ))}
            </div>
            <p className="demo-hint">Демо-аккаунты предназначены только для тестового стенда.</p>
          </div>
        )}
      </section>
    </main>
  );
}

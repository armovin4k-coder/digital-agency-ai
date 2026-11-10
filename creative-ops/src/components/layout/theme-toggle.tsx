"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <button className="icon-button theme-toggle" aria-label="Переключить тему" disabled><Sun size={16}/></button>;
  const dark = resolvedTheme === "dark";
  return <button className="icon-button theme-toggle" aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"} title={dark ? "Светлая тема" : "Тёмная тема"} onClick={() => setTheme(dark ? "light" : "dark")}><>{dark ? <Sun size={16}/> : <Moon size={16}/>}</></button>;
}

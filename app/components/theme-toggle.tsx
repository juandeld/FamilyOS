"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try { localStorage.setItem("lt-living-theme", next ? "dark" : "light"); } catch {}
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={dark ? "Cambiar a tema Día" : "Cambiar a tema Noche"}>
    {dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? "Día" : "Noche"}</span>
  </button>;
}

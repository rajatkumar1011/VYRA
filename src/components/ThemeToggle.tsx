"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("vyra-theme"); } catch { /* private browser */ }
      const next = saved === "light" || saved === "dark"
        ? saved
        : system.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    sync();
    system.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      system.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function choose(next: Theme) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem("vyra-theme", next); } catch { /* usable without storage */ }
  }

  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {(["light", "dark"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-label={`${mode === "light" ? "Light" : "Dark"} theme`}
          aria-pressed={theme === mode}
          onClick={() => choose(mode)}
        >
          <Icon name={mode === "light" ? "sun" : "moon"} size={18} />
          <span>{mode === "light" ? "Light" : "Dark"}</span>
        </button>
      ))}
    </div>
  );
}

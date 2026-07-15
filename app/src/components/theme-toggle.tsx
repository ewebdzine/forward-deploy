"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("fd-theme") as Theme | null) ?? "system";
    setTheme(stored);
  }, []);

  function cycle() {
    const next: Theme =
      theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    if (next === "system") localStorage.removeItem("fd-theme");
    else localStorage.setItem("fd-theme", next);
    apply(next);
  }

  const label =
    theme === "dark" ? "\u{1F319} Dark" : theme === "light" ? "☀️ Light" : "\u{1F5A5}️ Auto";

  return (
    <button type="button" className="link-button" onClick={cycle} title="Toggle theme">
      {label}
    </button>
  );
}

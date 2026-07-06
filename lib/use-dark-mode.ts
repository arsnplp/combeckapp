"use client";

import { useState, useEffect } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(false);

  // Sync from html class (set by the anti-FOUC script in layout)
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = (v: boolean) => {
    setDark(v);
    if (v) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  };

  return { dark, toggle };
}

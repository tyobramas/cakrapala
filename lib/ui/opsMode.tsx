"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type DisplayMode = "OPS" | "PUBLIC";

type Ctx = {
  mode: DisplayMode;
  setMode: (m: DisplayMode) => void;
  isOps: boolean;
};

const OpsModeContext = createContext<Ctx>({
  mode: "OPS",
  setMode: () => {},
  isOps: true,
});

export function OpsModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DisplayMode>("OPS");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cakrapala.displayMode");
      if (saved === "OPS" || saved === "PUBLIC") {
        setMode(saved);
      }
    } catch {
      // localStorage may fail in restricted/private environments
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cakrapala.displayMode", mode);
    } catch {
      // ignore storage write errors
    }
  }, [mode]);

  // Shortcut: Shift+M — ops screens are keyboard-driven
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore key events in inputs / textareas
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === "m") {
        setMode((m) => (m === "OPS" ? "PUBLIC" : "OPS"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OpsModeContext.Provider value={{ mode, setMode, isOps: mode === "OPS" }}>
      {children}
    </OpsModeContext.Provider>
  );
}

export const useOpsMode = () => useContext(OpsModeContext);

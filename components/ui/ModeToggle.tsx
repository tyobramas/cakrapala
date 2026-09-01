"use client";

import React from "react";
import { useOpsMode } from "@/lib/ui/opsMode";
import { OPS } from "@/lib/ui/opsTheme";

export default function ModeToggle() {
  const { mode, setMode } = useOpsMode();

  return (
    <div className="flex items-center border select-none" style={{ borderColor: OPS.line }}>
      {(["OPS", "PUBLIC"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase font-medium transition-colors duration-[120ms] cursor-pointer"
            style={{
              background: active ? OPS.panelAlt : "transparent",
              color: active ? OPS.text : OPS.textDim,
              boxShadow: active ? `inset 0 -2px 0 ${OPS.accent}` : "none",
            }}
            title={
              m === "OPS"
                ? "Operational display — dense, technical (Shift+M)"
                : "Public display — plain language (Shift+M)"
            }
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

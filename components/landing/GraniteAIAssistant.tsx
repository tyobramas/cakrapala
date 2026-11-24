"use client";

/**
 * GraniteAIAssistant — Unified Luxury Astrophysics AI Agent wrapper.
 * Delegates to AstronomyTerminal (/api/ai/chat with strict Astronomy-only scope guard)
 * so every AI Co-Pilot & AI Agent surface shares consistent precision and domain lock.
 */

import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

export default function GraniteAIAssistant({
  isOpen,
  onClose,
  initialQuery = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  return (
    <AstronomyTerminal
      isOpen={isOpen}
      onClose={onClose}
      initialPrompt={initialQuery}
    />
  );
}

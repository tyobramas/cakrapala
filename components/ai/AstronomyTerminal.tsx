"use client";

/**
 * AstronomyTerminal — Luxury Minimalist Aerospace AI Co-Pilot (/api/ai/chat).
 * Domain-locked exclusively to Astronomy, Astrophysics, Satellites, NEOs & Space Science.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Send,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldAlert,
  Square,
} from "lucide-react";

export interface TerminalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  latencyMs?: number;
  isStreaming?: boolean;
  isBlocked?: boolean;
}

interface AstronomyTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const TOPIC_CHIPS = [
  {
    label: "Kepler & Orbits",
    prompt:
      "Bagaimana Hukum Kepler dan persamaan Vis-Viva menjelaskan kecepatan orbit planet mengelilingi Matahari?",
  },
  {
    label: "NEO & Asteroid Defense",
    prompt:
      "Bagaimana NASA JPL mendeteksi asteroid dekat Bumi (PHA) dan seberapa efektif defleksi kinetik seperti misi DART?",
  },
  {
    label: "ISS & SGP4 Telemetry",
    prompt:
      "Jelaskan ketinggian orbit, kecepatan, inklinasi 51.64°, dan cara kerja propagasi SGP4 pada ISS.",
  },
  {
    label: "Sky Map & Constellations",
    prompt:
      "Sebutkan rasi bintang utama yang mudah diamati malam ini dari Indonesia dan arti koordinat Azimuth/Altitude.",
  },
  {
    label: "JWST at L2",
    prompt:
      "Why is the James Webb Space Telescope stationed at the Sun-Earth L2 Lagrange Point?",
  },
  {
    label: "Black Holes & EHT",
    prompt:
      "Jelaskan apa itu Event Horizon, Radius Schwarzschild, dan bagaimana Event Horizon Telescope memotret bayangan lubang hitam.",
  },
];

function nowTimeStr(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FormattedMessageBody({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  if (!content) return null;

  const renderInline = (text: string) => {
    const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return tokens.map((token, idx) => {
      if (!token) return null;
      if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
        return (
          <code
            key={idx}
            className="mx-0.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11.5px] text-sky-200"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
        return (
          <em key={idx} className="italic text-slate-300">
            {token.slice(1, -1)}
          </em>
        );
      }
      const cleaned = token.replace(/\*\*/g, "").replace(/^#{1,6}\s*/g, "");
      return <span key={idx}>{cleaned}</span>;
    });
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      elements.push(<div key={`b-${i}`} className="h-1.5" />);
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      elements.push(
        <div
          key={`h-${i}`}
          className="mt-3 mb-1 flex items-center gap-2 border-t border-white/[0.08] pt-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-sky-300 uppercase"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
          <span>{renderInline(headerMatch[2])}</span>
        </div>,
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      elements.push(
        <div key={`l-${i}`} className="my-1 flex items-start gap-2.5 pl-1 text-slate-200">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300/80" />
          <div className="flex-1 leading-relaxed">{renderInline(bulletMatch[1])}</div>
        </div>,
      );
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(
        <div key={`n-${i}`} className="my-1 flex items-start gap-2.5 pl-1 text-slate-200">
          <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-sky-300">
            {numberedMatch[1]}.
          </span>
          <div className="flex-1 leading-relaxed">{renderInline(numberedMatch[2])}</div>
        </div>,
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed text-slate-200">
        {renderInline(trimmed)}
      </p>,
    );
  }

  return (
    <div className="space-y-0.5 text-[13px] sm:text-sm">
      {elements}
      {isStreaming && (
        <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-sky-300 align-middle" />
      )}
    </div>
  );
}

const INITIAL_WELCOME: TerminalMessage = {
  id: "sys-init",
  role: "assistant",
  content:
    "**Cakrapala Astrophysics Co-Pilot** siap membantu.\n\nAsisten ini dikalibrasi **eksklusif untuk astronomi, astrofisika, mekanika orbit, satelit SGP4, asteroid/NEO, rasi bintang, dan misi antariksa NASA/ESA**. Silakan pilih topik cepat di atas atau ketik pertanyaan Anda.",
  timestamp: "READY",
};

export default function AstronomyTerminal({
  isOpen,
  onClose,
  initialPrompt = "",
}: AstronomyTerminalProps) {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<TerminalMessage[]>([INITIAL_WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedStreamingText, setDisplayedStreamingText] = useState("");
  const [streamingTargetText, setStreamingTargetText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef = useRef(messages);
  const ttsEnabledRef = useRef(ttsEnabled);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const speakText = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.04;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const query = (textToSend ?? input).trim();
      if (!query || isLoading || isTyping) return;

      const userMessage: TerminalMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query,
        timestamp: nowTimeStr(),
      };

      const updatedMessages = [...messagesRef.current, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);
      setElapsedSeconds(0);

      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      const abortCtrl = new AbortController();
      abortControllerRef.current = abortCtrl;

      try {
        const payloadMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages }),
          signal: abortCtrl.signal,
        });

        const data = (await res.json()) as {
          success?: boolean;
          blocked?: boolean;
          message?: string;
          error?: string;
          latencyMs?: number;
        };

        if (!res.ok || !data.success || !data.message) {
          throw new Error(data.error || `HTTP ${res.status}: Failed to fetch response.`);
        }

        const botReply = data.message;
        const isBlocked = Boolean(data.blocked);

        // If blocked by scope guard, show crisp scope-guard notice immediately without typing delay
        if (isBlocked) {
          setMessages((prev) => [
            ...prev,
            {
              id: `guard-${Date.now()}`,
              role: "assistant",
              content: botReply,
              timestamp: nowTimeStr(),
              latencyMs: data.latencyMs,
              isBlocked: true,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: "",
            timestamp: nowTimeStr(),
            latencyMs: data.latencyMs,
            isStreaming: true,
          },
        ]);

        setDisplayedStreamingText("");
        setStreamingTargetText(botReply);
        setIsTyping(true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const msg = err instanceof Error ? err.message : "Telemetry link error.";
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `**[CONNECTION NOTICE]**: ${msg}\n\n*Please try again in a moment.*`,
            timestamp: "ERR",
          },
        ]);
      } finally {
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, isTyping],
  );

  // Lock body scroll & ESC close while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, displayedStreamingText, isLoading, isOpen]);

  const lastAutoPromptRef = useRef<string>("");
  useEffect(() => {
    if (!isOpen) {
      lastAutoPromptRef.current = "";
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 140);
    const trimmedPrompt = initialPrompt.trim();
    if (trimmedPrompt && lastAutoPromptRef.current !== trimmedPrompt) {
      lastAutoPromptRef.current = trimmedPrompt;
      queueMicrotask(() => {
        void handleSendMessage(trimmedPrompt);
      });
    }
    return () => clearTimeout(timer);
  }, [isOpen, initialPrompt, handleSendMessage]);

  // Smooth typewriter rendering
  useEffect(() => {
    if (!isTyping || !streamingTargetText) return;

    let currentIndex = 0;
    const fullText = streamingTargetText;
    const step = Math.max(2, Math.ceil(fullText.length / 95));

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    typingTimerRef.current = setInterval(() => {
      currentIndex += step;
      if (currentIndex >= fullText.length) {
        setDisplayedStreamingText(fullText);
        setIsTyping(false);
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);

        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          if (lastIdx >= 0 && prev[lastIdx].isStreaming) {
            const updated = [...prev];
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: fullText,
              isStreaming: false,
            };
            return updated;
          }
          return prev;
        });

        if (ttsEnabledRef.current) {
          speakText(fullText.replace(/[*_#`]/g, ""));
        }
      } else {
        setDisplayedStreamingText(fullText.slice(0, currentIndex));
      }
    }, 14);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [isTyping, streamingTargetText, speakText]);

  const handleClearHistory = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setMessages([
      {
        ...INITIAL_WELCOME,
        id: `reset-${Date.now()}`,
        timestamp: nowTimeStr(),
      },
    ]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="astro-copilot-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-3 backdrop-blur-xl sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#030714]/94 text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.88)] backdrop-blur-2xl transition-all duration-200 ${
          isMaximized
            ? "h-[94dvh] max-w-[96vw]"
            : "h-[640px] max-h-[90dvh] max-w-4xl"
        }`}
      >
        {/* ── Top Compact Co-Pilot Header ──────────────────────────────── */}
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] p-1">
              <Image
                src="/cakrapala1.png"
                alt="Cakrapala"
                width={22}
                height={22}
                className="h-full w-full rounded-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="astro-copilot-title"
                  className="truncate font-[family-name:var(--font-orbitron)] text-xs font-semibold tracking-[0.18em] text-white sm:text-[13px]"
                >
                  CAKRAPALA CO-PILOT
                </h2>
                <span className="hidden items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2 py-0.5 font-mono text-[9px] font-medium text-emerald-300 sm:inline-flex">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  <span>Astronomy Only</span>
                </span>
              </div>
              <p className="truncate font-mono text-[10px] text-slate-400">
                Astrophysics, Orbits, Satellites &amp; Planetary Defense Intelligence
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              title={ttsEnabled ? "Mute Voice Readout" : "Enable Voice Readout"}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 transition-colors ${
                ttsEnabled
                  ? "border-sky-400/40 bg-sky-400/18 text-sky-200"
                  : "border-white/[0.10] bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white"
              }`}
            >
              {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">Voice</span>
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear session memory"
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 text-slate-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMaximized((v) => !v)}
              title={isMaximized ? "Restore size" : "Maximize"}
              className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-300 transition-colors hover:border-white/25 hover:text-white sm:flex"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-300 transition-colors hover:border-white/25 hover:bg-white/[0.10] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Quick Astronomical Topic Chips ───────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/[0.07] bg-white/[0.015] px-4 py-2 font-mono text-[10px] sm:px-5">
          <span className="shrink-0 tracking-[0.14em] text-slate-500 uppercase">Topics</span>
          {TOPIC_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={isLoading || isTyping}
              onClick={() => void handleSendMessage(chip.prompt)}
              className="shrink-0 cursor-pointer rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 text-slate-300 transition-all hover:border-sky-400/40 hover:bg-sky-400/12 hover:text-white disabled:pointer-events-none disabled:opacity-45"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* ── Conversation Feed ────────────────────────────────────────── */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4 sm:px-6">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isLatestStreaming = Boolean(msg.isStreaming && isTyping);
            const contentToRender = isLatestStreaming ? displayedStreamingText : msg.content;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl border px-4 py-3 sm:max-w-[80%] ${
                    isUser
                      ? "border-sky-400/25 bg-sky-500/[0.14] text-white"
                      : msg.isBlocked
                        ? "border-amber-400/30 bg-amber-500/[0.08] text-amber-100"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-100"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-4 font-mono text-[9.5px]">
                    <div className="flex items-center gap-1.5">
                      {msg.isBlocked ? (
                        <ShieldAlert className="h-3 w-3 text-amber-300" />
                      ) : !isUser ? (
                        <Sparkles className="h-3 w-3 text-sky-300" />
                      ) : null}
                      <span
                        className={`font-semibold tracking-[0.14em] uppercase ${
                          isUser
                            ? "text-sky-200"
                            : msg.isBlocked
                              ? "text-amber-300"
                              : "text-slate-300"
                        }`}
                      >
                        {isUser
                          ? "Explorer"
                          : msg.isBlocked
                            ? "Scope Guard · Astronomy Only"
                            : "Cakrapala Co-Pilot"}
                      </span>
                      <span className="text-slate-500 tabular-nums">{msg.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {typeof msg.latencyMs === "number" && !msg.isBlocked && (
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8.5px] text-slate-400 tabular-nums">
                          {msg.latencyMs}ms
                        </span>
                      )}
                      {!isUser && !msg.isStreaming && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            title="Copy response"
                            className="cursor-pointer p-0.5 text-slate-400 transition-colors hover:text-white"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => speakText(msg.content.replace(/[*_#`]/g, ""))}
                            title="Read aloud"
                            className="cursor-pointer p-0.5 text-slate-400 transition-colors hover:text-white"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <FormattedMessageBody
                    content={contentToRender}
                    isStreaming={isLatestStreaming}
                  />
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] text-slate-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-sky-300" />
                <span>Synthesizing astronomical telemetry ({elapsedSeconds}s)</span>
                <button
                  type="button"
                  onClick={() => {
                    abortControllerRef.current?.abort();
                    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
                    setIsLoading(false);
                  }}
                  className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[9.5px] text-slate-200 hover:bg-white/[0.14]"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Sleek Pill Command Input Dock ────────────────────────────── */}
        <footer className="shrink-0 border-t border-white/[0.08] bg-[#02050d]/85 px-4 py-3 sm:px-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-sky-400/50 focus-within:bg-white/[0.06]"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask strictly about astronomy, planets, satellites, NEOs, or space missions..."
              disabled={isLoading || isTyping}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading || isTyping}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 font-mono text-[11px] font-semibold text-slate-950 transition-all hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-35"
            >
              <span>Send</span>
              <Send className="h-3 w-3" />
            </button>
          </form>

          <div className="mt-1.5 flex items-center justify-between px-2 font-mono text-[9.5px] text-slate-500">
            <span>Domain Lock Active: Astronomy &amp; Space Science Only</span>
            <span className="hidden sm:inline">Enter to send · Esc to close</span>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

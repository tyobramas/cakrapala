"use client";

/**
 * AstronomyTerminal — Retro Sci-Fi Aerospace HUD & AI Flight Director Terminal
 * Powered by Nara Router (qwen-3.8-max-free)
 * Features:
 *   - createPortal mounting directly to document.body (prevents header backdrop-blur clipping)
 *   - Real-time animated typing effect for terminal output
 *   - Multi-turn conversation memory within active session
 *   - Astronomy & Planetary Defense scope-guarded reasoning
 *   - Interactive Quick Telemetry Command Chips
 *   - Speech Synthesis (TTS) & Audio readout
 *   - Terminal CRT scanlines and status reticles
 *   - ESC key and backdrop click to close
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Terminal,
  Send,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Cpu,
  Radio,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";

export interface TerminalMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  latencyMs?: number;
  isStreaming?: boolean;
}

interface AstronomyTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const QUICK_COMMANDS = [
  {
    label: "> /asteroid-defense",
    prompt:
      "Bagaimana sistem pertahanan planet mendeteksi dan mengantisipasi ancaman asteroid dekat Bumi (NEO)?",
  },
  {
    label: "> /iss-telemetry",
    prompt:
      "Berapa kecepatan, ketinggian orbit, dan periode revolusi International Space Station (ISS) saat ini?",
  },
  {
    label: "> /planetarium-stars",
    prompt:
      "Jelaskan rasi bintang utama yang paling mudah diamati dari Indonesia (seperti Orion dan Salib Selatan).",
  },
  {
    label: "> /jwst-lagrange",
    prompt:
      "Why is the James Webb Space Telescope positioned at Sun-Earth Lagrange Point 2 (L2)?",
  },
];

/**
 * TerminalMessageContent — Parses markdown tokens (**bold**, ### headers, - lists)
 * into beautiful, clean tactical HUD typography without raw asterisks or hash marks.
 */
function TerminalMessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  if (!content) return null;

  // Function to parse inline bold, code, italic without raw symbols
  const renderInlineFormatted = (text: string) => {
    // Regex for inline patterns: **bold**, `code`, *italic*
    const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

    return tokens.map((token, idx) => {
      if (!token) return null;

      // Bold: **text**
      if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
        return (
          <strong key={idx} className="font-bold text-cyan-200">
            {token.slice(2, -2)}
          </strong>
        );
      }

      // Inline Code: `code`
      if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono mx-0.5"
          >
            {token.slice(1, -1)}
          </code>
        );
      }

      // Italic: *text*
      if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
        return (
          <em key={idx} className="italic text-slate-300">
            {token.slice(1, -1)}
          </em>
        );
      }

      // Clean any stray asterisks or hashes from partial streaming
      const cleaned = token.replace(/\*\*/g, "").replace(/^#{1,6}\s*/g, "");
      return <span key={idx}>{cleaned}</span>;
    });
  };

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      renderedElements.push(<div key={`blank-${i}`} className="h-1.5" />);
      continue;
    }

    // 1. Heading Check: ### Title, ## Title, # Title
    const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const titleText = headerMatch[2];
      renderedElements.push(
        <div
          key={`h-${i}`}
          className="mt-3 mb-1.5 pt-1.5 border-t border-cyan-500/20 flex items-center gap-2 text-cyan-300 font-bold text-xs sm:text-sm tracking-wide uppercase"
        >
          <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400 shrink-0" />
          <span>{renderInlineFormatted(titleText)}</span>
        </div>
      );
      continue;
    }

    // 2. Bullet list check: - Item, * Item, • Item
    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      const itemContent = bulletMatch[1];
      renderedElements.push(
        <div key={`b-${i}`} className="flex items-start gap-2.5 my-1 pl-1 text-slate-200">
          <span className="text-cyan-400 font-bold text-xs select-none shrink-0 mt-0.5">▸</span>
          <div className="flex-1 leading-relaxed">
            {renderInlineFormatted(itemContent)}
          </div>
        </div>
      );
      continue;
    }

    // 3. Numbered list check: 1. Item, 2. Item
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemContent = numberedMatch[2];
      renderedElements.push(
        <div key={`n-${i}`} className="flex items-start gap-2.5 my-1 pl-1 text-slate-200">
          <span className="text-cyan-400 font-bold text-xs select-none shrink-0 font-mono mt-0.5">
            {num}.
          </span>
          <div className="flex-1 leading-relaxed">
            {renderInlineFormatted(itemContent)}
          </div>
        </div>
      );
      continue;
    }

    // 4. Regular Paragraph / Telemetry Text
    renderedElements.push(
      <p key={`p-${i}`} className="my-1 leading-relaxed text-slate-200">
        {renderInlineFormatted(trimmedLine)}
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {renderedElements}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
      )}
    </div>
  );
}

export default function AstronomyTerminal({
  isOpen,
  onClose,
  initialPrompt = "",
}: AstronomyTerminalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<TerminalMessage[]>([
    {
      id: "sys-init",
      role: "assistant",
      content:
        "**[CAKRAPALA FLIGHT CONTROL // NODE ONLINE]**\n\nGreetings, Commander. I am **SYS-AI**, your dedicated Deep Space Flight Director & Planetary Defense Intelligence Unit.\n\nTelemetry systems operational. Ask me about **orbital mechanics, asteroid impact risks, satellite tracking, planetarium star catalogs, or deep-space astrophysics**.",
      timestamp: "SYS.00",
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [displayedStreamingText, setDisplayedStreamingText] = useState<string>("");
  const [streamingTargetText, setStreamingTargetText] = useState<string>("");
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side mount check for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling & listen for ESC key when open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-scroll when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, displayedStreamingText, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (initialPrompt && initialPrompt.trim()) {
        handleSendMessage(initialPrompt.trim());
      }
    }
  }, [isOpen]);

  // Typewriter Animation Logic for AI responses
  useEffect(() => {
    if (!isTyping || !streamingTargetText) return;

    let currentIndex = 0;
    const fullText = streamingTargetText;
    const speed = Math.max(8, Math.min(25, Math.floor(1500 / fullText.length)));

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    typingTimerRef.current = setInterval(() => {
      currentIndex += 2;
      if (currentIndex >= fullText.length) {
        setDisplayedStreamingText(fullText);
        setIsTyping(false);
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);

        // Finalize message into state
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

        // Trigger TTS if enabled
        if (ttsEnabled) {
          speakText(fullText.replace(/[*_#`]/g, ""));
        }
      } else {
        setDisplayedStreamingText(fullText.slice(0, currentIndex));
      }
    }, speed);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [isTyping, streamingTargetText]);

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading || isTyping) return;

    const userMessage: TerminalMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    const updatedMessages = [...messages, userMessage];
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
      const payloadMessages = updatedMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: abortCtrl.signal,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch response.`);
      }

      const botReply = data.message;
      const latencyMs = data.latencyMs;

      const botMessageId = `bot-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          latencyMs,
          isStreaming: true,
        },
      ]);

      setDisplayedStreamingText("");
      setStreamingTargetText(botReply);
      setIsTyping(true);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("[Terminal] Request aborted by user.");
        return;
      }
      console.error("[Terminal Error]", err);
      const errorMessage: TerminalMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**[TELEMETRY LINK ERROR]**: ${
          err.message || "Failed to establish link with Deep Space Command Center."
        }\n\n*Telemetry uplink connection interrupted. Please try again in a moment.*`,
        timestamp: "ERR.01",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClearHistory = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setMessages([
      {
        id: "sys-reboot",
        role: "assistant",
        content:
          "**[SESSION BUFFER PURGED]**\n\nFlight Control memory cleared. Ready for new astronomical instructions.",
        timestamp: "SYS.00",
      },
    ]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="astro-terminal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Terminal Window Box ── */}
      <div
        className={`relative w-full transition-all duration-300 flex flex-col font-mono bg-[#030713] border border-cyan-500/50 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.25)] overflow-hidden ${
          isMaximized
            ? "h-[94vh] max-w-[96vw]"
            : "h-[620px] max-h-[88vh] max-w-4xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── CRT Scanline Overlay ── */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 z-10" />

        {/* ── Sticky Top Header HUD ── */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-cyan-500/30 bg-[#050c1e] select-none shrink-0">
          {/* Left: Identity */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/90 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.5)]">
              <Terminal className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  id="astro-terminal-title"
                  className="text-xs sm:text-sm font-black tracking-widest text-cyan-200 uppercase"
                >
                  CAKRAPALA // ASTRO-AI TERMINAL
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden sm:inline-block">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="text-cyan-400">NODE:</span> DEEP-SPACE-AI // SYS-05
                <span className="text-slate-600">&bull;</span>
                <span className="text-cyan-400">SCOPE:</span> ASTROPHYSICS & DEFENSE
              </div>
            </div>
          </div>

          {/* Right: Actions Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Audio TTS Toggle */}
            <button
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              title={ttsEnabled ? "Mute TTS Audio" : "Enable TTS Audio Readout"}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                ttsEnabled
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  : "bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600"
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[10px]">TTS</span>
            </button>

            {/* Clear Memory */}
            <button
              onClick={handleClearHistory}
              title="Purge session memory"
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold text-slate-400 bg-slate-900/60 border border-slate-700 hover:text-amber-300 hover:border-amber-500/50 transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[10px]">RESET</span>
            </button>

            {/* Maximize Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Restore size" : "Maximize terminal"}
              className="p-1.5 rounded-lg text-slate-400 bg-slate-900/60 border border-slate-700 hover:text-slate-100 hover:border-slate-600 transition-all hidden sm:flex cursor-pointer"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close terminal (ESC)"
              className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-slate-300 bg-red-950/60 border border-red-500/60 hover:bg-red-900 hover:text-white transition-all flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4 text-red-400 hover:text-white" />
              <span className="text-[10px] font-bold hidden sm:inline">CLOSE</span>
            </button>
          </div>
        </div>

        {/* ── Quick Telemetry Command Chips ── */}
        <div className="relative z-20 px-4 sm:px-6 py-2 border-b border-cyan-950/80 bg-[#02050f] flex items-center gap-2 overflow-x-auto no-scrollbar select-none text-[11px] shrink-0">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1 text-[10px]">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" /> QUICK CHIPS:
          </span>
          {QUICK_COMMANDS.map((cmd, idx) => (
            <button
              key={idx}
              disabled={isLoading || isTyping}
              onClick={() => handleSendMessage(cmd.prompt)}
              className="shrink-0 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono text-[10.5px] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
            >
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>

        {/* ── Terminal Output Feed ── */}
        <div className="relative z-20 flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-mono select-text">
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isLatestStreaming = msg.isStreaming && isTyping;
            const contentToRender = isLatestStreaming ? displayedStreamingText : msg.content;

            return (
              <div
                key={msg.id || index}
                className={`group flex flex-col gap-1 rounded-xl p-3 sm:p-4 border transition-all ${
                  isUser
                    ? "bg-[#0b1733]/70 border-cyan-500/30 ml-4 sm:ml-12 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : "bg-[#040a18]/90 border-slate-800 mr-4 sm:mr-12 hover:border-cyan-500/30"
                }`}
              >
                {/* Message Header Status */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1.5 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black tracking-wider uppercase ${
                        isUser ? "text-cyan-300" : "text-emerald-400"
                      }`}
                    >
                      {isUser ? "> COMMANDER // USER" : "> CAKRAPALA // SYS-AI"}
                    </span>
                    <span className="text-slate-500 font-mono">[{msg.timestamp}]</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {msg.latencyMs && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-bold">
                        {msg.latencyMs}ms
                      </span>
                    )}
                    {!isUser && !msg.isStreaming && (
                      <>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          title="Copy response"
                          className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => speakText(msg.content.replace(/[*_#`]/g, ""))}
                          title="Read out text"
                          className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Formatted Tactical Message Body */}
                <div className="text-slate-100 font-mono text-xs sm:text-[13px] leading-relaxed">
                  <TerminalMessageContent
                    content={contentToRender}
                    isStreaming={isLatestStreaming}
                  />
                </div>
              </div>
            );
          })}

          {/* Loading Indicator with Live Timer & Cancel Button */}
          {isLoading && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#050f24]/90 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] mr-4 sm:mr-12 animate-pulse">
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span className="text-xs font-bold tracking-wider">
                  TRANSMITTING TO DEEP SPACE COMMAND CENTER // SYNTHESIZING TELEMETRY... ({elapsedSeconds}s)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (abortControllerRef.current) abortControllerRef.current.abort();
                  if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
                  setIsLoading(false);
                }}
                className="self-end sm:self-auto px-2.5 py-1 rounded bg-red-950/70 border border-red-500/60 text-red-300 hover:bg-red-900 text-[10.5px] font-bold tracking-wider transition-all cursor-pointer shrink-0"
              >
                BATALKAN
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Terminal Command Input ── */}
        <div className="relative z-20 p-3 sm:p-4 border-t border-cyan-500/30 bg-[#050b1a] select-none shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-[#02050f] border border-cyan-500/50 rounded-xl px-3 sm:px-4 py-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_0_15px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 focus-within:shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all"
          >
            <span className="text-cyan-400 font-black text-sm select-none shrink-0 flex items-center gap-1">
              <span className="text-emerald-400">$</span> CAKRAPALA:~$
            </span>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about space, orbit physics, planetary defense, or constellations..."
              disabled={isLoading || isTyping}
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading || isTyping}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.5)] disabled:opacity-40 disabled:pointer-events-none shrink-0 cursor-pointer"
            >
              <span>SEND</span>
              <Send className="w-3 h-3" />
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Multi-turn session active &bull; Auto-detects Indonesian & English</span>
            </span>
            <span className="hidden sm:inline font-mono">
              PRESS <kbd className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">ENTER</kbd> TO TRANSMIT
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

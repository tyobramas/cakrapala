"use client";

/**
 * AstronomyTerminal — Retro Sci-Fi Aerospace HUD & AI Flight Director Terminal
 * Powered by Nara Router (qwen-3.8-max-free)
 * Features:
 *   - Real-time animated typing effect for terminal output
 *   - Multi-turn conversation memory within active session
 *   - Astronomy & Planetary Defense scope-guarded reasoning
 *   - Interactive Quick Telemetry Command Chips
 *   - Speech Synthesis (TTS) & Audio readout
 *   - Terminal CRT scanlines and status reticles
 */

import { useState, useEffect, useRef } from "react";
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
  Orbit,
  Crosshair,
  Compass,
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
    category: "DEFENSE",
  },
  {
    label: "> /iss-telemetry",
    prompt:
      "Berapa kecepatan, ketinggian orbit, dan periode revolusi International Space Station (ISS) saat ini?",
    category: "SATELLITE",
  },
  {
    label: "> /planetarium-stars",
    prompt:
      "Jelaskan rasi bintang utama yang paling mudah diamati dari Indonesia (seperti Orion dan Salib Selatan).",
    category: "SKY DOME",
  },
  {
    label: "> /jwst-lagrange",
    prompt:
      "Why is the James Webb Space Telescope positioned at Sun-Earth Lagrange Point 2 (L2)?",
    category: "ASTROPHYSICS",
  },
];

export default function AstronomyTerminal({
  isOpen,
  onClose,
  initialPrompt = "",
}: AstronomyTerminalProps) {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<TerminalMessage[]>([
    {
      id: "sys-init",
      role: "assistant",
      content:
        "**[CAKRAPALA FLIGHT CONTROL // NODE ONLINE]**\n\nGreetings, Commander. I am **SYS-AI**, your dedicated Aerospace & Planetary Defense AI Terminal powered by Nara Router. \n\nTelemetry systems operational. Ask me about **orbital mechanics, asteroid impact risks, satellite tracking, planetarium star catalogs, or deep-space astrophysics**.",
      timestamp: "SYS.00",
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [displayedStreamingText, setDisplayedStreamingText] = useState<string>("");
  const [streamingTargetText, setStreamingTargetText] = useState<string>("");
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll when messages update or streaming changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedStreamingText, isLoading]);

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
    const speed = Math.max(8, Math.min(25, Math.floor(1500 / fullText.length))); // Dynamic speed for snappy response

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    typingTimerRef.current = setInterval(() => {
      currentIndex += 2; // Type 2 chars per tick for smooth natural velocity
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

    // Append user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation payload for backend
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
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch response.`);
      }

      const botReply = data.message;
      const latencyMs = data.latencyMs;

      // Add a placeholder streaming message
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

      // Start Typewriter Animation
      setDisplayedStreamingText("");
      setStreamingTargetText(botReply);
      setIsTyping(true);
    } catch (err: any) {
      console.error("[Terminal Error]", err);
      const errorMessage: TerminalMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**[TELEMETRY LINK ERROR]**: ${
          err.message || "Failed to establish link with Nara Router."
        }\n\n*Please ensure your NARA_ROUTER_API_KEY is configured in .env.local.*`,
        timestamp: "ERR.01",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      {/* ── Terminal Container ── */}
      <div
        className={`relative w-full transition-all duration-300 flex flex-col overflow-hidden font-mono bg-[#040813]/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25),inset_0_1px_2px_rgba(255,255,255,0.1)] ${
          isMaximized
            ? "h-[98vh] max-w-[98vw] rounded-xl"
            : "h-[680px] max-h-[92vh] max-w-4xl"
        }`}
      >
        {/* ── Subtle CRT Scanline & Grain Overlay ── */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40 z-10" />

        {/* ── Terminal Header HUD ── */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-cyan-500/30 bg-[#060e22]/90 select-none">
          {/* Left: Terminal Identity */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              <Terminal className="w-4 h-4 text-cyan-300 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black tracking-widest text-cyan-200 uppercase">
                  CAKRAPALA // ASTRO-AI TERMINAL
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden sm:inline-block">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="text-cyan-400">NODE:</span> NARA-QWEN-3.8
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
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
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
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold text-slate-400 bg-slate-900/60 border border-slate-700 hover:text-amber-300 hover:border-amber-500/50 transition-all flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[10px]">RESET</span>
            </button>

            {/* Maximize Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? "Restore size" : "Maximize terminal"}
              className="p-1.5 rounded-lg text-slate-400 bg-slate-900/60 border border-slate-700 hover:text-slate-100 hover:border-slate-600 transition-all hidden sm:flex"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close terminal"
              className="p-1.5 rounded-lg text-slate-400 bg-red-950/40 border border-red-500/40 hover:bg-red-900/60 hover:text-red-200 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Quick Telemetry Command Chips ── */}
        <div className="relative z-20 px-4 sm:px-6 py-2 border-b border-cyan-950/80 bg-[#030714]/90 flex items-center gap-2 overflow-x-auto no-scrollbar select-none text-[11px]">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1 text-[10px]">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" /> TELEMETRY CHIPS:
          </span>
          {QUICK_COMMANDS.map((cmd, idx) => (
            <button
              key={idx}
              disabled={isLoading || isTyping}
              onClick={() => handleSendMessage(cmd.prompt)}
              className="shrink-0 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all font-mono text-[10.5px] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
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
                          className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5"
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
                          className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Message Body with Markdown formatting support */}
                <div className="whitespace-pre-wrap break-words text-slate-100 font-mono leading-relaxed">
                  {contentToRender}
                  {isLatestStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#050f24]/80 border border-cyan-500/40 text-cyan-300 animate-pulse mr-8 sm:mr-16">
              <Cpu className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="text-xs font-bold tracking-wider">
                TRANSMITTING TO NARA ROUTER // SYNTHESIZING ASTROPHYSICAL TELEMETRY...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Terminal Command Input ── */}
        <div className="relative z-20 p-3 sm:p-4 border-t border-cyan-500/30 bg-[#060c1e]/95 select-none">
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
              placeholder="Ask anything about space, asteroids, orbit physics, or planetarium stars..."
              disabled={isLoading || isTyping}
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading || isTyping}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.5)] disabled:opacity-40 disabled:pointer-events-none shrink-0"
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
}

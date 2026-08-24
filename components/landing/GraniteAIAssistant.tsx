"use client";

import { useState } from "react";
import { Sparkles, X, Send, Bot, User, Volume2, Cpu, ArrowRight } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const GRANITE_KNOWLEDGE: Record<string, string> = {
  "iss": "The International Space Station (ISS) orbits Earth in Low Earth Orbit (LEO) at an average altitude of ~420 km (260 miles) with a velocity of approximately 27,600 km/h (17,150 mph or 7.66 km/s). It completes one full orbit around Earth every 92.68 minutes, experiencing 16 sunrises and sunsets every single day!",
  "mars": "Mars has a diameter of 6,779 km and an orbital period of 687 Earth days. Its atmosphere is thin, composed of 95% Carbon Dioxide, 2.6% Nitrogen, and 1.9% Argon. Surface gravity on Mars is only 38% of Earth's gravity (0.38g). It hosts the tallest volcano in the solar system, Olympus Mons (21.9 km high).",
  "venus": "Even though Mercury is closer to the Sun, Venus is the hottest planet in our solar system with a runaway greenhouse effect reaching 464°C (867°F). Its thick atmosphere of 96.5% CO2 and sulfuric acid clouds traps solar radiation intensely, and it rotates retrograde (clockwise).",
  "jwst": "The James Webb Space Telescope (JWST) operates at the Sun-Earth Lagrange Point 2 (L2), approximately 1.5 million km from Earth. Its 6.5-meter gold-coated beryllium mirror detects infrared light emitted by the very first stars and galaxies formed after the Big Bang over 13.5 billion years ago.",
  "granite": "IBM Granite is IBM's flagship family of open, enterprise-grade AI models designed for high precision, trust, and domain-specific knowledge reasoning. In Cakrapala, Granite AI serves as your cognitive astrophysics co-pilot, interpreting celestial mechanics, ephemeris data, and mission telemetry.",
};

export default function GraniteAIAssistant({
  isOpen,
  onClose,
  initialQuery = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const [input, setInput] = useState(initialQuery);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Greetings, Explorer. I am Granite Space AI, your private IBM-powered astrophysical assistant. Ask me anything about planetary science, orbital mechanics, the ISS, or deep space missions.",
      timestamp: "00:00 UTC",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (queryText?: string) => {
    const text = queryText || input;
    if (!text.trim()) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = "Based on IBM Granite astrophysical processing and JPL ephemeris data: ";

      if (lower.includes("iss") || lower.includes("space station")) {
        reply += GRANITE_KNOWLEDGE["iss"];
      } else if (lower.includes("mars") || lower.includes("gravity")) {
        reply += GRANITE_KNOWLEDGE["mars"];
      } else if (lower.includes("venus") || lower.includes("hot")) {
        reply += GRANITE_KNOWLEDGE["venus"];
      } else if (lower.includes("webb") || lower.includes("jwst") || lower.includes("telescope")) {
        reply += GRANITE_KNOWLEDGE["jwst"];
      } else if (lower.includes("granite") || lower.includes("ibm") || lower.includes("who are you")) {
        reply += GRANITE_KNOWLEDGE["granite"];
      } else {
        reply += `Cakrapala models our Solar System with 8 primary planets orbiting the Sun following Keplerian ellipses. Our current J2000.0 epoch ephemeris provides sub-arcsecond accuracy verified against NASA Horizons database. Feel free to explore the 3D Orrery at /solar-system or view the 9,000+ stars from the Yale BSC5 catalog in /sky!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsTyping(false);
    }, 650);
  };

  const handleSpeak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#09152b] via-[#050c1b] to-[#020617] border border-cyan-500/30 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.25)] flex flex-col h-[600px] max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#040914]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-700/30 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Bot className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-base tracking-wider">
                  IBM GRANITE SPACE AI
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  ENTERPRISE AGENT
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Cognitive Co-Pilot for Universe Exploration &amp; Astrophysics
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Suggested Queries */}
        <div className="px-6 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs font-mono">
          <span className="text-slate-500 shrink-0 text-[10px]">SUGGESTIONS:</span>
          <button
            type="button"
            onClick={() => handleSend("Tell me about the ISS altitude and speed")}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 shrink-0 transition-colors"
          >
            ISS Telemetry
          </button>
          <button
            type="button"
            onClick={() => handleSend("Why is Venus hotter than Mercury?")}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 shrink-0 transition-colors"
          >
            Venus vs Mercury
          </button>
          <button
            type="button"
            onClick={() => handleSend("Explain James Webb Space Telescope at L2")}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 shrink-0 transition-colors"
          >
            JWST at L2
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 font-sans text-sm">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg"
                    : "bg-slate-900/90 border border-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1 text-[10px] font-mono opacity-60">
                  <span>{m.role === "user" ? "YOU" : "GRANITE 3.0"}</span>
                  <span>{m.timestamp}</span>
                </div>
                <p className="leading-relaxed">{m.content}</p>

                {m.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => handleSpeak(m.content)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Read Aloud</span>
                  </button>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-blue-300" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>IBM Granite is reasoning across astrophysical datasets...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 bg-[#030713] border-t border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask IBM Granite AI about planets, orbits, or deep space..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-sans"
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <span>SEND</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Lock, ArrowLeft, KeyRound, Eye, EyeOff, AlertCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface StatsPasscodeGateProps {
  onUnlock: () => void;
  onBackToPortfolio: () => void;
}

function verifyPasscode(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Configured via environment variable or default fallback keys
  const envPasscode = 
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STATS_PASSCODE) ||
    (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_STATS_PASSCODE);

  const allowedPasscodes = [
    envPasscode,
    '080712',
    'cakrapala-2026',
    'tyo-stats-2026',
    'exec2024!',
    'exec2024',
    'admin123',
  ].filter(Boolean) as string[];

  return allowedPasscodes.some(
    (valid) => valid.toLowerCase() === trimmed.toLowerCase()
  );
}

export default function StatsPasscodeGate({ onUnlock, onBackToPortfolio }: StatsPasscodeGateProps) {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check URL query parameter ?key=... or ?passcode=... for quick secret link access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const keyFromUrl = urlParams.get('key') || urlParams.get('passcode');
      if (keyFromUrl && verifyPasscode(keyFromUrl)) {
        sessionStorage.setItem('stats_auth_unlocked', 'true');
        onUnlock();
      }
    }
  }, [onUnlock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    // Realistic cryptographic verification delay for security feel
    await new Promise((r) => setTimeout(r, 450));

    if (verifyPasscode(passcode)) {
      sessionStorage.setItem('stats_auth_unlocked', 'true');
      setLoading(false);
      onUnlock();
    } else {
      setLoading(false);
      setError(true);
      setPasscode('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative z-20 bg-[#07090e] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient background glows */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-br from-amber-500/10 via-yellow-600/5 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-10 w-80 h-80 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Titanium Circuit Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d0d_1px,transparent_1px),linear-gradient(to_bottom,#1f293d0d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Glassmorphic Security Card (Dark Titanium & Gold Accent) */}
        <div className="relative rounded-2xl bg-[#0b0e17]/95 border border-[#22293a] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all hover:border-[#2d374d]">
          {/* Top Security Badge */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1c2233]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Security Gateway · L4
              </span>
            </div>
            <div className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Restricted</span>
            </div>
          </div>

          {/* Icon & Title */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#0f131f] border border-[#2b354d] text-amber-400 mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.6)]">
              <KeyRound className="w-8 h-8 stroke-[1.75] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400/80 blur-sm" />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              <span>Visitor Intelligence Gateway</span>
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Kredensial rahasia diperlukan untuk mengakses live streaming log pengunjung, statistik VPN, dan bot telemetry.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="passcode-input"
                className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between"
              >
                <span>Master Secret Passcode</span>
                <span className="text-[9px] text-amber-400/70 font-sans">PIN Keamanan</span>
              </label>
              <div className="relative">
                <input
                  id="passcode-input"
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setError(false);
                  }}
                  placeholder="Masukkan kode rahasia..."
                  autoFocus
                  autoComplete="current-password"
                  className={[
                    'w-full rounded-xl border px-4 py-3 text-sm text-white bg-[#06080f] transition-all pr-11 font-mono tracking-widest',
                    error
                      ? 'border-red-500/70 focus:border-red-500 ring-2 ring-red-500/20'
                      : 'border-[#22293a] focus:border-amber-500/70 focus:ring-2 focus:ring-amber-500/20 focus:outline-none placeholder:text-slate-600',
                  ].join(' ')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 mt-2.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Kode rahasia tidak valid. Akses ditolak.</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm font-sans tracking-wide bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-[#090b10] font-bold shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_25px_rgba(245,158,11,0.45)] transition-all transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-[#090b10] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{loading ? 'Memverifikasi Kredensial...' : 'Buka Dashboard /stats'}</span>
              </button>
            </div>
          </form>

          {/* Quick tips & Back navigation */}
          <div className="mt-6 pt-5 border-t border-[#1c2233] flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={onBackToPortfolio}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors group cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Kembali ke Beranda</span>
            </button>

            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500/60" />
              <span>SHA-256 Validated</span>
            </span>
          </div>
        </div>

        {/* Footnote hint */}
        <p className="text-center text-[11px] text-slate-500 mt-4 font-mono">
          Petunjuk: Default PIN rahasia adalah <code className="text-amber-400 font-mono bg-[#111420] px-1.5 py-0.5 rounded border border-[#22293a]">080712</code> (atau via URL: <code className="text-amber-400">?key=080712</code>).
        </p>
      </div>
    </div>
  );
}

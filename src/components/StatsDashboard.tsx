"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Bot,
  ShieldAlert,
  Globe,
  Activity,
  RefreshCw,
  Lock,
  ArrowLeft,
  Search,
  Server,
  Smartphone,
  Laptop,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Compass,
  Radar,
} from 'lucide-react';
import { 
  subscribeVisitorLogs, 
  fetchVisitorLogsOnce, 
  computeStatsSummary,
  trackVisitor 
} from '../services/visitorTracker';
import { app } from '../services/firebase';
import type { VisitorRecord } from '../types/stats';

interface StatsDashboardProps {
  onBackToPortfolio: () => void;
  onLock: () => void;
}

export default function StatsDashboard({ onBackToPortfolio, onLock }: StatsDashboardProps) {
  const [logs, setLogs] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'all' | 'human' | 'vpn' | 'bot'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [simulatingVisit, setSimulatingVisit] = useState(false);

  // Firestore Realtime Subscription
  useEffect(() => {
    const unsubscribe = subscribeVisitorLogs(
      (newLogs) => {
        setLogs(newLogs);
        setLoading(false);
        setLastRefreshed(new Date());
      },
      (err) => {
        console.warn('[StatsDashboard] Realtime failed, fetching static once:', err);
        fetchVisitorLogsOnce().then((fallbackLogs) => {
          setLogs(fallbackLogs);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    const freshLogs = await fetchVisitorLogsOnce();
    setLogs(freshLogs);
    setLoading(false);
    setLastRefreshed(new Date());
  };

  // Simulate a test visit if user wants to test logging immediately
  const handleTestVisit = async () => {
    setSimulatingVisit(true);
    // Temporarily clear session storage to force recording
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('portfolio_tracked_visit_timestamp');
    }
    await trackVisitor('/demo-test');
    setTimeout(async () => {
      await handleManualRefresh();
      setSimulatingVisit(false);
    }, 1200);
  };

  // Aggregated calculations
  const summary = useMemo(() => computeStatsSummary(logs), [logs]);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Type filter
      if (filterType === 'human' && log.isBot) return false;
      if (filterType === 'bot' && !log.isBot) return false;
      if (filterType === 'vpn' && !(log.isVpn || log.isProxy || log.isTor)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCountry = (log.country || '').toLowerCase().includes(q);
        const matchCity = (log.city || '').toLowerCase().includes(q);
        const matchIp = (log.ip || '').toLowerCase().includes(q);
        const matchIsp = (log.isp || '').toLowerCase().includes(q);
        const matchBot = (log.botName || '').toLowerCase().includes(q);
        const matchBrowser = (log.browser || '').toLowerCase().includes(q);
        const matchPath = (log.path || '').toLowerCase().includes(q);
        return matchCountry || matchCity || matchIp || matchIsp || matchBot || matchBrowser || matchPath;
      }

      return true;
    });
  }, [logs, filterType, searchQuery]);

  const humanPercent = summary.totalVisitors > 0 ? Math.round((summary.humanCount / summary.totalVisitors) * 100) : 0;
  const botPercent = summary.totalVisitors > 0 ? Math.round((summary.botCount / summary.totalVisitors) * 100) : 0;
  const vpnPercent = summary.totalVisitors > 0 ? Math.round((summary.vpnCount / summary.totalVisitors) * 100) : 0;

function formatRelativeTime(timestamp: number, nowMs: number): string {
  const diffSec = Math.floor((nowMs - timestamp) / 1000);
  if (diffSec < 45) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

  return (
    <div className="min-h-screen bg-[#07090e] text-[#E1E4EA] pb-20 font-sans relative z-10 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background ambient accents */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Sticky Command Bar */}
      <header className="sticky top-0 z-30 bg-[#0a0d16]/95 backdrop-blur-xl border-b border-[#1c2233] px-4 sm:px-8 py-3.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Live Stream Indicator */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToPortfolio}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-[#22293d] hover:border-amber-500/40 bg-[#101422] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>

            <div className="h-4 w-px bg-[#22293d]" />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <Radar className="w-4 h-4 text-amber-400" />
                  Visitor Intelligence
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REALTIME FIRESTORE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Sinkronisasi: {lastRefreshed.toLocaleTimeString('id-ID')} · Database: <span className="text-amber-400/90 font-semibold">{app.options.projectId || 'cakrapala-6eee6'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestVisit}
              disabled={simulatingVisit}
              title="Simulasi 1 log kunjungan baru untuk uji coba"
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-[#22293d] bg-[#101422] hover:bg-[#161c2e] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${simulatingVisit ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{simulatingVisit ? 'Mencatat...' : 'Tes Log Kunjungan'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-[#22293d] bg-[#101422] hover:bg-[#161c2e] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={onLock}
              className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer font-medium"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci Akses</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Top KPI Cards (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Visitors */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#101422] to-[#0c0f1a] border border-[#20283d] shadow-xl relative overflow-hidden group hover:border-[#2d3855] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Kunjungan</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {summary.totalVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
              Tercatat di Firestore log
            </p>
          </div>

          {/* Card 2: Human vs Bot */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#101422] to-[#0c0f1a] border border-[#20283d] shadow-xl relative overflow-hidden group hover:border-[#2d3855] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Pengunjung Human</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
              <span>{summary.humanCount.toLocaleString()}</span>
              <span className="text-sm font-semibold text-emerald-400 font-mono">({humanPercent}%)</span>
            </div>
            <div className="w-full bg-[#182033] h-2 rounded-full mt-3 overflow-hidden flex">
              <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${humanPercent}%` }} />
              <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${botPercent}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between font-mono">
              <span className="text-emerald-400/90 font-medium">{summary.humanCount} Manusia</span>
              <span className="text-purple-400/90 font-medium">{summary.botCount} Bot Crawler</span>
            </p>
          </div>

          {/* Card 3: VPN / Proxy Users */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#101422] to-[#0c0f1a] border border-[#20283d] shadow-xl relative overflow-hidden group hover:border-[#2d3855] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Pengguna VPN / Proxy</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
              <span>{summary.vpnCount.toLocaleString()}</span>
              <span className="text-sm font-semibold text-amber-400 font-mono">({vpnPercent}%)</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              {summary.vpnCount > 0 ? (
                <span className="text-amber-400/90 font-medium">
                  {summary.vpnCount} IP teridentifikasi VPN/Tor relay
                </span>
              ) : (
                <span className="text-slate-400">Belum ada deteksi IP VPN</span>
              )}
            </p>
          </div>

          {/* Card 4: Global Reach (Countries) */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#101422] to-[#0c0f1a] border border-[#20283d] shadow-xl relative overflow-hidden group hover:border-[#2d3855] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Sebaran Negara</span>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)]">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {summary.uniqueCountries} <span className="text-sm font-normal text-slate-400">Negara</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 truncate">
              Asal terbanyak:{' '}
              <span className="text-white font-medium">
                {summary.topCountries[0]?.country || 'Belum ada data'}
              </span>
            </p>
          </div>
        </div>

        {/* Analytic Breakdown Grids (Country Distribution & Security Classification) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Geographic & Countries Breakdown */}
          <div className="lg:col-span-2 rounded-2xl bg-[#0a0d16]/95 border border-[#1e2538] p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#1c2233]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  Distribusi Negara Pengunjung
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Berdasarkan pemetaan GeoIP Intelligence
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-[#121726] px-2.5 py-1 rounded-lg border border-[#222b40]">
                {summary.topCountries.length} Lokasi Terdata
              </span>
            </div>

            {summary.topCountries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada data pengunjung yang tercatat.
              </div>
            ) : (
              <div className="space-y-4">
                {summary.topCountries.slice(0, 6).map((item) => (
                  <div key={item.country} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-white">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#131929] border border-[#242f47] text-amber-400 font-bold">
                          {item.countryCode}
                        </span>
                        <span>{item.country}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-slate-400 text-[11px]">
                        <span>{item.count} kunjungan</span>
                        <span className="text-white font-bold w-12 text-right">{item.percentage}%</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-[#131929] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right 1 Col: Security & Bot Radar */}
          <div className="rounded-2xl bg-[#0a0d16]/95 border border-[#1e2538] p-6 shadow-xl backdrop-blur-xl space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1c2233]">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Bot & Scraper Telemetry
                </h2>
              </div>

              {Object.keys(summary.botBreakdown).length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Tidak ada bot crawler yang terdeteksi saat ini.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {Object.entries(summary.botBreakdown).map(([botName, count]) => (
                    <div
                      key={botName}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#101422] border border-[#20273b] text-xs"
                    >
                      <span className="font-mono text-purple-300 truncate max-w-[170px]" title={botName}>
                        {botName}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30">
                        {count} hits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device breakdown */}
            <div className="pt-2 border-t border-[#1c2233]">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                Tipe Perangkat
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-[#101422] border border-[#20273b]">
                  <Laptop className="w-4 h-4 mx-auto text-slate-300 mb-1" />
                  <div className="text-xs font-bold text-white">{summary.deviceBreakdown.desktop}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Desktop</div>
                </div>
                <div className="p-3 rounded-xl bg-[#101422] border border-[#20273b]">
                  <Smartphone className="w-4 h-4 mx-auto text-slate-300 mb-1" />
                  <div className="text-xs font-bold text-white">{summary.deviceBreakdown.mobile}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Mobile</div>
                </div>
                <div className="p-3 rounded-xl bg-[#101422] border border-[#20273b]">
                  <Server className="w-4 h-4 mx-auto text-slate-300 mb-1" />
                  <div className="text-xs font-bold text-white">{summary.deviceBreakdown.tablet}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Tablet</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Visitor Activity Stream Table */}
        <div className="rounded-2xl bg-[#0a0d16]/95 border border-[#1e2538] shadow-xl overflow-hidden backdrop-blur-xl">
          {/* Table Header & Search Filter Bar */}
          <div className="p-6 border-b border-[#1c2233] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                Live Audit Logs Pengunjung
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan rekaman log real-time dari Firestore ({filteredLogs.length} entri)
              </p>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Type Pills */}
              <div className="inline-flex rounded-xl bg-[#101422] p-1 border border-[#20283d]">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-amber-500 text-[#090b10] font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('human')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    filterType === 'human'
                      ? 'bg-emerald-500 text-[#090b10] font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Human ({summary.humanCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('vpn')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    filterType === 'vpn'
                      ? 'bg-amber-500 text-[#090b10] font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  VPN ({summary.vpnCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('bot')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    filterType === 'bot'
                      ? 'bg-purple-500 text-[#090b10] font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bot ({summary.botCount})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 md:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari IP, negara, bot, ISP..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs text-white bg-[#101422] border border-[#20283d] rounded-xl focus:border-amber-500/70 focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1c2233] bg-[#07090f] text-[11px] font-mono uppercase text-slate-400">
                  <th className="py-3.5 px-4 font-semibold">Waktu</th>
                  <th className="py-3.5 px-4 font-semibold">Alamat IP (Raw) & ISP</th>
                  <th className="py-3.5 px-4 font-semibold">Lokasi Geografis</th>
                  <th className="py-3.5 px-4 font-semibold">Klasifikasi Keamanan</th>
                  <th className="py-3.5 px-4 font-semibold">Perangkat / OS</th>
                  <th className="py-3.5 px-4 font-semibold">Halaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171d2c]">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Memuat data dari Firestore...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tidak ada log pengunjung yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isVpnDetected = log.isVpn || log.isProxy || log.isTor;

                    return (
                      <tr
                        key={log.id || `${log.timestamp}-${log.ip}`}
                        className="hover:bg-[#121726]/70 transition-colors"
                      >
                        {/* Waktu */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-white">
                            {formatRelativeTime(log.timestamp, lastRefreshed.getTime())}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>

                        {/* IP (ASLI / UNMASKED) & ISP */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-amber-300 font-bold tracking-tight">
                            {log.fullIp || log.ip}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={log.isp}>
                            {log.isp || 'Unknown ISP'}
                          </div>
                        </td>

                        {/* Lokasi */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-white">
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#131929] border border-[#242f47] text-amber-400">
                              {log.countryCode || 'UN'}
                            </span>
                            <span>{log.country || 'Unknown'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {log.city && log.city !== 'Unknown' ? log.city : '-'}
                          </div>
                        </td>

                        {/* Klasifikasi Keamanan & Deteksi */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {log.isBot ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                                <Bot className="w-3 h-3" />
                                {log.botName || 'Bot'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Human
                              </span>
                            )}

                            {isVpnDetected && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                                <AlertTriangle className="w-3 h-3" />
                                VPN Detected
                              </span>
                            )}

                            {log.isDatacenter && !isVpnDetected && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/25">
                                Datacenter
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Perangkat & Browser */}
                        <td className="py-3.5 px-4">
                          <div className="text-white font-medium">
                            {log.browser} · {log.os}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.deviceType} ({log.screenResolution})
                          </div>
                        </td>

                        {/* Halaman */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-amber-400/90">
                          {log.path || '/'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

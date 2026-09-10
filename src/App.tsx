import React, { useState, useEffect, lazy, Suspense } from 'react';
import { trackVisitor } from './services/visitorTracker';

// Lazy-loaded components for optimal bundle performance
const StatsDashboard = lazy(() => import('./components/StatsDashboard'));
const StatsPasscodeGate = lazy(() => import('./components/StatsPasscodeGate'));

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.replace(/\/+$/, '') || '/';
    }
    return '/';
  });

  const [isStatsUnlocked, setIsStatsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('stats_auth_unlocked') === 'true';
    }
    return false;
  });

  // Path change listener for client-side navigation
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      setCurrentPath(p);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Background visitor tracking without blocking UI rendering
  useEffect(() => {
    trackVisitor(currentPath).catch((err) => {
      console.debug('[App] Telemetry tracking error:', err);
    });
  }, [currentPath]);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path.replace(/\/+$/, '') || '/');
    }
  };

  const isStatsRoute = currentPath === '/stats';

  if (isStatsRoute) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-[#07090e] font-mono text-xs text-amber-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>MEMUAT TELEMETRI CAKRAPALA...</span>
            </div>
          </div>
        }
      >
        {isStatsUnlocked ? (
          <StatsDashboard
            onBackToPortfolio={() => navigateTo('/')}
            onLock={() => {
              sessionStorage.removeItem('stats_auth_unlocked');
              setIsStatsUnlocked(false);
            }}
          />
        ) : (
          <StatsPasscodeGate
            onUnlock={() => {
              sessionStorage.setItem('stats_auth_unlocked', 'true');
              setIsStatsUnlocked(true);
            }}
            onBackToPortfolio={() => navigateTo('/')}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col justify-between p-8 font-sans">
      <main className="max-w-4xl mx-auto text-center py-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          Cakrapala Deep Space Observatory
        </h1>
        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
          Sistem navigasi aerospace dan observatorium astronomi real-time terpadu.
        </p>
        <button
          onClick={() => navigateTo('/stats')}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
        >
          Buka Dashboard /stats
        </button>
      </main>

      <footer className="text-center text-xs text-slate-600 border-t border-slate-800/80 pt-6 flex items-center justify-center gap-4">
        <span>&copy; {new Date().getFullYear()} Cakrapala Aerospace Systems</span>
        <button
          onClick={() => navigateTo('/stats')}
          className="text-slate-600 hover:text-amber-400 transition-colors cursor-pointer"
        >
          [SYS-STATS]
        </button>
      </footer>
    </div>
  );
}

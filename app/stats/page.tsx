"use client";

import { useState, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";

// Asynchronously load the heavy telemetry dashboard and passcode gate
const StatsDashboard = lazy(() => import("@/src/components/StatsDashboard"));
const StatsPasscodeGate = lazy(() => import("@/src/components/StatsPasscodeGate"));

function StatsContainer() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("stats_auth_unlocked") === "true";
    }
    return false;
  });

  const handleUnlock = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("stats_auth_unlocked", "true");
    }
    setUnlocked(true);
  };

  const handleLock = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("stats_auth_unlocked");
    }
    setUnlocked(false);
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center font-mono text-xs text-amber-400">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span>LOADING TELEMETRY DECK...</span>
          </div>
        </div>
      }
    >
      {unlocked ? (
        <StatsDashboard onBackToPortfolio={handleBackToHome} onLock={handleLock} />
      ) : (
        <StatsPasscodeGate onUnlock={handleUnlock} onBackToPortfolio={handleBackToHome} />
      )}
    </Suspense>
  );
}

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center font-mono text-xs text-amber-400">
          <span>LOADING...</span>
        </div>
      }
    >
      <StatsContainer />
    </Suspense>
  );
}

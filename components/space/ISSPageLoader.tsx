"use client";

import { useState, useEffect } from "react";
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";

interface ISSPageLoaderProps {
  onReady: () => void;
}

export default function ISSPageLoader({ onReady }: ISSPageLoaderProps) {
  const [progress, setProgress] = useState(14);
  const [status, setStatus] = useState("Acquiring NORAD uplink");

  useEffect(() => {
    const stages = [
      { delay: 90, progress: 34, status: "Locking TLE orbital elements" },
      { delay: 210, progress: 58, status: "Calibrating SGP4 ground track" },
      { delay: 360, progress: 82, status: "Synchronizing live orbital stream" },
      { delay: 520, progress: 100, status: "Orbital telemetry nominal" },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const stage of stages) {
      timers.push(
        setTimeout(() => {
          setProgress(stage.progress);
          setStatus(stage.status);
        }, stage.delay),
      );
    }

    timers.push(setTimeout(onReady, 700));
    return () => timers.forEach(clearTimeout);
  }, [onReady]);

  return (
    <ObservatoryLoader
      variant="fullscreen"
      title="CAKRAPALA"
      subtitle={status}
      progress={progress}
    />
  );
}

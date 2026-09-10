"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackVisitor } from "@/src/services/visitorTracker";

export default function VisitorTelemetryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      // Fire-and-forget asynchronous visitor telemetry logging
      trackVisitor(pathname).catch((err) => {
        console.debug("[Telemetry] Background visitor tracking skipped:", err);
      });
    }
  }, [pathname]);

  return null;
}

import type { Metadata } from "next";
import MissionControlDashboard from "@/components/mission-control/MissionControlDashboard";

export const metadata: Metadata = {
  title: "Cakrapala — AI Mission Control",
  description:
    "Physics-based AI-assisted mission planning workspace. Satellite launch orbit feasibility, lunar free-return trajectory explorer, Lambert solver, Tsiolkovsky delta-v analysis, and deterministic risk assessment.",
};

export default function MissionControlPage() {
  return <MissionControlDashboard />;
}

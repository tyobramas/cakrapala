import type { Metadata } from "next";
import FlightPlannerLayout from "@/components/trajectories/FlightPlannerLayout";

export const metadata: Metadata = {
  title: "Cakrapala — Orbital Trajectory & Lunar Flight Path Planner",
  description:
    "Interactive 3D Astrodynamics Trajectory Planner with Keplerian mechanics, Hohmann transfers, Trans-Lunar Injection (TLI), 3-Body Free-Return loops, and AI Delta-V budget optimization.",
};

export default function TrajectoriesPage() {
  return <FlightPlannerLayout />;
}

import { NextRequest, NextResponse } from "next/server";
import { generateDeterministicMissionAnalysis } from "@/lib/mission-control/aiMissionAnalysis";
import { validateTrajectory } from "@/lib/mission-control/trajectoryValidation";
import type {
  MissionCandidate,
  MissionAnalysisResult,
  SatelliteLaunchInput,
  LunarFreeReturnInput,
} from "@/lib/mission-control/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, result, candidate } = body as {
      input: SatelliteLaunchInput | LunarFreeReturnInput;
      result: MissionAnalysisResult;
      candidate: MissionCandidate;
    };

    if (!input || !result || !candidate) {
      return NextResponse.json(
        { error: "Missing required mission analysis payloads." },
        { status: 400 }
      );
    }

    // 1. Strict Trajectory Validation
    const validation = validateTrajectory(candidate, result.missionType);

    // 2. Generate grounded post-analysis
    const analysis = generateDeterministicMissionAnalysis(
      input,
      result,
      candidate,
      validation
    );

    return NextResponse.json({
      success: true,
      analysis,
      validation,
    });
  } catch (error) {
    console.error("Mission Post-Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to generate mission analysis." },
      { status: 500 }
    );
  }
}

/**
 * AI Mission Control — Multi-Stage Rocket Performance.
 *
 * The single-stage Tsiolkovsky model forces a vehicle to carry ALL of its
 * inert mass to burnout. Real launchers discard each stage's structure the
 * moment it is empty, which is the entire reason staging exists.
 *
 * Staged delta-v:
 *
 *   Δv_total = Σ  Isp_eff,i · g₀ · ln( m_ign,i / m_bo,i )
 *
 *   m_ign,i = gross_i + Σ(gross_j for j>i) + payload
 *   m_bo,i  = m_ign,i − propellant_i
 *
 * First-stage effective Isp blends sea-level and vacuum performance:
 *
 *   Isp_eff = (Isp_SL + 2·Isp_vac) / 3
 *
 * which reflects a first stage spending roughly a third of its burn in
 * appreciable atmosphere. Upper stages use vacuum Isp directly.
 *
 * NOTE: this module is dependency-free by design (it deliberately does NOT
 * import from the planners) so that planners can import it without creating
 * a circular module graph.
 */

import type { StagePreset, VehiclePreset } from "./types";
import { G0_MPS2 } from "./constants";

// ── Results ───────────────────────────────────────────────────────────────────

export interface StageDeltaV {
    index: number;
    name: string;
    ignitionMassKg: number;
    burnoutMassKg: number;
    propellantMassKg: number;
    effectiveIspS: number;
    massRatio: number;
    deltaVMps: number;
}

export interface MultiStageResult {
    totalDeltaVMps: number;
    stages: StageDeltaV[];
    liftoffMassKg: number;
    valid: boolean;
    failureReason?: string;
}

// ── Effective specific impulse ────────────────────────────────────────────────

/**
 * Effective Isp for a stage. Stages that declare a sea-level Isp are treated
 * as atmospheric (first stage) and get the 1:2 sea-level/vacuum blend.
 */
export function effectiveIspS(stage: StagePreset): number {
    if (
        stage.ispSeaLevelS !== undefined &&
        Number.isFinite(stage.ispSeaLevelS) &&
        stage.ispSeaLevelS > 0
    ) {
        return (stage.ispSeaLevelS + 2 * stage.ispVacuumS) / 3;
    }
    return stage.ispVacuumS;
}

// ── Staged delta-v ────────────────────────────────────────────────────────────

/**
 * Total ideal delta-v of a staged vehicle carrying a given payload.
 *
 * Stages must be ordered from first-fired to last-fired.
 */
export function multiStageDeltaV(
    stages: StagePreset[],
    payloadMassKg: number
): MultiStageResult {
    if (!stages || stages.length === 0) {
        return {
            totalDeltaVMps: 0,
            stages: [],
            liftoffMassKg: payloadMassKg,
            valid: false,
            failureReason: "No stages defined.",
        };
    }

    if (!Number.isFinite(payloadMassKg) || payloadMassKg < 0) {
        return {
            totalDeltaVMps: 0,
            stages: [],
            liftoffMassKg: 0,
            valid: false,
            failureReason: `Invalid payload mass: ${payloadMassKg}`,
        };
    }

    // Validate stage definitions before doing any arithmetic.
    for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        if (!Number.isFinite(s.grossMassKg) || s.grossMassKg <= 0) {
            return {
                totalDeltaVMps: 0,
                stages: [],
                liftoffMassKg: 0,
                valid: false,
                failureReason: `Stage ${i + 1} has invalid gross mass.`,
            };
        }
        if (!Number.isFinite(s.dryMassKg) || s.dryMassKg <= 0) {
            return {
                totalDeltaVMps: 0,
                stages: [],
                liftoffMassKg: 0,
                valid: false,
                failureReason: `Stage ${i + 1} has invalid dry mass.`,
            };
        }
        if (s.dryMassKg >= s.grossMassKg) {
            return {
                totalDeltaVMps: 0,
                stages: [],
                liftoffMassKg: 0,
                valid: false,
                failureReason: `Stage ${i + 1} dry mass >= gross mass (no propellant).`,
            };
        }
        if (!Number.isFinite(s.ispVacuumS) || s.ispVacuumS <= 0) {
            return {
                totalDeltaVMps: 0,
                stages: [],
                liftoffMassKg: 0,
                valid: false,
                failureReason: `Stage ${i + 1} has invalid vacuum Isp.`,
            };
        }
    }

    // Mass above stage i = all later stages (gross) + payload.
    const massAbove: number[] = new Array(stages.length).fill(0);
    let running = payloadMassKg;
    for (let i = stages.length - 1; i >= 0; i--) {
        massAbove[i] = running;
        running += stages[i].grossMassKg;
    }
    const liftoffMassKg = running;

    const results: StageDeltaV[] = [];
    let total = 0;

    for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const propellant = s.grossMassKg - s.dryMassKg;
        const ignition = s.grossMassKg + massAbove[i];
        const burnout = ignition - propellant;

        if (burnout <= 0) {
            return {
                totalDeltaVMps: 0,
                stages: [],
                liftoffMassKg,
                valid: false,
                failureReason: `Stage ${i + 1} burnout mass is non-positive.`,
            };
        }

        const isp = effectiveIspS(s);
        const ratio = ignition / burnout;
        const dv = isp * G0_MPS2 * Math.log(ratio);

        results.push({
            index: i + 1,
            name: s.name,
            ignitionMassKg: ignition,
            burnoutMassKg: burnout,
            propellantMassKg: propellant,
            effectiveIspS: isp,
            massRatio: ratio,
            deltaVMps: dv,
        });

        total += dv;
    }

    return {
        totalDeltaVMps: total,
        stages: results,
        liftoffMassKg,
        valid: true,
    };
}

// ── Single-stage fallback ─────────────────────────────────────────────────────

/**
 * Single-stage Tsiolkovsky. Retained for vehicles that do not declare a stage
 * stack. Duplicated here (rather than imported) to keep this module free of
 * planner dependencies.
 */
export function singleStageDeltaVMps(
    ispS: number,
    wetMassKg: number,
    dryMassKg: number,
    payloadMassKg: number
): number {
    if (
        !Number.isFinite(ispS) || ispS <= 0 ||
        !Number.isFinite(wetMassKg) || wetMassKg <= 0 ||
        !Number.isFinite(dryMassKg) || dryMassKg <= 0 ||
        !Number.isFinite(payloadMassKg) || payloadMassKg < 0
    ) {
        return 0;
    }
    const mf = dryMassKg + payloadMassKg;
    if (mf >= wetMassKg) return 0;
    return ispS * G0_MPS2 * Math.log(wetMassKg / mf);
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Delta-v capability of a vehicle preset with a given payload.
 * Uses the staged model when a stage stack is defined, otherwise falls back
 * to the single-stage approximation.
 */
export function vehicleDeltaVMps(
    vehicle: VehiclePreset,
    payloadMassKg: number
): number {
    if (vehicle.stages && vehicle.stages.length > 0) {
        const r = multiStageDeltaV(vehicle.stages, payloadMassKg);
        if (r.valid) return r.totalDeltaVMps;
    }
    return singleStageDeltaVMps(
        vehicle.specificImpulseS,
        vehicle.wetMassKg,
        vehicle.dryMassKg,
        payloadMassKg
    );
}

/**
 * Full staged breakdown for UI display. Returns null for unstaged vehicles.
 */
export function vehicleStageBreakdown(
    vehicle: VehiclePreset,
    payloadMassKg: number
): MultiStageResult | null {
    if (!vehicle.stages || vehicle.stages.length === 0) return null;
    return multiStageDeltaV(vehicle.stages, payloadMassKg);
}

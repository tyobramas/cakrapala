import type { SatelliteOmmRecord } from "./catalogTypes";

export interface CatalogWorkerInitializeMessage {
    type: "initialize";
    satellites: SatelliteOmmRecord[];
}

export interface CatalogWorkerPropagateMessage {
    type: "propagate";
    timestamp: number;
}

export interface AnalyzeSelectedSatelliteMessage {
    type: "analyze-selected";
    requestId: number;
    noradId: number;
    startTimestamp: number;
    sampleCount: number;
}

export type CatalogWorkerInboundMessage =
    | CatalogWorkerInitializeMessage
    | CatalogWorkerPropagateMessage
    | AnalyzeSelectedSatelliteMessage;

export interface CatalogWorkerReadyMessage {
    type: "ready";
    count: number;
    validSatrecCount: number;
}

export interface CatalogWorkerPositionMessage {
    type: "positions";
    timestamp: number;
    count: number;
    validCount: number;
    /**
     * Earth-Centered Earth-Fixed positions in kilometers.
     * Data order: x0, y0, z0, x1, y1, z1, ...
     */
    positionsEcfKm: Float64Array;
    /**
     * Inertial speed magnitude in kilometers per second.
     */
    speedsKmS: Float32Array;
    /**
     * One byte per catalog object: 1 = valid, 0 = unavailable.
     */
    valid: Uint8Array;
}

export interface SelectedSatelliteAnalysisMessage {
    type: "selected-analysis";
    requestId: number;
    noradId: number;
    elementEpoch: string;
    timestamps: Float64Array;
    positionsEcfKm: Float64Array;
    altitudesKm: Float32Array;
    speedsKmS: Float32Array;
    latitudesDeg: Float32Array;
    longitudesDeg: Float32Array;
    valid: Uint8Array;
}

export interface CatalogWorkerErrorMessage {
    type: "error";
    code: "NOT_INITIALIZED" | "PROPAGATION_FAILED" | "ANALYSIS_FAILED";
    message: string;
}

export type CatalogWorkerOutboundMessage =
    | CatalogWorkerReadyMessage
    | CatalogWorkerPositionMessage
    | SelectedSatelliteAnalysisMessage
    | CatalogWorkerErrorMessage;

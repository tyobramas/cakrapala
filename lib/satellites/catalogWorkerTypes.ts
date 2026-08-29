import type { SatelliteOmmRecord } from "./catalogTypes";

export interface CatalogWorkerInitializeMessage {
    type: "initialize";
    satellites: SatelliteOmmRecord[];
}

export interface CatalogWorkerPropagateMessage {
    type: "propagate";
    timestamp: number;
}

export type CatalogWorkerInboundMessage =
    | CatalogWorkerInitializeMessage
    | CatalogWorkerPropagateMessage;

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

export interface CatalogWorkerErrorMessage {
    type: "error";
    code: "NOT_INITIALIZED" | "PROPAGATION_FAILED";
    message: string;
}

export type CatalogWorkerOutboundMessage =
    | CatalogWorkerReadyMessage
    | CatalogWorkerPositionMessage
    | CatalogWorkerErrorMessage;

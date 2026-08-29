import {
    prepareSatelliteCatalog,
    propagateSatelliteCatalog,
    propagateSatelliteProfile,
    type PreparedSatellite,
} from "../lib/satellites/catalogPropagation";
import type {
    CatalogWorkerInboundMessage,
    CatalogWorkerOutboundMessage,
} from "../lib/satellites/catalogWorkerTypes";

interface CatalogWorkerScope {
    onmessage:
    | ((event: MessageEvent<CatalogWorkerInboundMessage>) => void)
    | null;
    postMessage(
        message: CatalogWorkerOutboundMessage,
        transfer?: Transferable[]
    ): void;
}

const workerScope = self as unknown as CatalogWorkerScope;

let preparedSatellites: PreparedSatellite[] | null = null;
let satelliteMap: Map<number, PreparedSatellite> | null = null;

function sendError(
    code: "NOT_INITIALIZED" | "PROPAGATION_FAILED" | "ANALYSIS_FAILED",
    message: string
): void {
    workerScope.postMessage({
        type: "error",
        code,
        message,
    });
}

workerScope.onmessage = (
    event: MessageEvent<CatalogWorkerInboundMessage>
) => {
    const message = event.data;

    if (message.type === "initialize") {
        preparedSatellites = prepareSatelliteCatalog(
            message.satellites
        );

        satelliteMap = new Map();
        for (const prepared of preparedSatellites) {
            satelliteMap.set(prepared.noradId, prepared);
        }

        const validSatrecCount = preparedSatellites.reduce(
            (count, satellite) =>
                count + (satellite.satrec ? 1 : 0),
            0
        );

        workerScope.postMessage({
            type: "ready",
            count: preparedSatellites.length,
            validSatrecCount,
        });

        return;
    }

    if (message.type === "propagate") {
        if (!preparedSatellites) {
            sendError(
                "NOT_INITIALIZED",
                "Catalog worker has not received orbital records"
            );
            return;
        }

        try {
            const result = propagateSatelliteCatalog(
                preparedSatellites,
                new Date(message.timestamp)
            );

            workerScope.postMessage(
                {
                    type: "positions",
                    timestamp: result.timestamp,
                    count: result.count,
                    validCount: result.validCount,
                    positionsEcfKm: result.positionsEcfKm,
                    speedsKmS: result.speedsKmS,
                    valid: result.valid,
                },
                [
                    result.positionsEcfKm.buffer,
                    result.speedsKmS.buffer,
                    result.valid.buffer,
                ]
            );
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown SGP4 propagation error";

            sendError("PROPAGATION_FAILED", errorMessage);
        }
        return;
    }

    if (message.type === "analyze-selected") {
        if (!satelliteMap) {
            sendError(
                "NOT_INITIALIZED",
                "Catalog worker has not received orbital records"
            );
            return;
        }

        const prepared = satelliteMap.get(message.noradId);
        if (!prepared) {
            sendError(
                "ANALYSIS_FAILED",
                `Satellite NORAD #${message.noradId} not found in prepared catalog`
            );
            return;
        }

        try {
            const profile = propagateSatelliteProfile(
                prepared,
                message.startTimestamp,
                message.sampleCount,
                message.requestId
            );

            workerScope.postMessage(
                profile,
                [
                    profile.timestamps.buffer,
                    profile.positionsEcfKm.buffer,
                    profile.altitudesKm.buffer,
                    profile.speedsKmS.buffer,
                    profile.latitudesDeg.buffer,
                    profile.longitudesDeg.buffer,
                    profile.valid.buffer,
                ]
            );
        } catch (err: unknown) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Unknown SGP4 analysis error";
            sendError("ANALYSIS_FAILED", errorMsg);
        }
    }
};

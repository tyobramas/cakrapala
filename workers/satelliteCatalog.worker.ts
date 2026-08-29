import {
    prepareSatelliteCatalog,
    propagateSatelliteCatalog,
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

function sendError(
    code: "NOT_INITIALIZED" | "PROPAGATION_FAILED",
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
    }
};

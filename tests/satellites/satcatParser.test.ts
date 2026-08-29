import { describe, expect, it } from "vitest";
import {
    formatObjectType,
    formatOperationalStatus,
    parseSatcatCatalog,
    parseSatcatRecord,
} from "../../lib/satellites/satcatParser";

describe("SATCAT Parser & Formatters", () => {
    it("parses valid SATCAT record correctly", () => {
        const raw = {
            OBJECT_NAME: "ISS (ZARYA)",
            OBJECT_ID: "1998-067A",
            NORAD_CAT_ID: 25544,
            OBJECT_TYPE: "PAY",
            OPS_STATUS_CODE: "+",
            OWNER: "ISS",
            LAUNCH_DATE: "1998-11-20",
            LAUNCH_SITE: "TTMTR",
            DECAY_DATE: null,
            PERIOD: 92.9,
            INCLINATION: 51.64,
            APOGEE: 422,
            PERIGEE: 414,
            RCS: 400.0,
            DATA_STATUS_CODE: "0",
            ORBIT_CENTER: "EA",
            ORBIT_TYPE: "ORB",
        };

        const parsed = parseSatcatRecord(raw);
        expect(parsed).not.toBeNull();
        expect(parsed?.OBJECT_NAME).toBe("ISS (ZARYA)");
        expect(parsed?.NORAD_CAT_ID).toBe(25544);
        expect(parsed?.OBJECT_TYPE).toBe("PAY");
        expect(parsed?.OPS_STATUS_CODE).toBe("+");
        expect(parsed?.OWNER).toBe("ISS");
        expect(parsed?.PERIOD).toBe(92.9);
        expect(parsed?.APOGEE).toBe(422);
        expect(parsed?.PERIGEE).toBe(414);
        expect(parsed?.RCS).toBe(400);
    });

    it("rejects records with missing or non-positive integer NORAD_CAT_ID", () => {
        expect(parseSatcatRecord({ OBJECT_NAME: "FOO", NORAD_CAT_ID: -1 })).toBeNull();
        expect(parseSatcatRecord({ OBJECT_NAME: "FOO", NORAD_CAT_ID: 0 })).toBeNull();
        expect(parseSatcatRecord({ OBJECT_NAME: "FOO", NORAD_CAT_ID: "NaN" })).toBeNull();
        expect(parseSatcatRecord({ OBJECT_NAME: "FOO", NORAD_CAT_ID: null })).toBeNull();
        expect(parseSatcatRecord(null)).toBeNull();
        expect(parseSatcatRecord("not an object")).toBeNull();
    });

    it("deduplicates multiple records by NORAD_CAT_ID and ignores corrupted entries", () => {
        const rawCatalog = [
            { OBJECT_NAME: "SAT 1", NORAD_CAT_ID: 1001, OBJECT_TYPE: "PAY" },
            { OBJECT_NAME: "SAT 1 DUPLICATE", NORAD_CAT_ID: 1001, OBJECT_TYPE: "PAY" },
            { OBJECT_NAME: "CORRUPT SAT", NORAD_CAT_ID: -5 },
            { OBJECT_NAME: "SAT 2", NORAD_CAT_ID: 1002, OBJECT_TYPE: "R/B" },
            "invalid element",
        ];

        const catalog = parseSatcatCatalog(rawCatalog);
        expect(catalog).toHaveLength(2);
        expect(catalog[0].NORAD_CAT_ID).toBe(1001);
        expect(catalog[0].OBJECT_NAME).toBe("SAT 1");
        expect(catalog[1].NORAD_CAT_ID).toBe(1002);
        expect(catalog[1].OBJECT_TYPE).toBe("R/B");
    });

    it("formats operational status codes accurately", () => {
        expect(formatOperationalStatus("+")).toEqual({ label: "Operational", code: "+", isOperational: true });
        expect(formatOperationalStatus("-")).toEqual({ label: "Nonoperational", code: "-", isOperational: false });
        expect(formatOperationalStatus("P")).toEqual({ label: "Partially Operational", code: "P", isOperational: true });
        expect(formatOperationalStatus("B")).toEqual({ label: "Backup / Standby", code: "B", isOperational: true });
        expect(formatOperationalStatus("S")).toEqual({ label: "Spare", code: "S", isOperational: true });
        expect(formatOperationalStatus("X")).toEqual({ label: "Extended Mission", code: "X", isOperational: true });
        expect(formatOperationalStatus("D")).toEqual({ label: "Decayed", code: "D", isOperational: false });
        expect(formatOperationalStatus("?")).toEqual({ label: "Unknown", code: "?", isOperational: false });
        expect(formatOperationalStatus(null)).toEqual({ label: "Unknown", code: "?", isOperational: false });
    });

    it("formats object types accurately", () => {
        expect(formatObjectType("PAY")).toBe("Payload");
        expect(formatObjectType("R/B")).toBe("Rocket Body");
        expect(formatObjectType("DEB")).toBe("Debris");
        expect(formatObjectType("UNK")).toBe("Unknown Object");
        expect(formatObjectType(null)).toBe("Unknown Object");
    });
});

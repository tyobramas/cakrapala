import { describe, expect, it } from "vitest";
import { formatSatelliteOwner } from "../../lib/satellites/ownerMetadata";

describe("Owner & Country Metadata Mapping", () => {
    it("maps known countries with accurate flag emojis", () => {
        const us = formatSatelliteOwner("US");
        expect(us.name).toBe("United States");
        expect(us.flag).toBe("🇺🇸");
        expect(us.kind).toBe("country");

        const jpn = formatSatelliteOwner("JPN");
        expect(jpn.name).toBe("Japan");
        expect(jpn.flag).toBe("🇯🇵");
        expect(jpn.kind).toBe("country");

        const idn = formatSatelliteOwner("IDN");
        expect(idn.name).toBe("Indonesia");
        expect(idn.flag).toBe("🇮🇩");
        expect(idn.kind).toBe("country");
    });

    it("maps organizations without flags", () => {
        const esa = formatSatelliteOwner("ESA");
        expect(esa.name).toBe("European Space Agency");
        expect(esa.flag).toBeNull();
        expect(esa.kind).toBe("organization");

        const ses = formatSatelliteOwner("SES");
        expect(ses.name).toBe("SES S.A.");
        expect(ses.flag).toBeNull();
        expect(ses.kind).toBe("organization");
    });

    it("maps multinational consortia without flags", () => {
        const iss = formatSatelliteOwner("ISS");
        expect(iss.name).toBe("International Space Station Consortium");
        expect(iss.flag).toBeNull();
        expect(iss.kind).toBe("multinational");

        const nato = formatSatelliteOwner("NATO");
        expect(nato.name).toBe("North Atlantic Treaty Organization");
        expect(nato.flag).toBeNull();
        expect(nato.kind).toBe("multinational");
    });

    it("handles unknown owner codes gracefully without false flags", () => {
        const unknown = formatSatelliteOwner("XYZ99");
        expect(unknown.code).toBe("XYZ99");
        expect(unknown.name).toBe("Unknown owner (XYZ99)");
        expect(unknown.flag).toBeNull();
        expect(unknown.kind).toBe("unknown");
    });

    it("handles null and empty input safely", () => {
        const nullOwner = formatSatelliteOwner(null);
        expect(nullOwner.code).toBe("UNK");
        expect(nullOwner.name).toBe("Unknown Entity");
        expect(nullOwner.flag).toBeNull();
        expect(nullOwner.kind).toBe("unknown");

        const emptyOwner = formatSatelliteOwner("   ");
        expect(emptyOwner.code).toBe("UNK");
        expect(emptyOwner.flag).toBeNull();
    });
});

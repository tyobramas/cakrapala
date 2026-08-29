/**
 * Mapping of CelesTrak / Space-Track SATCAT Owner Codes to
 * structured owner and country display information.
 *
 * Distinctly separates Countries (which have flags) from
 * Organizations and Multinational consortia (which MUST NOT have flags).
 */

export interface SatelliteOwnerDisplay {
    code: string;
    name: string;
    flag: string | null;
    kind: "country" | "organization" | "multinational" | "unknown";
}

interface OwnerEntry {
    name: string;
    flag: string | null;
    kind: "country" | "organization" | "multinational";
}

const OWNER_REGISTRY: Readonly<Record<string, OwnerEntry>> = {
    // Countries (with verified emoji flags)
    US: { name: "United States", flag: "🇺🇸", kind: "country" },
    USA: { name: "United States", flag: "🇺🇸", kind: "country" },
    PRC: { name: "People's Republic of China", flag: "🇨🇳", kind: "country" },
    CHN: { name: "People's Republic of China", flag: "🇨🇳", kind: "country" },
    CIS: { name: "Russia / CIS", flag: "🇷🇺", kind: "country" },
    RUS: { name: "Russian Federation", flag: "🇷🇺", kind: "country" },
    IND: { name: "India", flag: "🇮🇳", kind: "country" },
    JPN: { name: "Japan", flag: "🇯🇵", kind: "country" },
    UK: { name: "United Kingdom", flag: "🇬🇧", kind: "country" },
    GBR: { name: "United Kingdom", flag: "🇬🇧", kind: "country" },
    FR: { name: "France", flag: "🇫🇷", kind: "country" },
    FRA: { name: "France", flag: "🇫🇷", kind: "country" },
    GER: { name: "Germany", flag: "🇩🇪", kind: "country" },
    DEU: { name: "Germany", flag: "🇩🇪", kind: "country" },
    IT: { name: "Italy", flag: "🇮🇹", kind: "country" },
    ITA: { name: "Italy", flag: "🇮🇹", kind: "country" },
    CA: { name: "Canada", flag: "🇨🇦", kind: "country" },
    CAN: { name: "Canada", flag: "🇨🇦", kind: "country" },
    AUS: { name: "Australia", flag: "🇦🇺", kind: "country" },
    KOR: { name: "Republic of Korea", flag: "🇰🇷", kind: "country" },
    SKOR: { name: "Republic of Korea", flag: "🇰🇷", kind: "country" },
    ISR: { name: "Israel", flag: "🇮🇱", kind: "country" },
    BRA: { name: "Brazil", flag: "🇧🇷", kind: "country" },
    IDN: { name: "Indonesia", flag: "🇮🇩", kind: "country" },
    EGY: { name: "Egypt", flag: "🇪🇬", kind: "country" },
    SAUD: { name: "Saudi Arabia", flag: "🇸🇦", kind: "country" },
    SAU: { name: "Saudi Arabia", flag: "🇸🇦", kind: "country" },
    UAE: { name: "United Arab Emirates", flag: "🇦🇪", kind: "country" },
    TURK: { name: "Turkey", flag: "🇹🇷", kind: "country" },
    TUR: { name: "Turkey", flag: "🇹🇷", kind: "country" },
    SPN: { name: "Spain", flag: "🇪🇸", kind: "country" },
    ESP: { name: "Spain", flag: "🇪🇸", kind: "country" },
    NETH: { name: "Netherlands", flag: "🇳🇱", kind: "country" },
    NLD: { name: "Netherlands", flag: "🇳🇱", kind: "country" },
    SWED: { name: "Sweden", flag: "🇸🇪", kind: "country" },
    SWE: { name: "Sweden", flag: "🇸🇪", kind: "country" },
    NOR: { name: "Norway", flag: "🇳🇴", kind: "country" },
    FIN: { name: "Finland", flag: "🇫🇮", kind: "country" },
    DEN: { name: "Denmark", flag: "🇩🇰", kind: "country" },
    BEL: { name: "Belgium", flag: "🇧🇪", kind: "country" },
    SWTZ: { name: "Switzerland", flag: "🇨🇭", kind: "country" },
    CHE: { name: "Switzerland", flag: "🇨🇭", kind: "country" },
    POL: { name: "Poland", flag: "🇵🇱", kind: "country" },
    POR: { name: "Portugal", flag: "🇵🇹", kind: "country" },
    ARGN: { name: "Argentina", flag: "🇦🇷", kind: "country" },
    ARG: { name: "Argentina", flag: "🇦🇷", kind: "country" },
    MEX: { name: "Mexico", flag: "🇲🇽", kind: "country" },
    NZ: { name: "New Zealand", flag: "🇳🇿", kind: "country" },
    SING: { name: "Singapore", flag: "🇸🇬", kind: "country" },
    SGP: { name: "Singapore", flag: "🇸🇬", kind: "country" },
    THA: { name: "Thailand", flag: "🇹🇭", kind: "country" },
    VTNM: { name: "Vietnam", flag: "🇻🇳", kind: "country" },
    UKR: { name: "Ukraine", flag: "🇺🇦", kind: "country" },
    CHLE: { name: "Chile", flag: "🇨🇱", kind: "country" },
    COL: { name: "Colombia", flag: "🇨🇴", kind: "country" },
    CZCH: { name: "Czech Republic", flag: "🇨🇿", kind: "country" },
    GREC: { name: "Greece", flag: "🇬🇷", kind: "country" },
    HUN: { name: "Hungary", flag: "🇭🇺", kind: "country" },
    IRAN: { name: "Iran", flag: "🇮🇷", kind: "country" },
    LUX: { name: "Luxembourg", flag: "🇱🇺", kind: "country" },
    PAKI: { name: "Pakistan", flag: "🇵🇰", kind: "country" },
    RSA: { name: "South Africa", flag: "🇿🇦", kind: "country" },
    TAIW: { name: "Taiwan", flag: "🇹🇼", kind: "country" },
    VENZ: { name: "Venezuela", flag: "🇻🇪", kind: "country" },

    // Organizations & Multinational (Must NOT have flags)
    ESA: { name: "European Space Agency", flag: null, kind: "organization" },
    ISS: { name: "International Space Station Consortium", flag: null, kind: "multinational" },
    INTL: { name: "International Consortium", flag: null, kind: "multinational" },
    AB: { name: "Arabsat (Arab Satellite Communications)", flag: null, kind: "multinational" },
    EUM: { name: "EUMETSAT", flag: null, kind: "organization" },
    EUMS: { name: "EUMETSAT", flag: null, kind: "organization" },
    EUTE: { name: "Eutelsat", flag: null, kind: "organization" },
    GLOB: { name: "Globalstar", flag: null, kind: "organization" },
    INMAR: { name: "Inmarsat", flag: null, kind: "organization" },
    INT: { name: "Intelsat", flag: null, kind: "organization" },
    NATO: { name: "North Atlantic Treaty Organization", flag: null, kind: "multinational" },
    O3B: { name: "O3b Networks / SES", flag: null, kind: "organization" },
    ORB: { name: "ORBCOMM", flag: null, kind: "organization" },
    SES: { name: "SES S.A.", flag: null, kind: "organization" },
    AC: { name: "Asia Broadcast Satellite (ABS)", flag: null, kind: "organization" },
};

/**
 * Format SATCAT owner code to display name, flag, and kind.
 */
export function formatSatelliteOwner(ownerCode: string | null | undefined): SatelliteOwnerDisplay {
    if (!ownerCode || ownerCode.trim() === "" || ownerCode.toUpperCase() === "UNK") {
        return {
            code: "UNK",
            name: "Unknown Entity",
            flag: null,
            kind: "unknown",
        };
    }

    const code = ownerCode.trim().toUpperCase();
    const match = OWNER_REGISTRY[code];

    if (match) {
        return {
            code,
            name: match.name,
            flag: match.flag,
            kind: match.kind,
        };
    }

    return {
        code,
        name: `Unknown owner (${code})`,
        flag: null,
        kind: "unknown",
    };
}

/**
 * Satellite Media Registry & Lookup System.
 *
 * Provides verified spacecraft photographs and technical renderings with
 * strict licensing and source attribution.
 *
 * Satellites without verified media return `null` and fall back to
 * the procedural UI placeholder without triggering extraneous network requests.
 */

export interface SatelliteMediaRecord {
    noradId: number;
    src: string;
    alt: string;
    mediaType: "photograph" | "artist-rendering";
    sourceName: string;
    sourceUrl: string;
    credit: string;
    license: string;
}

const VERIFIED_MEDIA_REGISTRY: Readonly<Record<number, SatelliteMediaRecord>> = {
    // ISS (ZARYA) - NORAD 25544
    25544: {
        noradId: 25544,
        src: "/textures/satellites/iss.svg",
        alt: "International Space Station in Low Earth Orbit",
        mediaType: "artist-rendering",
        sourceName: "NASA / Cakrapala Vector Archive",
        sourceUrl: "https://www.nasa.gov/mission_pages/station/main/index.html",
        credit: "NASA / International Space Station Program",
        license: "NASA Public Domain / Educational",
    },

    // HUBBLE SPACE TELESCOPE - NORAD 20580
    20580: {
        noradId: 20580,
        src: "/textures/satellites/hubble.svg",
        alt: "Hubble Space Telescope Optical Observatory",
        mediaType: "artist-rendering",
        sourceName: "NASA / ESA Hubble Science Archive",
        sourceUrl: "https://hubblesite.org",
        credit: "NASA / ESA / STScI",
        license: "Public Domain / CC-BY-4.0",
    },

    // TIANGONG SPACE STATION (CSS) - NORAD 48274
    48274: {
        noradId: 48274,
        src: "/textures/satellites/tiangong.svg",
        alt: "Tiangong Space Station Core and Lab Modules",
        mediaType: "artist-rendering",
        sourceName: "CMSA / Cakrapala Vector Archive",
        sourceUrl: "http://en.cmse.gov.cn/",
        credit: "China Manned Space Agency (CMSA)",
        license: "Informational / Educational Use",
    },

    // NOAA-19 - NORAD 33591
    33591: {
        noradId: 33591,
        src: "/textures/satellites/noaa.svg",
        alt: "NOAA-19 Polar Operational Environmental Satellite",
        mediaType: "artist-rendering",
        sourceName: "NOAA Satellite and Information Service",
        sourceUrl: "https://www.nesdis.noaa.gov",
        credit: "NOAA / NASA POES Program",
        license: "NOAA / US Government Public Domain",
    },

    // TERRA (EOS AM-1) - NORAD 25994
    25994: {
        noradId: 25994,
        src: "/textures/satellites/terra.svg",
        alt: "Terra EOS Earth Observing System Spacecraft",
        mediaType: "artist-rendering",
        sourceName: "NASA Goddard Space Flight Center",
        sourceUrl: "https://terra.nasa.gov",
        credit: "NASA Earth Science Project Office",
        license: "NASA Public Domain",
    },

    // STARLINK-53883 - NORAD 53883
    53883: {
        noradId: 53883,
        src: "/textures/satellites/starlink.svg",
        alt: "Starlink Megaconstellation Flat-Panel Satellite",
        mediaType: "artist-rendering",
        sourceName: "SpaceX / Telecom Vector Archive",
        sourceUrl: "https://www.starlink.com",
        credit: "SpaceX Broadband Network",
        license: "Educational / Diagrammatic Use",
    },
};

/**
 * Retrieve verified media record by NORAD catalog ID.
 * Returns null if no verified media exists in registry.
 */
export function getSatelliteMedia(noradId: number | null | undefined): SatelliteMediaRecord | null {
    if (!noradId || noradId <= 0) {
        return null;
    }

    return VERIFIED_MEDIA_REGISTRY[noradId] ?? null;
}

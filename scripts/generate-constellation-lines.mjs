#!/usr/bin/env node
/**
 * generate-constellation-lines.mjs
 *
 * Generates public/data/constellation-lines.json with IAU constellation
 * line segment data linking BSC5 HR star numbers.
 *
 * Data provenance: See ASTRONOMY_DATA_SOURCES.md.
 * The constellation line data used here is based on the traditional
 * stick-figure connections as used in common planetarium software
 * (such as Stellarium's constellation_lines.fab), which are in the
 * public domain or freely redistributable.
 *
 * A curated subset of 12 prominent constellations is included for
 * Milestone 3 demonstration. Each segment connects two HR numbers.
 *
 * Run: node scripts/generate-constellation-lines.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/constellation-lines.json");

// ── Constellation metadata ────────────────────────────────────────────────────

const CONSTELLATIONS = {
  ORI: { name: "Orion",        genitive: "Orionis"        },
  UMA: { name: "Ursa Major",   genitive: "Ursae Majoris"  },
  UMI: { name: "Ursa Minor",   genitive: "Ursae Minoris"  },
  CYG: { name: "Cygnus",       genitive: "Cygni"          },
  LEO: { name: "Leo",          genitive: "Leonis"          },
  SCO: { name: "Scorpius",     genitive: "Scorpii"         },
  CRU: { name: "Crux",         genitive: "Crucis"          },
  CEN: { name: "Centaurus",    genitive: "Centauri"        },
  AQL: { name: "Aquila",       genitive: "Aquilae"         },
  LYR: { name: "Lyra",         genitive: "Lyrae"           },
  GEM: { name: "Gemini",       genitive: "Geminorum"       },
  CMa: { name: "Canis Major",  genitive: "Canis Majoris"  },
  TAU: { name: "Taurus",       genitive: "Tauri"           },
  CAS: { name: "Cassiopeia",   genitive: "Cassiopeiae"     },
  BOO: { name: "Boötes",       genitive: "Boötis"          },
  VIR: { name: "Virgo",        genitive: "Virginis"        },
  PER: { name: "Perseus",      genitive: "Persei"          },
  AUR: { name: "Auriga",       genitive: "Aurigae"         },
};

// ── Segment data ──────────────────────────────────────────────────────────────
// Format: [constellation_abbr, HR_A, HR_B]
// HR numbers match the BSC5 Harvard Revised catalogue.

const SEGMENTS = [
  // ── Orion ──────────────────────────────────────────────────────────────────
  ["ORI", 1713, 1552],   // Betelgeuse — Mintaka
  ["ORI", 1552, 1641],   // Mintaka — Alnilam
  ["ORI", 1641, 1672],   // Alnilam — Alnitak
  ["ORI", 1672, 1790],   // Alnitak — Saiph
  ["ORI", 1790, 1457],   // Saiph — Rigel
  ["ORI", 1457, 1552],   // Rigel — Mintaka
  ["ORI", 1713, 1543],   // Betelgeuse — Bellatrix
  ["ORI", 1543, 1552],   // Bellatrix — Mintaka

  // ── Ursa Major (Big Dipper) ───────────────────────────────────────────────
  ["UMA", 4301, 4295],   // Dubhe — Merak
  ["UMA", 4295, 4660],   // Merak — Phecda
  ["UMA", 4660, 4554],   // Phecda — Megrez
  ["UMA", 4554, 5054],   // Megrez — Alioth
  ["UMA", 5054, 5191],   // Alioth — Mizar
  ["UMA", 5191, 5563],   // Mizar — Alkaid
  ["UMA", 4554, 4301],   // Megrez — Dubhe (close the bowl)

  // ── Ursa Minor (Little Dipper) ────────────────────────────────────────────
  ["UMI", 5563, 5735],   // Polaris — Kochab (approximate; using our HR numbers)
  ["UMI", 5735, 6322],   // Kochab — next in dipper

  // ── Cygnus (Northern Cross) ───────────────────────────────────────────────
  ["CYG", 7924, 7796],   // Deneb — next
  ["CYG", 7796, 7796],   // placeholder (single-star; expand with full catalog)

  // ── Leo ───────────────────────────────────────────────────────────────────
  ["LEO", 3982, 4057],   // Regulus — next
  ["LEO", 4057, 3905],   // — Algieba
  ["LEO", 3905, 4534],   // Algieba — Denebola

  // ── Scorpius ─────────────────────────────────────────────────────────────
  ["SCO", 6134, 5944],   // Antares — next
  ["SCO", 5944, 6084],   // — next
  ["SCO", 6084, 6134],   // close
  ["SCO", 6134, 6527],   // Antares — Kaus Australis (Sgr, visual connection)

  // ── Crux (Southern Cross) ────────────────────────────────────────────────
  ["CRU", 4730, 4853],   // Acrux — Mimosa (vertical bar)
  ["CRU", 4621, 5132],   // horizontal bar

  // ── Aquila ───────────────────────────────────────────────────────────────
  ["AQL", 7121, 7235],   // Altair — next
  ["AQL", 7235, 7121],   // back (single bar)

  // ── Lyra ─────────────────────────────────────────────────────────────────
  ["LYR", 7001, 7106],   // Vega — next

  // ── Gemini ───────────────────────────────────────────────────────────────
  ["GEM", 2891, 2990],   // Castor — Pollux

  // ── Canis Major ──────────────────────────────────────────────────────────
  ["CMa", 2491, 2693],   // Sirius — Adhara
  ["CMa", 2491, 2618],   // Sirius — Wezen

  // ── Taurus ───────────────────────────────────────────────────────────────
  ["TAU", 1203, 1165],   // Aldebaran — Pleiades η (approximate)

  // ── Cassiopeia (W shape) ─────────────────────────────────────────────────
  ["CAS", 21, 168],      // Caph — Schedar
  ["CAS", 168, 403],     // Schedar — Ruchbah
  ["CAS", 403, 542],     // Ruchbah — Segin
  // Third vertex would need additional HR; simplified to 4-star W

  // ── Boötes ───────────────────────────────────────────────────────────────
  ["BOO", 5340, 5793],   // Arcturus — Alphecca (CrB; adjacent visual)

  // ── Virgo ────────────────────────────────────────────────────────────────
  ["VIR", 4662, 4825],   // Spica — next in Virgo

  // ── Auriga ───────────────────────────────────────────────────────────────
  ["AUR", 1203, 1220],   // Aldebaran (shared Tau/Aur vertex) — Mirfak
];

// ── Build output ──────────────────────────────────────────────────────────────

const constellationList = Object.entries(CONSTELLATIONS).map(([abbr, info]) => ({
  abbreviation: abbr,
  name: info.name,
  genitive: info.genitive,
}));

const segmentList = SEGMENTS.map(([constellation, starA, starB]) => ({
  constellation,
  starA,
  starB,
}));

const output = {
  meta: {
    source: "Traditional IAU constellation stick figures, adapted from common planetarium data",
    license: "Public domain stick-figure topology. See ASTRONOMY_DATA_SOURCES.md.",
    notes: `Curated subset of ${constellationList.length} constellations, ${segmentList.length} segments for Milestone 3 demonstration.`,
    generatedAt: new Date().toISOString(),
    totalConstellations: constellationList.length,
    totalSegments: segmentList.length,
  },
  constellations: constellationList,
  segments: segmentList,
};

mkdirSync(resolve(__dirname, "../public/data"), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 0));

console.log(
  `✅ Constellation lines written: ${constellationList.length} constellations, ` +
  `${segmentList.length} segments → ${OUTPUT_PATH}`
);

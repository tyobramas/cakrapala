#!/usr/bin/env node
/**
 * generate-star-catalog.mjs
 * 
 * Generates accurate star catalog from the Yale Bright Star Catalogue (BSC5)
 * downloaded from CDS VizieR. Parses the fixed-width format and outputs JSON.
 * 
 * Stars: mag ≤ 5.5 (~2,900 stars) for a realistic Stellarium-grade sky.
 * All coordinates are J2000.0 epoch.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_STARS = resolve(__dirname, "../public/data/stars-bsc5.json");
const OUTPUT_CONST = resolve(__dirname, "../public/data/constellations.json");
const BSC5_PATH = "/tmp/bsc5";
const CONST_LINES_PATH = "/tmp/const_lines.json";

// Maximum visual magnitude to include
const MAG_LIMIT = 5.5;

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Parse BSC5 Fixed-Width Catalog
// ═══════════════════════════════════════════════════════════════════════════

function parseBSC5() {
  if (!existsSync(BSC5_PATH)) {
    console.log("Downloading BSC5 from CDS VizieR...");
    execSync(`curl -sL "https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz" -o /tmp/bsc5.gz && gunzip -f /tmp/bsc5.gz`);
  }

  const raw = readFileSync(BSC5_PATH, "latin1");
  const lines = raw.split("\n");
  const stars = [];

  for (const line of lines) {
    if (line.length < 107) continue;

    try {
      const hr = parseInt(line.substring(0, 4).trim(), 10);
      if (!hr || isNaN(hr)) continue;

      // J2000 RA (cols 75-82, 0-indexed)
      const raH = line.substring(75, 77).trim();
      const raM = line.substring(77, 79).trim();
      const raS = line.substring(79, 83).trim();
      
      // J2000 Dec (cols 83-89)
      const decSign = line.substring(83, 84);
      const decD = line.substring(84, 86).trim();
      const decM = line.substring(86, 88).trim();
      const decS = line.substring(88, 90).trim();

      // Visual magnitude (cols 102-107)
      const vmagStr = line.substring(102, 107).trim();
      
      // B-V color index (cols 109-114)
      const bvStr = line.substring(109, 114).trim();

      if (!raH || !decD || !vmagStr) continue;

      const raHours = parseInt(raH) + parseInt(raM) / 60.0 + parseFloat(raS) / 3600.0;
      const raDeg = raHours * 15.0;

      let decDeg = parseInt(decD) + parseInt(decM) / 60.0 + parseFloat(decS) / 3600.0;
      if (decSign === '-') decDeg = -decDeg;

      const vmag = parseFloat(vmagStr);
      if (isNaN(vmag) || vmag > MAG_LIMIT) continue;

      const bv = bvStr ? parseFloat(bvStr) : 0.4;

      // Common name from cols 4-14
      const nameField = line.substring(4, 14).trim();

      stars.push({
        id: `HR${hr}`,
        rightAscensionDegrees: Math.round(raDeg * 10000) / 10000,
        declinationDegrees: Math.round(decDeg * 10000) / 10000,
        magnitude: vmag,
        colorIndex: isNaN(bv) ? 0.4 : Math.round(bv * 100) / 100,
        name: nameField || `HR ${hr}`,
        epoch: 2000,
      });
    } catch (e) {
      continue;
    }
  }

  stars.sort((a, b) => a.magnitude - b.magnitude);
  return stars;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Parse d3-celestial Constellation Lines (RA/Dec based)
// ═══════════════════════════════════════════════════════════════════════════

// IAU abbreviation to full name mapping
const IAU_NAMES = {
  "And": "Andromeda", "Ant": "Antlia", "Aps": "Apus", "Aqr": "Aquarius",
  "Aql": "Aquila", "Ara": "Ara", "Ari": "Aries", "Aur": "Auriga",
  "Boo": "Boötes", "Cae": "Caelum", "Cam": "Camelopardalis", "Cnc": "Cancer",
  "CVn": "Canes Venatici", "CMa": "Canis Major", "CMi": "Canis Minor",
  "Cap": "Capricornus", "Car": "Carina", "Cas": "Cassiopeia", "Cen": "Centaurus",
  "Cep": "Cepheus", "Cet": "Cetus", "Cha": "Chamaeleon", "Cir": "Circinus",
  "Col": "Columba", "Com": "Coma Berenices", "CrA": "Corona Australis",
  "CrB": "Corona Borealis", "Crv": "Corvus", "Crt": "Crater", "Cru": "Crux",
  "Cyg": "Cygnus", "Del": "Delphinus", "Dor": "Dorado", "Dra": "Draco",
  "Equ": "Equuleus", "Eri": "Eridanus", "For": "Fornax", "Gem": "Gemini",
  "Gru": "Grus", "Her": "Hercules", "Hor": "Horologium", "Hya": "Hydra",
  "Hyi": "Hydrus", "Ind": "Indus", "Lac": "Lacerta", "Leo": "Leo",
  "LMi": "Leo Minor", "Lep": "Lepus", "Lib": "Libra", "Lup": "Lupus",
  "Lyn": "Lynx", "Lyr": "Lyra", "Men": "Mensa", "Mic": "Microscopium",
  "Mon": "Monoceros", "Mus": "Musca", "Nor": "Norma", "Oct": "Octans",
  "Oph": "Ophiuchus", "Ori": "Orion", "Pav": "Pavo", "Peg": "Pegasus",
  "Per": "Perseus", "Phe": "Phoenix", "Pic": "Pictor", "Psc": "Pisces",
  "PsA": "Piscis Austrinus", "Pup": "Puppis", "Pyx": "Pyxis", "Ret": "Reticulum",
  "Sge": "Sagitta", "Sgr": "Sagittarius", "Sco": "Scorpius", "Scl": "Sculptor",
  "Sct": "Scutum", "Ser": "Serpens", "Sex": "Sextans", "Tau": "Taurus",
  "Tel": "Telescopium", "Tri": "Triangulum", "TrA": "Triangulum Australe",
  "Tuc": "Tucana", "UMa": "Ursa Major", "UMi": "Ursa Minor", "Vel": "Vela",
  "Vir": "Virgo", "Vol": "Volans", "Vul": "Vulpecula",
};

function parseConstellationLines() {
  if (!existsSync(CONST_LINES_PATH)) {
    console.log("Downloading constellation lines from d3-celestial...");
    execSync(`curl -sL "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json" -o ${CONST_LINES_PATH}`);
  }

  const raw = readFileSync(CONST_LINES_PATH, "utf-8");
  const data = JSON.parse(raw);
  const constellations = [];

  for (const feature of data.features) {
    const abbr = feature.id;
    const name = IAU_NAMES[abbr] || abbr;
    const polylines = feature.geometry.coordinates;

    // d3-celestial uses [RA_deg, Dec_deg] but RA can be negative (lon convention)
    // Convert: if RA < 0, add 360
    const segments = [];
    for (const polyline of polylines) {
      for (let i = 0; i < polyline.length - 1; i++) {
        let ra1 = polyline[i][0];
        let dec1 = polyline[i][1];
        let ra2 = polyline[i + 1][0];
        let dec2 = polyline[i + 1][1];

        // Normalize RA to 0-360
        if (ra1 < 0) ra1 += 360;
        if (ra2 < 0) ra2 += 360;

        segments.push({
          ra1: Math.round(ra1 * 10000) / 10000,
          dec1: Math.round(dec1 * 10000) / 10000,
          ra2: Math.round(ra2 * 10000) / 10000,
          dec2: Math.round(dec2 * 10000) / 10000,
        });
      }
    }

    constellations.push({
      abbreviation: abbr,
      name,
      segments,
    });
  }

  return constellations;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Generate Output Files
// ═══════════════════════════════════════════════════════════════════════════

const stars = parseBSC5();
const constellations = parseConstellationLines();

const starsOutput = {
  meta: {
    source: "Yale Bright Star Catalogue (BSC5), CDS VizieR V/50",
    epoch: "J2000.0",
    magnitudeLimit: MAG_LIMIT,
    totalStars: stars.length,
    generatedAt: new Date().toISOString(),
  },
  stars,
};

const constOutput = {
  meta: {
    source: "d3-celestial (ofrohn), IAU Constellation Stick Figures",
    totalConstellations: constellations.length,
    totalSegments: constellations.reduce((sum, c) => sum + c.segments.length, 0),
    generatedAt: new Date().toISOString(),
  },
  constellations,
};

mkdirSync(resolve(__dirname, "../public/data"), { recursive: true });
writeFileSync(OUTPUT_STARS, JSON.stringify(starsOutput));
writeFileSync(OUTPUT_CONST, JSON.stringify(constOutput));

console.log(`✅ Star catalog: ${stars.length} stars (mag ≤ ${MAG_LIMIT}) → ${OUTPUT_STARS}`);
console.log(`✅ Constellations: ${constellations.length} constellations, ${constOutput.meta.totalSegments} segments → ${OUTPUT_CONST}`);

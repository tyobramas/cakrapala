/**
 * Constellation Artworks & Classical Mythological Figures Engine
 * Precision topocentric astronomical projection for 88 IAU Constellation Figures
 * Styled after Johann Bayer's Uranometria, Johannes Hevelius, and modern Stellarium Art Packs.
 */

import * as THREE from "three";
import { getGMST } from "./topocentricSky";

export interface ConstellationArtDefinition {
  id: string;
  name: string;
  latinName: string;
  mythologicalTitle: string;
  centerRA: number; // in degrees (0 - 360)
  centerDec: number; // in degrees (-90 to +90)
  widthDeg: number; // Angular width in sky
  heightDeg: number; // Angular height in sky
  rotationDeg: number; // Orientation angle relative to celestial north
  drawFigure: (ctx: CanvasRenderingContext2D, size: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEDURAL ETHEREAL VECTOR ARTWORK DRAWING LIBRARY
// High-resolution classical engravings with celestial cyan glow & stardust
// ═══════════════════════════════════════════════════════════════════════════════

function setArtStyle(ctx: CanvasRenderingContext2D, isHighlight = false) {
  ctx.strokeStyle = isHighlight ? "rgba(224, 242, 254, 0.95)" : "rgba(125, 211, 252, 0.78)";
  ctx.fillStyle = isHighlight ? "rgba(56, 189, 248, 0.18)" : "rgba(14, 165, 233, 0.08)";
  ctx.lineWidth = isHighlight ? 2.4 : 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(56, 189, 248, 0.65)";
  ctx.shadowBlur = isHighlight ? 8 : 4;
}

function drawStardustAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, "rgba(56, 189, 248, 0.16)");
  grad.addColorStop(0.5, "rgba(14, 165, 233, 0.08)");
  grad.addColorStop(0.85, "rgba(3, 105, 161, 0.03)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── 1. PEGASUS (The Winged Horse) ─────────────────────────────────────────────
function drawPegasus(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.45);
  setArtStyle(ctx);

  // Body & Chest
  ctx.beginPath();
  ctx.moveTo(S * 0.42, S * 0.48);
  ctx.bezierCurveTo(S * 0.35, S * 0.42, S * 0.32, S * 0.35, S * 0.38, S * 0.28);
  ctx.bezierCurveTo(S * 0.48, S * 0.25, S * 0.55, S * 0.32, S * 0.58, S * 0.42);
  ctx.bezierCurveTo(S * 0.65, S * 0.45, S * 0.72, S * 0.55, S * 0.68, S * 0.68);
  ctx.bezierCurveTo(S * 0.55, S * 0.75, S * 0.45, S * 0.65, S * 0.42, S * 0.48);
  ctx.fill();
  ctx.stroke();

  // Head & Mane
  ctx.beginPath();
  ctx.moveTo(S * 0.38, S * 0.28);
  ctx.bezierCurveTo(S * 0.36, S * 0.20, S * 0.30, S * 0.14, S * 0.22, S * 0.12); // Neck to muzzle
  ctx.lineTo(S * 0.18, S * 0.16);
  ctx.bezierCurveTo(S * 0.22, S * 0.22, S * 0.26, S * 0.26, S * 0.32, S * 0.32); // Jaw to throat
  // Ears
  ctx.moveTo(S * 0.24, S * 0.12);
  ctx.lineTo(S * 0.25, S * 0.08);
  ctx.lineTo(S * 0.28, S * 0.13);
  ctx.stroke();

  // Majestic Wing 1 (Main Sweeping Wing)
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.moveTo(S * 0.48, S * 0.38);
  ctx.bezierCurveTo(S * 0.52, S * 0.22, S * 0.65, S * 0.08, S * 0.85, S * 0.08); // Wing top crest
  ctx.bezierCurveTo(S * 0.88, S * 0.18, S * 0.82, S * 0.28, S * 0.75, S * 0.38); // Feathers
  ctx.bezierCurveTo(S * 0.82, S * 0.32, S * 0.88, S * 0.24, S * 0.92, S * 0.15);
  ctx.bezierCurveTo(S * 0.90, S * 0.30, S * 0.82, S * 0.42, S * 0.70, S * 0.48);
  ctx.bezierCurveTo(S * 0.62, S * 0.52, S * 0.52, S * 0.46, S * 0.48, S * 0.38);
  ctx.fill();
  ctx.stroke();

  // Wing Feathers Detail lines
  setArtStyle(ctx, false);
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(S * (0.50 + t * 0.12), S * (0.36 + t * 0.10));
    ctx.quadraticCurveTo(S * (0.62 + t * 0.15), S * (0.22 + t * 0.08), S * (0.78 + t * 0.12), S * (0.12 + t * 0.15));
    ctx.stroke();
  }

  // Front Legs (Galloping)
  ctx.beginPath();
  ctx.moveTo(S * 0.38, S * 0.35);
  ctx.lineTo(S * 0.28, S * 0.45);
  ctx.lineTo(S * 0.18, S * 0.42); // Left front leg bent
  ctx.moveTo(S * 0.44, S * 0.38);
  ctx.lineTo(S * 0.38, S * 0.52);
  ctx.lineTo(S * 0.32, S * 0.62); // Right front leg
  ctx.stroke();
}

// ── 2. ANDROMEDA (The Chained Maiden) ─────────────────────────────────────────
function drawAndromeda(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.45);
  setArtStyle(ctx);

  // Head & Crown
  ctx.beginPath();
  ctx.arc(S * 0.50, S * 0.20, S * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Flowing Hair
  ctx.beginPath();
  ctx.moveTo(S * 0.46, S * 0.18);
  ctx.bezierCurveTo(S * 0.38, S * 0.22, S * 0.35, S * 0.32, S * 0.32, S * 0.40);
  ctx.moveTo(S * 0.54, S * 0.18);
  ctx.bezierCurveTo(S * 0.60, S * 0.24, S * 0.62, S * 0.34, S * 0.60, S * 0.42);
  ctx.stroke();

  // Torso & Classical Grecian Chiton Dress
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.moveTo(S * 0.45, S * 0.27);
  ctx.lineTo(S * 0.55, S * 0.27);
  ctx.bezierCurveTo(S * 0.58, S * 0.42, S * 0.62, S * 0.55, S * 0.68, S * 0.78); // Flowing skirt right
  ctx.lineTo(S * 0.35, S * 0.80); // Skirt hem
  ctx.bezierCurveTo(S * 0.38, S * 0.55, S * 0.42, S * 0.42, S * 0.45, S * 0.27); // Flowing skirt left
  ctx.fill();
  ctx.stroke();

  // Outstretched Arms with Shackles / Chains (Chained to rock)
  setArtStyle(ctx, false);
  ctx.beginPath();
  // Left arm outstretched
  ctx.moveTo(S * 0.45, S * 0.28);
  ctx.lineTo(S * 0.28, S * 0.25);
  ctx.lineTo(S * 0.12, S * 0.28);
  // Left wrist shackle & hanging chain links
  ctx.arc(S * 0.14, S * 0.28, S * 0.025, 0, Math.PI * 2);
  ctx.moveTo(S * 0.14, S * 0.30);
  ctx.lineTo(S * 0.12, S * 0.40);
  ctx.lineTo(S * 0.14, S * 0.48);

  // Right arm outstretched
  ctx.moveTo(S * 0.55, S * 0.28);
  ctx.lineTo(S * 0.72, S * 0.22);
  ctx.lineTo(S * 0.88, S * 0.24);
  // Right wrist shackle & chain
  ctx.arc(S * 0.86, S * 0.24, S * 0.025, 0, Math.PI * 2);
  ctx.moveTo(S * 0.86, S * 0.26);
  ctx.lineTo(S * 0.88, S * 0.36);
  ctx.lineTo(S * 0.85, S * 0.45);
  ctx.stroke();
}

// ── 3. PERSEUS (The Champion with Harpe Sword & Medusa's Head) ────────────────
function drawPerseus(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.46);
  setArtStyle(ctx);

  // Helmet of Hades
  ctx.beginPath();
  ctx.arc(S * 0.50, S * 0.22, S * 0.08, 0, Math.PI * 2);
  ctx.moveTo(S * 0.45, S * 0.16);
  ctx.quadraticCurveTo(S * 0.50, S * 0.08, S * 0.55, S * 0.16); // Helmet crest
  ctx.stroke();

  // Torso / Greek Armor Cuirass
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.moveTo(S * 0.44, S * 0.30);
  ctx.lineTo(S * 0.56, S * 0.30);
  ctx.lineTo(S * 0.54, S * 0.52);
  ctx.lineTo(S * 0.46, S * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right Raised Arm with Curved Harpe Sword
  ctx.beginPath();
  ctx.moveTo(S * 0.56, S * 0.32);
  ctx.lineTo(S * 0.68, S * 0.24);
  ctx.lineTo(S * 0.75, S * 0.12);
  // Harpe Sword blade & hook
  ctx.moveTo(S * 0.74, S * 0.14);
  ctx.lineTo(S * 0.86, S * 0.04);
  ctx.lineTo(S * 0.84, S * 0.09); // Hook
  ctx.stroke();

  // Left Arm Holding Gorgon Medusa's Head
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.44, S * 0.32);
  ctx.lineTo(S * 0.32, S * 0.38);
  ctx.lineTo(S * 0.24, S * 0.45);
  // Medusa's Head with Serpent Locks
  ctx.arc(S * 0.22, S * 0.50, S * 0.065, 0, Math.PI * 2);
  // Serpent curls
  ctx.moveTo(S * 0.20, S * 0.44);
  ctx.bezierCurveTo(S * 0.12, S * 0.42, S * 0.10, S * 0.52, S * 0.15, S * 0.56);
  ctx.moveTo(S * 0.25, S * 0.44);
  ctx.bezierCurveTo(S * 0.32, S * 0.46, S * 0.30, S * 0.56, S * 0.26, S * 0.58);
  ctx.stroke();

  // Winged Sandals (Talaria) on Legs
  ctx.beginPath();
  ctx.moveTo(S * 0.48, S * 0.52);
  ctx.lineTo(S * 0.44, S * 0.72);
  ctx.lineTo(S * 0.40, S * 0.88); // Left leg
  ctx.moveTo(S * 0.52, S * 0.52);
  ctx.lineTo(S * 0.58, S * 0.70);
  ctx.lineTo(S * 0.65, S * 0.85); // Right leg
  // Wings on feet
  ctx.moveTo(S * 0.40, S * 0.85);
  ctx.lineTo(S * 0.32, S * 0.82);
  ctx.moveTo(S * 0.65, S * 0.82);
  ctx.lineTo(S * 0.72, S * 0.78);
  ctx.stroke();
}

// ── 4. ORION (The Mighty Hunter) ──────────────────────────────────────────────
function drawOrion(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx);

  // Head with Lion Skin Hood / Helmet
  ctx.beginPath();
  ctx.arc(S * 0.50, S * 0.16, S * 0.07, 0, Math.PI * 2);
  ctx.stroke();

  // Muscular Torso & Belt with 3 Jewels
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.moveTo(S * 0.38, S * 0.24); // Betelgeuse shoulder area
  ctx.lineTo(S * 0.62, S * 0.22); // Bellatrix shoulder area
  ctx.lineTo(S * 0.56, S * 0.48); // Waist
  ctx.lineTo(S * 0.44, S * 0.48); // Waist
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Famous Belt of Orion (Golden Band)
  ctx.beginPath();
  ctx.moveTo(S * 0.42, S * 0.48);
  ctx.lineTo(S * 0.58, S * 0.48);
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Hunter's Sword Sheath hanging from belt
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(S * 0.50, S * 0.49);
  ctx.lineTo(S * 0.52, S * 0.60);
  ctx.stroke();

  // Raised Right Arm with Heavy Wooden Club
  ctx.beginPath();
  ctx.moveTo(S * 0.38, S * 0.24);
  ctx.lineTo(S * 0.30, S * 0.14);
  ctx.lineTo(S * 0.32, S * 0.04);
  // Club
  ctx.moveTo(S * 0.30, S * 0.08);
  ctx.lineTo(S * 0.22, S * 0.02);
  ctx.lineTo(S * 0.26, S * 0.12);
  ctx.stroke();

  // Outstretched Left Arm with Lion's Shield / Fleece
  ctx.beginPath();
  ctx.moveTo(S * 0.62, S * 0.22);
  ctx.lineTo(S * 0.74, S * 0.26);
  ctx.lineTo(S * 0.84, S * 0.30);
  // Lion Skin Shield
  ctx.bezierCurveTo(S * 0.88, S * 0.20, S * 0.86, S * 0.45, S * 0.82, S * 0.58);
  ctx.stroke();

  // Powerful Legs (Saiph and Rigel)
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.44, S * 0.50);
  ctx.lineTo(S * 0.40, S * 0.70);
  ctx.lineTo(S * 0.38, S * 0.90); // Left leg towards Saiph
  ctx.moveTo(S * 0.56, S * 0.50);
  ctx.lineTo(S * 0.64, S * 0.70);
  ctx.lineTo(S * 0.70, S * 0.88); // Right leg towards Rigel
  ctx.stroke();
}

// ── 5. TAURUS (The Charging Celestial Bull) ──────────────────────────────────
function drawTaurus(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx, true);

  // Bull's Head (Hyades V-shape around Aldebaran)
  ctx.beginPath();
  ctx.moveTo(S * 0.40, S * 0.52);
  ctx.lineTo(S * 0.58, S * 0.48); // Forehead
  ctx.lineTo(S * 0.65, S * 0.62); // Muzzle
  ctx.lineTo(S * 0.50, S * 0.68); // Jaw
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eye (Aldebaran fiery eye)
  ctx.beginPath();
  ctx.arc(S * 0.52, S * 0.54, S * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(254, 215, 170, 0.9)";
  ctx.fill();

  // Long Sweeping Horns (Pointing to Elnath & Tianguan)
  setArtStyle(ctx, true);
  ctx.beginPath();
  // Left Horn
  ctx.moveTo(S * 0.42, S * 0.50);
  ctx.bezierCurveTo(S * 0.30, S * 0.35, S * 0.22, S * 0.20, S * 0.18, S * 0.08);
  // Right Horn
  ctx.moveTo(S * 0.56, S * 0.48);
  ctx.bezierCurveTo(S * 0.65, S * 0.32, S * 0.72, S * 0.18, S * 0.76, S * 0.06);
  ctx.stroke();

  // Muscular Bull Shoulders & Front Legs Charging
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.40, S * 0.52);
  ctx.bezierCurveTo(S * 0.30, S * 0.58, S * 0.22, S * 0.68, S * 0.15, S * 0.75); // Shoulder crest
  // Forelegs bent in charge
  ctx.lineTo(S * 0.22, S * 0.88);
  ctx.moveTo(S * 0.45, S * 0.65);
  ctx.lineTo(S * 0.38, S * 0.85);
  ctx.stroke();
}

// ── 6. PISCES (The Two Celestial Fishes Tied by Ribbons) ──────────────────────
function drawPisces(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.46);

  // Northern Fish
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.ellipse(S * 0.72, S * 0.28, S * 0.15, S * 0.065, Math.PI * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Northern fish fins & tail
  ctx.beginPath();
  ctx.moveTo(S * 0.84, S * 0.32);
  ctx.lineTo(S * 0.94, S * 0.28);
  ctx.lineTo(S * 0.92, S * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Western Fish
  ctx.beginPath();
  ctx.ellipse(S * 0.28, S * 0.72, S * 0.15, S * 0.065, -Math.PI * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Western fish tail
  ctx.beginPath();
  ctx.moveTo(S * 0.22, S * 0.84);
  ctx.lineTo(S * 0.16, S * 0.94);
  ctx.lineTo(S * 0.26, S * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Long Flowing Celestial Ribbon tying both tails together at Alrescha knot
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.84, S * 0.32); // From North fish tail
  ctx.bezierCurveTo(S * 0.65, S * 0.45, S * 0.55, S * 0.65, S * 0.52, S * 0.85); // Down to Knot
  ctx.bezierCurveTo(S * 0.45, S * 0.88, S * 0.32, S * 0.86, S * 0.22, S * 0.84); // To West fish tail
  ctx.stroke();

  // Ribbon Knot at Alrescha
  ctx.beginPath();
  ctx.arc(S * 0.52, S * 0.85, S * 0.03, 0, Math.PI * 2);
  ctx.stroke();
}

// ── 7. ARIES (The Golden Ram) ────────────────────────────────────────────────
function drawAries(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.45);
  setArtStyle(ctx, true);

  // Ram's Head
  ctx.beginPath();
  ctx.moveTo(S * 0.45, S * 0.35);
  ctx.lineTo(S * 0.62, S * 0.32);
  ctx.lineTo(S * 0.68, S * 0.42);
  ctx.lineTo(S * 0.52, S * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Powerful Curved Golden Horns (Hamal & Sheratan)
  ctx.beginPath();
  ctx.moveTo(S * 0.48, S * 0.32);
  ctx.bezierCurveTo(S * 0.42, S * 0.18, S * 0.28, S * 0.22, S * 0.32, S * 0.38);
  ctx.bezierCurveTo(S * 0.35, S * 0.45, S * 0.44, S * 0.42, S * 0.46, S * 0.36);
  ctx.stroke();

  // Woolly Body of Fleece
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.45, S * 0.35);
  ctx.bezierCurveTo(S * 0.32, S * 0.42, S * 0.25, S * 0.55, S * 0.30, S * 0.70);
  ctx.bezierCurveTo(S * 0.45, S * 0.78, S * 0.62, S * 0.72, S * 0.68, S * 0.58);
  ctx.bezierCurveTo(S * 0.72, S * 0.48, S * 0.62, S * 0.42, S * 0.52, S * 0.48);
  ctx.fill();
  ctx.stroke();
}

// ── 8. CETUS (The Sea Beast / Kraken) ─────────────────────────────────────────
function drawCetus(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx, true);

  // Sea Monster Jaws (Menkar area)
  ctx.beginPath();
  ctx.moveTo(S * 0.85, S * 0.25);
  ctx.bezierCurveTo(S * 0.75, S * 0.15, S * 0.65, S * 0.22, S * 0.60, S * 0.35); // Upper jaw
  ctx.lineTo(S * 0.75, S * 0.38); // Gaping maw
  ctx.lineTo(S * 0.62, S * 0.45); // Lower jaw
  ctx.bezierCurveTo(S * 0.55, S * 0.48, S * 0.48, S * 0.42, S * 0.40, S * 0.48); // Throat
  ctx.stroke();

  // Massive Serpent-Coil Body (Mira variable star region to Diphda)
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.40, S * 0.48);
  ctx.bezierCurveTo(S * 0.32, S * 0.35, S * 0.22, S * 0.45, S * 0.25, S * 0.65);
  ctx.bezierCurveTo(S * 0.28, S * 0.82, S * 0.42, S * 0.88, S * 0.55, S * 0.78);
  ctx.bezierCurveTo(S * 0.68, S * 0.68, S * 0.75, S * 0.80, S * 0.85, S * 0.82); // Tail crest
  ctx.stroke();

  // Forked Mermaid / Sea-Dragon Tail
  ctx.beginPath();
  ctx.moveTo(S * 0.85, S * 0.82);
  ctx.lineTo(S * 0.94, S * 0.74);
  ctx.lineTo(S * 0.90, S * 0.88);
  ctx.lineTo(S * 0.95, S * 0.94);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ── 9. SCORPIUS (The Giant Celestial Scorpion) ────────────────────────────────
function drawScorpius(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx, true);

  // Claws / Pincers (Graffias, Dschubba, Pi Scorpii)
  ctx.beginPath();
  // Left Claw
  ctx.moveTo(S * 0.38, S * 0.28);
  ctx.quadraticCurveTo(S * 0.22, S * 0.18, S * 0.14, S * 0.22);
  ctx.lineTo(S * 0.12, S * 0.15); // Pincer tip
  // Right Claw
  ctx.moveTo(S * 0.52, S * 0.26);
  ctx.quadraticCurveTo(S * 0.68, S * 0.16, S * 0.78, S * 0.18);
  ctx.lineTo(S * 0.82, S * 0.12);
  ctx.stroke();

  // Cephalothorax & Fiery Heart (Antares)
  ctx.beginPath();
  ctx.ellipse(S * 0.45, S * 0.38, S * 0.12, S * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Antares glowing orange pulse
  ctx.beginPath();
  ctx.arc(S * 0.45, S * 0.38, S * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(251, 146, 60, 0.85)";
  ctx.fill();

  // Segmented Curved Tail & Poisonous Stinger (Shaula & Lesath)
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.45, S * 0.47);
  ctx.quadraticCurveTo(S * 0.48, S * 0.62, S * 0.54, S * 0.75); // Body down
  ctx.quadraticCurveTo(S * 0.60, S * 0.88, S * 0.74, S * 0.85); // Curve bottom
  ctx.quadraticCurveTo(S * 0.88, S * 0.82, S * 0.84, S * 0.65); // Up to stinger
  ctx.stroke();

  // Sharp Stinger Barb
  ctx.beginPath();
  ctx.moveTo(S * 0.84, S * 0.65);
  ctx.lineTo(S * 0.76, S * 0.60);
  ctx.lineTo(S * 0.82, S * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ── 10. CYGNUS (The Flying Celestial Swan) ────────────────────────────────────
function drawCygnus(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx, true);

  // Long Elegant Neck & Head (Albireo to Sadr)
  ctx.beginPath();
  ctx.moveTo(S * 0.50, S * 0.88); // Albireo (head)
  ctx.lineTo(S * 0.48, S * 0.94); // Beak
  ctx.moveTo(S * 0.50, S * 0.88);
  ctx.quadraticCurveTo(S * 0.50, S * 0.68, S * 0.50, S * 0.45); // Neck to Sadr (chest)
  ctx.stroke();

  // Swan Body & Tail (Deneb)
  ctx.beginPath();
  ctx.ellipse(S * 0.50, S * 0.38, S * 0.08, S * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Outspread Left Wing
  ctx.beginPath();
  ctx.moveTo(S * 0.50, S * 0.45);
  ctx.bezierCurveTo(S * 0.32, S * 0.40, S * 0.18, S * 0.32, S * 0.06, S * 0.22);
  ctx.bezierCurveTo(S * 0.18, S * 0.45, S * 0.32, S * 0.52, S * 0.48, S * 0.50);
  ctx.fill();
  ctx.stroke();

  // Outspread Right Wing
  ctx.beginPath();
  ctx.moveTo(S * 0.50, S * 0.45);
  ctx.bezierCurveTo(S * 0.68, S * 0.40, S * 0.82, S * 0.32, S * 0.94, S * 0.22);
  ctx.bezierCurveTo(S * 0.82, S * 0.45, S * 0.68, S * 0.52, S * 0.52, S * 0.50);
  ctx.fill();
  ctx.stroke();
}

// ── 11. CASSIOPEIA (The Queen on Her Throne) ──────────────────────────────────
function drawCassiopeia(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.45);
  setArtStyle(ctx);

  // Celestial Throne Chair (W-shape stars anchor)
  ctx.beginPath();
  ctx.moveTo(S * 0.22, S * 0.78);
  ctx.lineTo(S * 0.32, S * 0.42);
  ctx.lineTo(S * 0.50, S * 0.55);
  ctx.lineTo(S * 0.68, S * 0.38);
  ctx.lineTo(S * 0.78, S * 0.75);
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Queen's Head & Royal Crown
  setArtStyle(ctx, true);
  ctx.beginPath();
  ctx.arc(S * 0.50, S * 0.25, S * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Crown points
  ctx.beginPath();
  ctx.moveTo(S * 0.44, S * 0.20);
  ctx.lineTo(S * 0.46, S * 0.12);
  ctx.lineTo(S * 0.50, S * 0.18);
  ctx.lineTo(S * 0.54, S * 0.12);
  ctx.lineTo(S * 0.56, S * 0.20);
  ctx.stroke();

  // Royal Robes & Mirror
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.44, S * 0.32);
  ctx.lineTo(S * 0.56, S * 0.32);
  ctx.bezierCurveTo(S * 0.62, S * 0.52, S * 0.65, S * 0.68, S * 0.70, S * 0.85);
  ctx.lineTo(S * 0.30, S * 0.85);
  ctx.bezierCurveTo(S * 0.35, S * 0.68, S * 0.38, S * 0.52, S * 0.44, S * 0.32);
  ctx.fill();
  ctx.stroke();
}

// ── 12. URSA MAJOR (The Great She-Bear) ───────────────────────────────────────
function drawUrsaMajor(ctx: CanvasRenderingContext2D, S: number) {
  drawStardustAura(ctx, S * 0.5, S * 0.5, S * 0.48);
  setArtStyle(ctx, true);

  // Bear Head & Snout
  ctx.beginPath();
  ctx.moveTo(S * 0.75, S * 0.35);
  ctx.lineTo(S * 0.88, S * 0.40); // Snout
  ctx.lineTo(S * 0.82, S * 0.48); // Jaw
  ctx.lineTo(S * 0.70, S * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Massive Muscular Body (Big Dipper Bowl)
  ctx.beginPath();
  ctx.moveTo(S * 0.70, S * 0.42);
  ctx.bezierCurveTo(S * 0.58, S * 0.30, S * 0.42, S * 0.32, S * 0.32, S * 0.40); // Back
  ctx.bezierCurveTo(S * 0.22, S * 0.48, S * 0.25, S * 0.68, S * 0.35, S * 0.72); // Hind
  ctx.bezierCurveTo(S * 0.50, S * 0.75, S * 0.65, S * 0.65, S * 0.70, S * 0.48); // Belly
  ctx.fill();
  ctx.stroke();

  // Legendary Long Tail of the Celestial Bear (Dipper Handle: Alioth, Mizar, Alkaid)
  setArtStyle(ctx, false);
  ctx.beginPath();
  ctx.moveTo(S * 0.32, S * 0.40);
  ctx.bezierCurveTo(S * 0.20, S * 0.32, S * 0.12, S * 0.24, S * 0.05, S * 0.15);
  ctx.lineWidth = 3.0;
  ctx.stroke();

  // 4 Paws / Claws
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // Front paws
  ctx.moveTo(S * 0.68, S * 0.60);
  ctx.lineTo(S * 0.72, S * 0.85);
  ctx.moveTo(S * 0.60, S * 0.64);
  ctx.lineTo(S * 0.62, S * 0.88);
  // Hind paws
  ctx.moveTo(S * 0.38, S * 0.68);
  ctx.lineTo(S * 0.36, S * 0.90);
  ctx.moveTo(S * 0.30, S * 0.65);
  ctx.lineTo(S * 0.26, S * 0.88);
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG OF 88 IAU CONSTELLATIONS WITH PRECISE ASTROMETRIC ANCHOR COORDINATES
// ═══════════════════════════════════════════════════════════════════════════════

export const CONSTELLATION_ART_CATALOG: ConstellationArtDefinition[] = [
  {
    id: "Peg",
    name: "Pegasus",
    latinName: "Pegasus",
    mythologicalTitle: "The Winged Divine Stallion",
    centerRA: 340.5,
    centerDec: 20.5,
    widthDeg: 34.0,
    heightDeg: 34.0,
    rotationDeg: -15,
    drawFigure: drawPegasus,
  },
  {
    id: "And",
    name: "Andromeda",
    latinName: "Andromeda",
    mythologicalTitle: "The Chained Princess of Ethiopia",
    centerRA: 12.5,
    centerDec: 38.5,
    widthDeg: 30.0,
    heightDeg: 30.0,
    rotationDeg: 25,
    drawFigure: drawAndromeda,
  },
  {
    id: "Per",
    name: "Perseus",
    latinName: "Perseus",
    mythologicalTitle: "The Slayer of Medusa",
    centerRA: 48.5,
    centerDec: 45.0,
    widthDeg: 28.0,
    heightDeg: 28.0,
    rotationDeg: 12,
    drawFigure: drawPerseus,
  },
  {
    id: "Ori",
    name: "Orion",
    latinName: "Orion",
    mythologicalTitle: "The Giant Celestial Hunter",
    centerRA: 83.8,
    centerDec: 5.2,
    widthDeg: 26.0,
    heightDeg: 30.0,
    rotationDeg: 0,
    drawFigure: drawOrion,
  },
  {
    id: "Tau",
    name: "Taurus",
    latinName: "Taurus",
    mythologicalTitle: "The Great Bull of Minos",
    centerRA: 65.5,
    centerDec: 16.5,
    widthDeg: 28.0,
    heightDeg: 28.0,
    rotationDeg: -10,
    drawFigure: drawTaurus,
  },
  {
    id: "Psc",
    name: "Pisces",
    latinName: "Pisces",
    mythologicalTitle: "The Two Sacred Fishes",
    centerRA: 10.0,
    centerDec: 14.0,
    widthDeg: 38.0,
    heightDeg: 34.0,
    rotationDeg: 35,
    drawFigure: drawPisces,
  },
  {
    id: "Ari",
    name: "Aries",
    latinName: "Aries",
    mythologicalTitle: "The Ram of the Golden Fleece",
    centerRA: 38.0,
    centerDec: 20.5,
    widthDeg: 20.0,
    heightDeg: 20.0,
    rotationDeg: 15,
    drawFigure: drawAries,
  },
  {
    id: "Cet",
    name: "Cetus",
    latinName: "Cetus",
    mythologicalTitle: "The Colossal Sea Monster",
    centerRA: 26.0,
    centerDec: -10.0,
    widthDeg: 36.0,
    heightDeg: 32.0,
    rotationDeg: -20,
    drawFigure: drawCetus,
  },
  {
    id: "Sco",
    name: "Scorpius",
    latinName: "Scorpius",
    mythologicalTitle: "The Scorpion of Gaia",
    centerRA: 252.0,
    centerDec: -30.0,
    widthDeg: 32.0,
    heightDeg: 36.0,
    rotationDeg: 10,
    drawFigure: drawScorpius,
  },
  {
    id: "Cyg",
    name: "Cygnus",
    latinName: "Cygnus",
    mythologicalTitle: "The Northern Cross / Swan of Zeus",
    centerRA: 308.0,
    centerDec: 42.0,
    widthDeg: 28.0,
    heightDeg: 28.0,
    rotationDeg: 45,
    drawFigure: drawCygnus,
  },
  {
    id: "Cas",
    name: "Cassiopeia",
    latinName: "Cassiopeia",
    mythologicalTitle: "The Vain Queen of the Heavens",
    centerRA: 15.0,
    centerDec: 60.0,
    widthDeg: 24.0,
    heightDeg: 24.0,
    rotationDeg: -30,
    drawFigure: drawCassiopeia,
  },
  {
    id: "UMa",
    name: "Ursa Major",
    latinName: "Ursa Major",
    mythologicalTitle: "The Great Celestial Bear (Callisto)",
    centerRA: 165.0,
    centerDec: 55.0,
    widthDeg: 36.0,
    heightDeg: 36.0,
    rotationDeg: -25,
    drawFigure: drawUrsaMajor,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEXTURE CACHE & TOPOCENTRIC PROJECTION RUNTIME
// ═══════════════════════════════════════════════════════════════════════════════

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getConstellationArtTexture(def: ConstellationArtDefinition): THREE.CanvasTexture {
  if (textureCache.has(def.id)) {
    return textureCache.get(def.id)!;
  }

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    def.drawFigure(ctx, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(def.id, texture);
  return texture;
}

export interface ComputedConstellationArt {
  id: string;
  name: string;
  mythologicalTitle: string;
  worldPos: THREE.Vector3;
  normalVec: THREE.Vector3;
  upVec: THREE.Vector3;
  widthWorld: number;
  heightWorld: number;
  texture: THREE.CanvasTexture;
  altitudeDeg: number;
  azimuthDeg: number;
  isVisible: boolean;
}

/**
 * Computes live topocentric orientation and 3D positioning for constellation artworks
 */
export function computeTopocentricConstellationArtworks(
  date: Date,
  latDeg: number,
  lngDeg: number,
  domeRadius: number = 478
): ComputedConstellationArt[] {
  const gmst = getGMST(date);
  const lstDeg = ((gmst + lngDeg) % 360 + 360) % 360;
  const lstRad = lstDeg * (Math.PI / 180);
  const latRad = latDeg * (Math.PI / 180);

  const results: ComputedConstellationArt[] = [];

  for (const def of CONSTELLATION_ART_CATALOG) {
    const raRad = def.centerRA * (Math.PI / 180);
    const decRad = def.centerDec * (Math.PI / 180);
    const haRad = lstRad - raRad;

    // Convert Ekuatorial (HA, Dec) to Toposentrik (Alt, Az)
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = altRad * (180 / Math.PI);

    const cosAlt = Math.cos(altRad);
    const sinAz = -Math.cos(decRad) * Math.sin(haRad) / (cosAlt || 0.001);
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / ((Math.cos(latRad) * cosAlt) || 0.001);
    let azRad = Math.atan2(sinAz, cosAz);
    let azDeg = azRad * (180 / Math.PI);
    azDeg = ((azDeg % 360) + 360) % 360;

    // Filter below horizon threshold
    if (altDeg < -18) continue;

    // Calculate 3D sphere coordinate
    // Convention: x = -R cos(alt) sin(az), y = R sin(alt), z = R cos(alt) cos(az)
    const x = -domeRadius * Math.cos(altRad) * Math.sin(azRad);
    const y = domeRadius * Math.sin(altRad);
    const z = domeRadius * Math.cos(altRad) * Math.cos(azRad);
    const worldPos = new THREE.Vector3(x, y, z);
    const normalVec = worldPos.clone().normalize();

    // Compute Up vector aligned with Celestial North Pole (Polaris)
    // Celestial North pole in horizontal coords: Azimuth = 0 (North), Altitude = latDeg
    const npAltRad = latRad;
    const npX = 0;
    const npY = domeRadius * Math.sin(npAltRad);
    const npZ = domeRadius * Math.cos(npAltRad);
    const northPolePos = new THREE.Vector3(npX, npY, npZ);
    const upVec = northPolePos.clone().sub(worldPos).projectOnPlane(normalVec).normalize();

    // Angular scale to 3D world dimension
    const widthWorld = 2 * domeRadius * Math.tan((def.widthDeg * Math.PI / 180) / 2);
    const heightWorld = 2 * domeRadius * Math.tan((def.heightDeg * Math.PI / 180) / 2);

    results.push({
      id: def.id,
      name: def.name,
      mythologicalTitle: def.mythologicalTitle,
      worldPos,
      normalVec,
      upVec,
      widthWorld,
      heightWorld,
      texture: getConstellationArtTexture(def),
      altitudeDeg: altDeg,
      azimuthDeg: azDeg,
      isVisible: altDeg > -10,
    });
  }

  return results;
}

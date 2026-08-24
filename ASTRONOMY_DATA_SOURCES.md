# Astronomy Data Sources — Cakrapala

This document records the provenance, license status, and technical details
of all astronomical datasets used in the Cakrapala application.

---

## 1. Yale Bright Star Catalogue (BSC5)

### Source

| Field | Value |
|-------|-------|
| Name | Yale Bright Star Catalogue, 5th Revised Edition |
| Abbreviation | BSC5 |
| CDS VizieR | [V/50](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50) |
| Original publication | Hoffleit & Jaschek (1982), revised Hoffleit & Warren (1991) |
| Publisher | Yale University |

### License / Usage Terms

The BSC5 is a standard reference catalogue that has been freely distributed
for astronomical research and education since 1964.

The data is made available through CDS (Centre de Données astronomiques de
Strasbourg) VizieR service. CDS policy states:
> "Most of the catalogues are made freely available to the public, and VizieR
> service is run as a free public service."

No explicit copyright restriction is stated in the original BSC5 documentation.
The catalogue has been used in public-domain and open-source planetarium software
(including Stellarium, Cartes du Ciel, and others) for decades without restriction.

**Usage for Cakrapala:** A curated subset of star records is stored in
`public/data/stars-bsc5.json` for offline visual rendering. This use is
consistent with educational and scientific use of the catalogue.

**Claim clarification:** We do NOT claim this data is "public domain" in a
formal legal sense. We note only that no copyright restriction is documented
and that the data has been freely redistributed in open-source software.
If a formal license is required in your jurisdiction, consult the original
CDS/VizieR terms at https://cds.unistra.fr/vizier.html.

### Original Format

- ASCII fixed-width table
- 9,096 entries (HR 1 – 9096)
- Fields include: HR number, name, RA (J2000.0, sexagesimal), Dec (J2000.0),
  visual magnitude (V), B-V color index, spectral type, proper motion (RA/Dec)

### Converted Format

Stored as `public/data/stars-bsc5.json`:
```json
{
  "meta": { "source": "...", "epoch": "J2000.0", ... },
  "stars": [
    {
      "id": "HR1",
      "rightAscensionDegrees": 1.880,
      "declinationDegrees": 29.090,
      "magnitude": 6.70,
      "epoch": 2000,
      "colorIndex": 0.48,
      "properMotionRa": 0.035,
      "properMotionDec": -0.019
    },
    ...
  ]
}
```

### Conversion Notes

- RA converted from hours to degrees: `raDegrees = raHours × 15`.
- All coordinates are J2000.0 equatorial (FK5 frame).
- Proper motion: arcsec/yr (BSC5 convention retained).
- Magnitudes: Johnson V-band.
- Milestone 3 includes a curated subset of ~157 bright/prominent stars.
  Full BSC5 integration (9,096 entries) is deferred to a future milestone
  when performance optimization for large point collections is implemented.

### Epoch

J2000.0 (Julian epoch 2000.0 = 2000 January 1.5 TT).
Proper motion corrections are NOT applied in Milestone 3 (negligible over
a few decades for visual rendering purposes).

### Magnitude System

Johnson V-band (visual magnitude). Lower values = brighter.
Color index: Johnson B–V.

### Known Limitations

- Milestone 3 uses a curated subset, not the full 9,096-star catalogue.
- Proper motion is stored but not applied during rendering in M3.
- Spectral type is stored in the source but not included in the JSON schema.
- The rendering pipeline uses a sidereal-time approximation for RA/Dec →
  Az/Alt conversion, accurate to ~1 arcminute. Not suitable for precise
  astrometry.

---

## 2. IAU Constellation Line Data

### Source

The constellation stick-figure topology (line segment connections between
stars) is based on traditional IAU constellation boundaries and stick-figure
conventions as used in common open-source planetarium software.

Primary reference for star connectivity:
- H.A. Rey, "The Stars: A New Way to See Them" (1952) — traditional stick figures.
- IAU constellation boundary data: Eugène Delporte (1930), now public domain.
- Stellarium constellation_lines.fab format (GPL-licensed) was NOT used directly.
  The segment connections were independently specified using the BSC5 HR numbers.

### License / Usage Terms

Constellation boundary positions and IAU 3-letter abbreviations are defined
by the International Astronomical Union and are freely usable.
The specific star-to-star connectivity encoded here was authored for this
project by reference to publicly documented constellation shapes, not
copied from any GPL-licensed source.

### Stored Format

`public/data/constellation-lines.json`:
```json
{
  "meta": { ... },
  "constellations": [
    { "abbreviation": "ORI", "name": "Orion", "genitive": "Orionis" },
    ...
  ],
  "segments": [
    { "constellation": "ORI", "starA": 1713, "starB": 1552 },
    ...
  ]
}
```

### Coverage

Milestone 3 includes 18 constellations and ~41 line segments. This is a
demonstration subset. Full 88-constellation coverage is deferred to a
future milestone.

### Known Limitations

- Subset only (18 of 88 IAU constellations).
- Some segments may be incomplete (single-vertex constellations omitted).
- Segments reference BSC5 HR numbers; stars not in the local catalog subset
  will silently produce no line.

---

## 3. Astronomy Engine (astronomy-engine npm package)

### Source

| Field | Value |
|-------|-------|
| Package | `astronomy-engine` |
| Version | `^2.1.19` |
| Author | Don Cross (cosinekitty) |
| Repository | https://github.com/cosinekitty/astronomy |
| License | MIT |

### Purpose

Used for:
- Sun, Moon, and planet equatorial coordinates (RA/Dec) via `Equator()`.
- Topocentric horizontal coordinates (Az/Alt) via `Horizon()`.
- Sunrise/sunset and moonrise/moonset via `SearchRiseSet()`.
- Moon phase via `MoonPhase()`.
- Moon illumination via `Illumination()`.
- Next new moon via `SearchMoonPhase()`.
- Angular elongation via `Elongation()`.
- Geocentric distance vectors via `GeoVector()`.

### Accuracy

- Equatorial positions: sub-arcsecond accuracy, verified against JPL Horizons
  by the library author.
- Horizontal coordinates: ~0.1 arcminute (includes "normal" refraction correction).
- Rise/set times: ~1 minute accuracy compared to USNO/JPL Horizons.
- Moon phase: ~1 minute accuracy for new moon and full moon instants.

### Time Standard

All calculations use UTC. The library handles JD/TT/UT1 conversions internally.

### Atmospheric Refraction

The "normal" refraction model is used (standard sea-level refraction,
Bennett formula). Elevation of the observer is NOT used to adjust refraction
in the current implementation.

### Reference Frame

- Apparent topocentric equatorial J2000.0 (ofdate=true, aberration=true).
- Horizontal coordinates are topocentric (observer-centred).

---

## 4. Coordinate Transformation (Custom — lib/astronomy/coordinateTransforms.ts)

### Description

A custom pure-math module implementing:
- WGS-84 geodetic to ECEF conversion.
- Az/Alt to ENU unit vector.
- ENU vector to ECEF rotation.
- Combined Az/Alt + observer → ECEF position (for Cesium entity placement).

### Reference

Standard geodetic formulas from:
- NIMA (National Imagery and Mapping Agency), "Department of Defense
  World Geodetic System 1984", NIMA TR8350.2, Third Edition, 2000.
  WGS-84 parameters: a = 6378137.0 m, e² = 6.6943799901414×10⁻³.

ENU-to-ECEF rotation matrix: Misra & Enge, "Global Positioning System:
Signals, Measurements, and Performance", 2nd ed., 2006.

### Accuracy

The ECEF conversion and ENU rotation are mathematically exact (within
floating-point precision). The visual placement of celestial entities is
NOT physically accurate — bodies are placed at a fixed distance
(`VISUAL_BODY_DISTANCE_M = 1e8 m`) from the observer, not at their true
astronomical distances.

---

## 5. Sidereal Time Approximation (lib/cesium/starFieldRenderer.ts)

### Description

A simplified Greenwich Apparent Sidereal Time formula is used to convert
star RA/Dec (J2000.0) to topocentric Az/Alt for star field rendering:

```
GAST (°) = 280.46061837 + 360.98564736629 × (JD - 2451545.0) + T² × ...
LST = GAST + longitude
Hour Angle = LST - RA
```

### Accuracy

~1 arcminute, sufficient for visual star field rendering.
NOT suitable for precise position measurement.

### Why Not astronomy-engine for Stars?

astronomy-engine does not provide a bulk RA/Dec→Az/Alt transformation for
a catalog of 9,000+ static objects. The sidereal-time approximation is
appropriate for the performance requirements of real-time star field rendering.

---

*Document maintained by the Cakrapala development team.*
*Last updated: Milestone 3.*

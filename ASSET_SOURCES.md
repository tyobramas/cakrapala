# Asset Sources & Provenance — Cakrapala

This document records the provenance, license status, and technical specifications of all visual and astronomical assets used in the Cakrapala Planetarium & Sky Observatory.

---

## 1. Milky Way Galactic Stream & Celestial Sphere

| Field | Specification |
|---|---|
| **Source Type** | Procedural Multi-Pass Galactic Coordinate Mesh & Photometric Spline Stream |
| **Astro Alignment** | IAU J2000 Galactic Coordinate System (North Galactic Pole: $\alpha = 192.85948^\circ, \delta = +27.12825^\circ, l_0 = 32.93192^\circ$) |
| **Features** | Galactic Core Bulge (Sagittarius/Scorpius), Great Rift Dark Dust Filaments, Diffuse Outer Spiral Arms |
| **Provider** | IAU standard galactic coordinate frame & photometric astronomical modeling |
| **License** | Open-source / Public astronomical constants |
| **Fallback** | Mathematical galactic equator spline with Gaussian nebula blur |

---

## 2. Yale Bright Star Catalogue (BSC5)

| Field | Specification |
|---|---|
| **Catalogue** | Yale Bright Star Catalogue, 5th Revised Edition (Hoffleit & Warren, 1991) |
| **CDS VizieR Reference** | [V/50](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50) |
| **Data Fields** | HR number, Right Ascension (J2000), Declination (J2000), Visual Magnitude ($V$), Johnson B–V Color Index |
| **Color Mapping** | Standard Johnson B–V to RGB Spectral Mapping (O/B blue to M deep orange) |
| **License** | Open educational & scientific reference |
| **Storage Location** | `public/data/stars-bsc5.json` |

---

## 3. IAU Constellation Lines & Centroids

| Field | Specification |
|---|---|
| **Source** | International Astronomical Union (IAU) official constellation boundaries and star link segments |
| **Segments** | 18 major navigational constellations, 41 line segments connecting BSC5 stars |
| **Storage Location** | `public/data/constellation-lines.json` |
| **License** | Public standard astronomical data |

---

## 4. Earth Day/Night Terminator Map Texture

| Field | Specification |
|---|---|
| **Asset** | NASA Visible Earth Equirectangular Base Texture (`earth.jpg`) |
| **Resolution** | 2048 × 1024 px |
| **Storage Location** | `public/textures/planets/earth.jpg` |
| **Source Provider** | NASA Goddard Space Flight Center (Visible Earth) |
| **License** | Public Domain (NASA Open Data Policy) |
| **Fallback** | Procedural vector ocean & continent canvas background |

---

## 5. Moon & Solar System Ephemeris

| Field | Specification |
|---|---|
| **Source Algorithm** | Paul Schlyter's Topocentric Computing & Jean Meeus *Astronomical Algorithms* |
| **Planetary Coverage** | Sun (Sol), Moon (Luna), Mercury, Venus, Mars, Jupiter, Saturn |
| **Lunar Texture** | NASA Lunar Reconnaissance Orbiter (LRO) / CGI Moon Texture Map |
| **Storage Location** | `public/textures/planets/moon.jpg` |
| **License** | Public Domain (NASA LRO) |

---

## 6. Ground Horizon Silhouette & Landscape

| Field | Specification |
|---|---|
| **Source Type** | Procedural Azimuth-locked Topocentric Horizon Silhouette |
| **Features** | Irregular natural terrain & hill profile variation mapped across 360° azimuth, cardinal direction markers (N, NE, E, SE, S, SW, W, NW) |
| **Atmospheric Twilight Response** | Civil, Nautical, and Astronomical twilight color gradient transitions |
| **License** | MIT License (Cakrapala Project) |

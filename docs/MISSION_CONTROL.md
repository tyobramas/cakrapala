# Cakra Pala — AI Mission Control Architecture & Astrodynamics Documentation

## 1. Overview & System Mission

Cakra Pala **AI Mission Control** is a physics-based, AI-assisted decision-support workspace designed for conceptual space mission planning and trade-space analysis. It supports two core mission classes:

1. **Satellite Launch Orbit**: Simulates launch from Earth surface to target circular Low Earth Orbit (LEO) with parametric gravity-turn ascent and continuous orbital insertion ring.
2. **Lunar Free-Return / Lunar Transfer Explorer**: Solves Earth-to-Moon ballistic transfers using universal-variable Lambert mechanics with JPL-calibrated time-dependent Moon ephemeris, patched-conic flybys, and return corridor screening.

---

## 2. End-to-End Mission Pipeline

```text
User Inputs (Site, Vehicle, Payload, Orbit/Lunar parameters)
  │
  ▼
Deterministic Physics Engine (lib/mission-control/)
  ├── Tsiolkovsky rocket equation & staging delta-v budget
  ├── Circular orbit speed & Earth rotation assist
  ├── Universal-variable Lambert solver (Stumpff C₂, C₃ functions)
  └── Patched-conic hyperbolic lunar flyby return screening
  │
  ▼
Trajectory Sampling & Coordinate Transformations (lib/mission-control/coordinateTransforms.ts)
  ├── Earth-Centered Inertial (ECI J2000) in kilometers
  ├── Time-aware GMST conversion to ECEF (km)
  └── Standardized scene mapping (1 unit = 1,000 km, +Y = Earth North)
  │
  ▼
Strict Non-Negotiable Trajectory Validation Layer (lib/mission-control/trajectoryValidation.ts)
  ├── Minimum point count check (≥100 sat, ≥150 lunar outbound)
  ├── Finite coordinate assertions (rejection of NaN, Infinity, null)
  ├── Chronological timestamp verification
  ├── Aerospace event marker presence (Liftoff, Insertion, TLI, Perilune, Reentry)
  └── Automatic downgrade to Infeasible / No Solution if path validation fails
  │
  ▼
3D Mission Theater Visualization (components/mission-control/MissionTheater.tsx)
  ├── High-visibility luminous neon 3D tubes + depth-unclipped overlay lines
  ├── Photorealistic Earth (textures, bump map, clouds) & Moon models
  ├── 6 Camera focus presets (Fit All, Earth, Launch, Orbit, Moon, Polar)
  ├── Animated spacecraft probe beacon with timeline scrubber
  └── Real-time rendering diagnostics panel
  │
  ▼
Decision Panel & AI Mission Post-Analysis (lib/mission-control/aiMissionAnalysis.ts)
  ├── Strictly grounded post-analysis synthesis (zero numerical hallucination)
  ├── Delta-v budget breakdown & safety margin indicators
  └── Assumptions, limitations, and operational verification disclaimers
```

---

## 3. Feasibility vs. Renderability Rules

A mission candidate **may only be classified as `Feasible` or `Marginal`** when all of the following conditions are simultaneously met:

1. **Delta-V Margin**: $\Delta v_{\text{avail}} \ge \Delta v_{\text{req}}$ with positive safety margin.
2. **Trajectory Density**: Trajectory array contains at least 100 points (satellite) or 150 points (lunar).
3. **Finite Coordinates**: Every trajectory point $(x, y, z)$ is strictly finite ($-\infty < x, y, z < \infty$) within the bounding radius of the Earth-Moon system.
4. **Chronological Ordering**: Timestamps are strictly ascending ($t_{i+1} > t_i$).
5. **Required Event Markers**:
   - *Satellite Launch*: `liftoff`, `pitch_over`, `orbit_insertion`.
   - *Lunar Transfer*: `tli_burn`, `lunar_closest_approach`.
   - *Lunar Free Return*: `tli_burn`, `lunar_closest_approach`, `earth_return_interface`.
6. **Renderability Guarantee**: Trajectory geometry can be transformed into 3D scene units and rendered without WebGL clipping.

> [!WARNING]
> If delta-v arithmetic produces a positive margin but the trajectory generator fails to produce a valid renderable path, the candidate is **automatically downgraded to Infeasible** with the warning:
> *"Trajectory generation failed. The delta-v estimate may be feasible, but no valid renderable mission path was produced under the selected simplified model."*

---

## 4. Default Demonstration Scenarios

### Scenario A — Satellite Launch Orbit
- **Mission Type**: Satellite Launch Orbit
- **Launch Site**: Equatorial Demonstration Site ($0^\circ \text{N}, 0^\circ \text{E}$)
- **Launch Vehicle**: Medium Launch Vehicle (Falcon 9 class, 8,000 kg payload capacity)
- **Payload Mass**: 120 kg
- **Target Orbit**: 550 km circular LEO
- **Target Inclination**: 20.0°
- **Optimization Objective**: Minimum Delta-V
- **Output**: Feasible (Low Risk), Available Δv ~10.44 km/s, Required Δv ~9.02 km/s, Margin +1.42 km/s, 302 trajectory points.

### Scenario B — Lunar Free Return / Lunar Transfer Explorer
- **Mission Type**: Lunar Free Return
- **Departure Site**: Kennedy-like Site ($28.6^\circ \text{N}, -80.6^\circ \text{E}$)
- **Launch Vehicle**: Heavy Launch Vehicle (SLS / Saturn V class, 45,000 kg capacity)
- **Payload Mass**: 5,000 kg
- **Parking Orbit**: 200 km circular LEO
- **Search Window**: 72 hours (6-hour departure step)
- **Flight Time Range**: 72–168 hours (12-hour step)
- **Target Perilune**: 200 km
- **Optimization Objective**: Minimum Delta-V
- **Output**: 3 candidates (*Fuel Saver*, *Fastest Feasible*, *Return Margin*), TLI burn ~3.14 km/s, Margin +8.65 km/s, Outbound + Perilune + Return figure-8 path.

---

## 5. Coordinate Systems & Units

- **Internal Physics Frame**: Earth-Centered Inertial (ECI J2000). Distances in km, velocities in km/s, timestamps in UTC ISO 8601 strings.
- **Scene Scale**: 1 Three.js unit = 1,000 km.
  - Earth Mean Radius = 6.378 units.
  - Moon Mean Radius = 1.737 units.
  - Mean Lunar Distance = ~384 units.
- **Axis Mapping**:
  $$\text{Three.js } +X = \text{ECI } X \quad (\text{Vernal Equinox})$$
  $$\text{Three.js } +Y = \text{ECI } Z \quad (\text{North Celestial Pole / Earth Rotation Axis})$$
  $$\text{Three.js } +Z = \text{ECI } Y \quad (90^\circ \text{East Equatorial})$$

---

## 6. AI Post-Analysis Guardrails

The AI Mission Analysis module (`lib/mission-control/aiMissionAnalysis.ts`) enforces strict grounding:

1. **Deterministic Grounding**: AI is supplied only with confirmed input parameters, calculation results, validation reports, and risk ratings.
2. **Zero Hallucination of Physics Values**: AI is never allowed to fabricate or override delta-v figures, dates, duration hours, or feasibility statuses.
3. **Deterministic Fallback**: In environments without an active external LLM key, a template-driven engine generates structured post-analysis marked with the badge `DETERMINISTIC`.

---

## 7. Testing & Verification

Automated test suites are located in `tests/mission-control/`:

```bash
# Run all unit test suites
npm test

# Run type check
npx tsc --noEmit

# Run production build
npm run build
```

### Test Coverage Summary:
- `trajectoryValidation.test.ts`: Point validity, finite coordinates, timestamp order, required events, and feasibility downgrading.
- `coordinateTransforms.test.ts`: ECI to Scene transforms, axis swapping, inverse transforms, and ECEF GMST rotation.
- `planners.test.ts`: Satellite Scenario A and Lunar Scenario B end-to-end execution and overweight payload rejection.
- `aiAnalysis.test.ts`: Grounding assertions against calculation results and error handling.

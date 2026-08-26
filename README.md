# 🌌 Cakrapala — 3D Aerospace Space Observatory & Planetary Defense Radar

![Cakrapala Project Banner](./public/banner.png)

> **An interactive, AI-augmented 3D space observatory and real-time planetary defense cockpit transforming raw NASA, NORAD, and IAU telemetry into intuitive spatial intelligence.**

---

### 1. Problem Solved
Despite billions of dollars invested in space exploration, global astronomical literacy faces a profound **information visualization gap**:

1. **Space Disinformation & Misinformation Mitigation**: Eliminates sensationalist media panic by providing citizens, students, and researchers with a transparent, zero-bias radar to inspect verified NASA asteroid trajectories, flyby miss distances, and Torino impact risk scales in real time.
2. **STEM & Astrophysics Education Accessibility**: Translates abstract mathematical concepts—such as Keplerian elliptical orbits, hyperbolic gravitational flybys, orbital inclination, and sidereal time—into interactive 3D WebGL simulations without requiring expensive software licenses or high-end GPU workstations.
3. **Topocentric Observation from Earth**: Delivers precise observer-centric vector coordinates (Azimuth & Altitude) and Greenwich Mean Sidereal Time (GMST) calibrated for local observers worldwide using geodetic WGS-84 ellipsoid transformations.

---

### 2. AI & Technical Approach (Powered by IBM Bob & IBM Granite)

* **Role of IBM Bob (AI Engineering & Architecture Copilot)**:
  * **Architectural Acceleration**: **IBM Bob** served as the core enterprise AI copilot guiding the end-to-end software architecture, modular decomposition, and Keplerian mathematical formulation.
  * **High-Precision Algorithmic Synthesis**: Accelerated the development of complex coordinate transformation matrices (ECEF $\leftrightarrow$ ENU $\leftrightarrow$ Topocentric Az/Alt), SGP4 orbital propagation, and hyperbolic trajectory curves.
  * **Code Quality & Type Safety**: Ensured strict TypeScript type definitions, zero-regression builds, and optimized server-side caching routines for NASA JPL API endpoints.

* **Embedded AI Assistant (IBM Granite Space AI Co-Pilot)**:
  * **Domain-Tuned Astrophysical Reasoning**: An embedded conversational AI co-pilot capable of answering complex inquiries regarding orbital mechanics, asteroid classification (Apollo, Amor, Aten), satellite orbital decay, and deep-space missions.
  * **Voice Command Interface**: Bidirectional speech recognition and tactical voice synthesis for hands-free mission control navigation.

* **NASA JPL NeoWs Real-Time Telemetry Engine**:
  * Automated ingestion of Near-Earth Objects (NEOs) with server-side caching (`app/api/asteroids/route.ts`).
  * Mathematical conversion of Lunar Distances ($1\text{ LD} \approx 384,400\text{ km}$), relative approach velocities, and orbital elements ($a, e, i, \Omega, \omega$).
  * Kinetic impact energy evaluation ($E = \frac{1}{2}mv^2$ in Megatons of TNT equivalent).

* **Photorealistic 3D Spatial Graphics (Three.js & CesiumJS)**:
  * Textured Earth model with true $23.44^\circ$ axial tilt and Rayleigh atmospheric scattering glow.
  * Deep-space asymptotic hyperbolic trajectory ribbons spanning interplanetary distances ($280+$ 3D units).
  * High-resolution camera-facing billboard tactical approaching chevrons ($\gg$).

* **NORAD SGP4 Multi-Satellite Fleet Tracking**:
  * Real-time SGP4 orbit calculation for ISS, Tiangong CSS, Hubble Space Telescope, NOAA-19, Terra, and Starlink.

---

### 3. Relevance to Challenge Theme

* **Transforming Open Data into High-Impact Public Utility**: Bridges the gap between complex open government APIs (NASA Open Data, CelesTrak) and civilian public safety by delivering a reliable planetary defense monitoring system.
* **Human-Centered Design Thinking**: Engineered through systematic user discovery (*Empathize $\rightarrow$ Persona $\rightarrow$ Define $\rightarrow$ Ideate $\rightarrow$ Prototype*), replacing overwhelming data spreadsheets with intuitive physical size comparisons (*e.g., Monas 132m, Eiffel Tower 330m, Boeing 747 70m*).
* **Enterprise-Grade AI Integration**: Demonstrates the real-world power of **IBM Bob** and **IBM Granite** in accelerating scientific software engineering, complex mathematical modeling, and conversational user interfaces.
* **Universal Web Accessibility**: Operates natively in any modern web browser via WebGL with zero installation barriers.

---

## 🚀 Key Modules (System Cockpit)

| Module Code | Module Name | Core Technology | Primary Functionality |
| :--- | :--- | :--- | :--- |
| **SYS-01** | **3D Planetary Orrery** | Babylon.js & Keplerian Math | Heliocentric simulation of 8 primary solar system planets. |
| **SYS-02** | **IAU Sky Dome** | Astronomy-Engine & BSC5 Catalog | Topocentric Stellarium-style ground sky view with 9,000+ stars & IAU constellations. |
| **SYS-03** | **Asteroid Defense Radar** | NASA JPL NeoWs & Three.js | Real-time NEO proximity radar, DEFCON threat monitoring, and physical size scaling. |
| **SYS-04** | **Satellite Fleet Radar** | SGP4 Propagator & CesiumJS | Live multi-satellite tracking with ground tracks and sensor footprint cones. |
| **SYS-05** | **AI Mission Control** | Three.js & Astrodynamics Physics | Deterministic decision-support workspace for orbital satellite launch and Apollo-style Lunar Free-Return transfers with AI post-analysis. |

---

## 🛰️ Deep-Dive: AI Mission Control Engine (SYS-05)

### 1. The Problem
Space mission design and trajectory planning traditionally require proprietary, expensive desktop toolchains (e.g., STK, GMAT) that create an **accessibility and comprehension barrier**:
* **Complex Multi-Constraint Trade-Offs**: Calculating whether a launch vehicle can reach a target orbit or return safely from the Moon involves intricate relationships between payload mass, specific impulse ($I_{sp}$), gravitational assist, and orbital plane inclination.
* **Information Disconnect**: Theoretical $\Delta v$ spreadsheets lack intuitive, real-time 3D spatial representations, making it difficult for students, aerospace engineers, and decision-makers to immediately grasp trajectory geometry, launch site positioning, and Earth-Moon spatial relationships.

---

### 2. The Solution
**AI Mission Control** provides a lightweight, browser-native, physics-grounded decision-support cockpit:
1. **Interactive Mission Briefing**: Rapid configuration of launch sites (Cape Canaveral / Florida, Guiana, Tanegashima, Kourou, Mahia, etc.), vehicle classes, payload mass, target altitudes, and flight windows.
2. **Deterministic Physics Solver**: Real-time evaluation of launch vehicle capabilities, orbit insertions, and lunar flybys using verified astrodynamics equations.
3. **Photorealistic 3D Spatial Theater**:
   * **Full 360° Daytime Earth (NASA 4K Blue Marble)**: Eliminates dark shadows so all global launch sites, continents, and trajectory ground tracks remain crystal-clear from any camera angle.
   * **Exact Florida / Launch Site Pinning**: Precise geodetic-to-ECI coordinate alignment anchoring the liftoff point directly to the physical spaceport on Earth's surface.
   * **Apollo Figure-8 Lunar Free-Return Loop**: Continuous, gap-free retrograde hyperbolic trajectory that wraps gracefully around the far side of the Moon at perilune and returns directly to Earth's atmospheric entry interface ($120\text{ km}$).
4. **Interactive Flight Phase & Altitude Profile Graphic**:
   * **Multi-Color Flight Timeline Bar**: Visual phase breakdown mapping directly to 3D trajectory colors:
     * 🟠 **Outbound TLI Transfer (Orange)**: LEO departure burn on prograde transfer ellipse toward the Moon.
     * 🟣 **Lunar Perilune Flyby (Violet)**: Hyperbolic gravity slingshot swinging behind the Moon ($200\text{ km}$ perilune).
     * 🔵 **Earth Free-Return Leg (Blue)**: Ballistic return path converging on Earth's atmospheric entry interface ($120\text{ km}$).
   * **Dynamic SVG Altitude Profile**: Real-time altitude geometry sparkline mapping the space vehicle's altitude curve from liftoff to lunar encounter and atmospheric reentry.
5. **Focused Decision Output & AI Post-Analysis**: Single-mode optimization (*Fastest Feasible / Shortest Time*) delivering an instantaneous feasibility verdict, $\Delta v$ budget breakdown, flight timelines, and AI-driven mission risk assessment.

---

### 3. Astrodynamics & Mathematical Formulation

#### A. Rocket Performance & Delta-V Capacity (Tsiolkovsky Rocket Equation)
The vehicle's available velocity increment $\Delta v_{\text{avail}}$ is governed by the Tsiolkovsky equation:
$$\Delta v_{\text{avail}} = I_{\text{sp}} \cdot g_0 \cdot \ln\left(\frac{m_{\text{wet}}}{m_{\text{dry}} + m_{\text{payload}}}\right)$$
* Where $I_{\text{sp}}$ is the vacuum specific impulse $(\text{s})$, $g_0 = 9.80665\text{ m/s}^2$ is standard gravity, $m_{\text{wet}}$ is total vehicle mass, $m_{\text{dry}}$ is structural mass, and $m_{\text{payload}}$ is the payload mass.

---

#### B. Satellite Launch Orbit Mechanics (LEO Insertion & Plane Change)
1. **Circular Orbital Velocity at Target Altitude ($h$)**:
   $$v_{\text{circ}} = \sqrt{\frac{\mu_E}{R_E + h}}$$
   * Where $\mu_E = 3.986004418 \times 10^{14}\text{ m}^3/\text{s}^2$ and $R_E = 6,378.137\text{ km}$.

2. **Earth Rotation Boost from Launch Site Latitude ($\phi$)**:
   $$v_{\text{rot}} = \omega_E \cdot (R_E + h_{\text{elev}}) \cdot \cos(\phi)$$
   * Where $\omega_E = 7.2921159 \times 10^{-5}\text{ rad/s}$.

3. **Total Launch Delta-V Requirement**:
   $$\Delta v_{\text{req}} = v_{\text{circ}} - v_{\text{rot}} + \Delta v_{\text{grav}} + \Delta v_{\text{drag}} + \Delta v_{\text{steering}} + \Delta v_{\text{plane}}$$
   * Where aerodynamic and gravity losses are modeled as $\approx 1,250\text{ m/s} \cdot \left(\frac{h}{200}\right)^{0.05}$, and orbital plane inclination penalty is:
   $$\Delta v_{\text{plane}} = 2 \cdot v_{\text{circ}} \cdot \sin\left(\frac{|\Delta i|}{2}\right) \quad \text{if } i < |\phi|$$

---

#### C. Lunar Free-Return Mechanics (Lambert Solver & Patched-Conic Slingshot)
1. **Trans-Lunar Injection (TLI) from Parking Orbit ($r_0 = R_E + h_{\text{park}}$)**:
   $$v_{\text{TLI}} = \sqrt{\frac{2\mu_E}{r_0} - \frac{2\mu_E}{r_0 + r_{\text{Moon}}}}$$
   $$\Delta v_{\text{TLI}} = v_{\text{TLI}} - \sqrt{\frac{\mu_E}{r_0}}$$

2. **Hyperbolic Flyby & Retrograde Gravity Slingshot**:
   The spacecraft approaches the Moon's leading edge with hyperbolic excess velocity $\mathbf{v}_\infty$. The Moon's gravitational parameter $\mu_M = 4.9048695 \times 10^{12}\text{ m}^3/\text{s}^2$ bends the trajectory by turn angle $\delta$:
   $$\sin\left(\frac{\delta}{2}\right) = \frac{1}{1 + \frac{r_{\text{peri}} \cdot v_\infty^2}{\mu_M}}$$
   * Where $r_{\text{peri}} = R_{\text{Moon}} + h_{\text{perilune}}$ is the perilune radius from the Moon's center ($R_{\text{Moon}} = 1,737.4\text{ km}$).

3. **Continuous 3D Figure-8 Coordinate Synthesis**:
   In Moon-centered orbital coordinates defined by radial unit vector $\hat{\mathbf{u}}_{\text{rad}} = \frac{\mathbf{r}_M}{\|\mathbf{r}_M\|}$ and tangential velocity unit vector $\hat{\mathbf{u}}_{\text{tan}}$:
   $$\mathbf{r}_{\text{flyby}}(\theta) = \mathbf{r}_M + r_M(\theta) \left[\cos(\theta)\,\hat{\mathbf{u}}_{\text{rad}} - \sin(\theta)\,\hat{\mathbf{u}}_{\text{tan}}\right], \quad \theta \in \left[-\frac{\pi}{2}, +\frac{\pi}{2}\right]$$
   This guarantees that the spacecraft sweeps smoothly behind the Moon's far side at perilune ($\theta = 0$) without clipping through the lunar surface, directly routing the return vector toward Earth's atmospheric entry interface ($h = 120\text{ km}$).

---

#### D. Mission Feasibility & Margin Classification
$$\text{Margin } (\Delta v_{\text{margin}}) = \Delta v_{\text{avail}} - \Delta v_{\text{req}}$$
* **Feasible** ($\Delta v_{\text{margin}} \ge 500\text{ m/s}$): Green indicator; mission possesses nominal safety reserves.
* **Marginal** ($0 \le \Delta v_{\text{margin}} < 500\text{ m/s}$): Amber indicator; high risk of mission failure without precision midcourse trimming.
* **Infeasible** ($\Delta v_{\text{margin}} < 0\text{ m/s}$): Red indicator; vehicle propellant capacity is insufficient for the requested payload and orbit.

---

## 🛠️ Tech Stack

* **AI & Engineering Platform**: **IBM Bob** (Development & Architecture Copilot) + **IBM Granite / Gemini** (Astrophysical AI Co-Pilot & Mission Post-Analysis)
* **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **3D & Geospatial Engines**: [Three.js](https://threejs.org/) + [CesiumJS](https://cesium.com/) + [Babylon.js](https://www.babylonjs.com/)
* **Astrophysics Math**: `astronomy-engine`, `satellite.js` (SGP4), Lambert Universal-Variable Solver, Patched-Conic Mechanics, WGS-84 Ellipsoid Transforms
* **Styling & UI**: Tailwind CSS + Lucide Icons + Frosted Sci-Fi Glassmorphism
* **Data Sources**: NASA JPL NeoWs, NASA Horizons, CelesTrak NORAD, Yale Bright Star Catalog (BSC5)

---

## 💻 Getting Started

### Prerequisites
* Node.js 18+ or 20+
* npm, pnpm, or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/your-username/cakrapala.git

# Install dependencies
npm install

# Run automated tests
npm test

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. Navigate to [http://localhost:3000/mission-control](http://localhost:3000/mission-control) to access **AI Mission Control**.

---

## 📜 License
This project is open-source under the MIT License.

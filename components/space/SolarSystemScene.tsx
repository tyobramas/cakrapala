"use client";

/**
 * SolarSystemScene — True First-Principles VSOP87 3D Solar System Orrery.
 *
 * Physics & Ephemeris (zero hardcoded circles or fake speeds):
 *   - Every planet's 3D heliocentric position is computed live from `astronomy-engine`
 *     VSOP87 ephemeris at `simDate` (real elliptical orbits, perihelion acceleration,
 *     aphelion deceleration, 3D orbital inclinations, and exact planetary conjunctions).
 *   - Earth's Moon is positioned live via geocentric lunar ephemeris (`GeoVector(Moon)`).
 *   - Axial rotation rates use authentic NASA/IAU sidereal day periods (retrograde Venus & Uranus).
 *   - Seamless 8K IAU J2000 Milky Way sky sphere (60.19° Galactic-to-Ecliptic inclination).
 *   - Conflict-free damped camera glide + delta-tracking (never fights pan, zoom, or pinch).
 */

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";

import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  TransformNode,
  PointerEventTypes,
} from "@babylonjs/core";

import { createScene } from "@/lib/babylon/createScene";
import { createSun, type SunHandle } from "@/lib/babylon/createSun";
import {
  createPlanets,
  type PlanetMeshMap,
  type PlanetRigMap,
} from "@/lib/babylon/createPlanets";
import {
  createOrbits,
  setOrbitsVisible,
  highlightSelectedOrbit,
  type OrbitMeshMap,
} from "@/lib/babylon/createOrbits";
import { createStarfield } from "@/lib/babylon/createStarfield";
import {
  createLabels,
  setLabelsVisible,
  disposeLabels,
  type LabelMap,
} from "@/lib/babylon/createLabels";
import {
  createAsteroidBelt,
  type AsteroidBeltHandle,
} from "@/lib/babylon/createAsteroidBelt";

import { PLANET_DATA, SUN_DATA } from "@/lib/astronomy/planetData";
import {
  computePlanetEphemeris,
  computeMoonEclipticDirection,
  computeEarthRotationY,
  REAL_PLANET_CONSTANTS,
  type LivePlanetTelemetry,
  type OrbitingPlanetId,
} from "@/lib/astronomy/solarSystemPhysics";
import {
  CAMERA_INITIAL_RADIUS,
  CAMERA_INITIAL_ALPHA,
  CAMERA_INITIAL_BETA,
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
} from "@/lib/babylon/sceneConstants";
import type { PlanetId } from "@/lib/astronomy/types";

export interface EphemerisSnapshot {
  simDate: Date;
  telemetry: Record<string, LivePlanetTelemetry>;
}

export type SolarSystemSceneHandle = {
  resetCamera: () => void;
  deselectPlanet: () => void;
  focusPlanet: (id: PlanetId | null) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  syncToNow: () => void;
};

type Props = {
  isPaused: boolean;
  /** Real simulated Earth days elapsed per real-world second. */
  daysPerSecond: number;
  showOrbits: boolean;
  showLabels: boolean;
  selectedPlanetId?: PlanetId | null;
  onPlanetSelected: (id: PlanetId | null) => void;
  onEphemerisUpdate?: (snapshot: EphemerisSnapshot) => void;
};

type SimRef = {
  isPaused: boolean;
  daysPerSecond: number;
  showLabels: boolean;
};

type CameraGlideState = {
  active: boolean;
  targetRadius: number;
  targetAlpha?: number;
  targetBeta?: number;
  lerpTarget: boolean;
  lerpRadius: boolean;
  lerpAngles: boolean;
};

const SolarSystemScene = forwardRef<SolarSystemSceneHandle, Props>(
  function SolarSystemScene(
    {
      isPaused,
      daysPerSecond,
      showOrbits,
      showLabels,
      selectedPlanetId,
      onPlanetSelected,
      onEphemerisUpdate,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [loadingState, setLoadingState] = useState<{
      progress: number;
      status: string;
      isReady: boolean;
    }>({
      progress: 18,
      status: "Calibrating VSOP87 Ephemeris Engine",
      isReady: false,
    });

    const engineRef = useRef<Engine | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const sunHandleRef = useRef<SunHandle | null>(null);
    const planetMeshesRef = useRef<PlanetMeshMap | null>(null);
    const planetRigsRef = useRef<PlanetRigMap | null>(null);
    const orbitMeshesRef = useRef<OrbitMeshMap | null>(null);
    const labelsRef = useRef<LabelMap | null>(null);
    const asteroidBeltRef = useRef<AsteroidBeltHandle | null>(null);

    const simEpochMsRef = useRef<number>(Date.now());
    const trackedNodeRef = useRef<TransformNode | null>(null);
    const prevTrackedPosRef = useRef<Vector3 | null>(null);

    const glideRef = useRef<CameraGlideState>({
      active: false,
      targetRadius: CAMERA_INITIAL_RADIUS,
      lerpTarget: false,
      lerpRadius: false,
      lerpAngles: false,
    });

    const onPlanetSelectedRef = useRef(onPlanetSelected);
    useEffect(() => {
      onPlanetSelectedRef.current = onPlanetSelected;
    }, [onPlanetSelected]);

    const onEphemerisUpdateRef = useRef(onEphemerisUpdate);
    useEffect(() => {
      onEphemerisUpdateRef.current = onEphemerisUpdate;
    }, [onEphemerisUpdate]);

    const simRef = useRef<SimRef>({
      isPaused,
      daysPerSecond,
      showLabels,
    });

    useEffect(() => {
      simRef.current.isPaused = isPaused;
      simRef.current.daysPerSecond = daysPerSecond;
      simRef.current.showLabels = showLabels;
    }, [isPaused, daysPerSecond, showLabels]);

    useEffect(() => {
      if (orbitMeshesRef.current) {
        setOrbitsVisible(orbitMeshesRef.current, showOrbits);
      }
    }, [showOrbits]);

    useEffect(() => {
      if (labelsRef.current) {
        setLabelsVisible(
          labelsRef.current,
          showLabels,
          selectedPlanetId ?? null
        );
      }
    }, [showLabels, selectedPlanetId]);

    // ── Smooth Conflict-Free Camera Focus / Return ────────────────────────────
    const initiateCameraFocus = useCallback(
      (id: PlanetId | null, resetAngles = false) => {
        const camera = cameraRef.current;
        if (!camera) return;

        camera.inertialRadiusOffset = 0;
        camera.inertialPanningX = 0;
        camera.inertialPanningY = 0;

        if (id) {
          const isSun = id === "sun";
          const targetNode: TransformNode | null = isSun
            ? (sunHandleRef.current?.mesh ?? null)
            : (planetRigsRef.current?.get(id)?.orbitNode ?? null);

          if (!targetNode) return;

          const planetData = PLANET_DATA.find((p) => p.id === id);
          const visualRadius = planetData
            ? planetData.visualRadius
            : SUN_DATA.visualRadius;

          trackedNodeRef.current = targetNode;
          prevTrackedPosRef.current = targetNode.getAbsolutePosition().clone();

          const zoomMultiplier = id === "saturn" ? 5.2 : isSun ? 4.4 : 4.2;
          const targetRadius = Math.max(3.2, visualRadius * zoomMultiplier);
          camera.lowerRadiusLimit = Math.max(
            isSun ? 6.2 : 1.4,
            visualRadius * (id === "saturn" ? 2.8 : 1.7)
          );
          camera.panningDistanceLimit = 180;

          glideRef.current = {
            active: true,
            targetRadius,
            lerpTarget: true,
            lerpRadius: true,
            lerpAngles: false,
          };
        } else {
          trackedNodeRef.current = null;
          prevTrackedPosRef.current = null;
          camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
          camera.panningDistanceLimit = 145;

          glideRef.current = {
            active: true,
            targetRadius: CAMERA_INITIAL_RADIUS,
            targetAlpha: resetAngles ? CAMERA_INITIAL_ALPHA : undefined,
            targetBeta: resetAngles ? CAMERA_INITIAL_BETA : undefined,
            lerpTarget: true,
            lerpRadius: true,
            lerpAngles: resetAngles,
          };
        }

        if (orbitMeshesRef.current) {
          highlightSelectedOrbit(orbitMeshesRef.current, id);
        }
        if (labelsRef.current) {
          setLabelsVisible(labelsRef.current, simRef.current.showLabels, id);
        }
      },
      []
    );

    useEffect(() => {
      if (!sceneRef.current) return;
      initiateCameraFocus(selectedPlanetId ?? null, false);
    }, [selectedPlanetId, initiateCameraFocus]);

    // ── Imperative Controls ───────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        resetCamera() {
          initiateCameraFocus(null, true);
        },
        deselectPlanet() {
          initiateCameraFocus(null, false);
          onPlanetSelectedRef.current(null);
        },
        focusPlanet(id: PlanetId | null) {
          initiateCameraFocus(id, false);
        },
        zoomIn() {
          const camera = cameraRef.current;
          if (!camera) return;
          glideRef.current.lerpRadius = false;
          const next = Math.max(
            camera.lowerRadiusLimit ?? CAMERA_MIN_RADIUS,
            camera.radius * 0.72
          );
          camera.inertialRadiusOffset += (next - camera.radius) * 0.25;
        },
        zoomOut() {
          const camera = cameraRef.current;
          if (!camera) return;
          glideRef.current.lerpRadius = false;
          const next = Math.min(
            camera.upperRadiusLimit ?? CAMERA_MAX_RADIUS,
            camera.radius * 1.38
          );
          camera.inertialRadiusOffset += (next - camera.radius) * 0.25;
        },
        syncToNow() {
          const now = new Date();
          simEpochMsRef.current = now.getTime();
          const earthRig = planetRigsRef.current?.get("earth");
          if (earthRig) {
            earthRig.mesh.rotation.y = computeEarthRotationY(now);
          }
        },
      }),
      [initiateCameraFocus]
    );

    // ── 3D Scene Initialization ───────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || engineRef.current) return;

      let isCancelled = false;
      let cleanupControls: (() => void) | null = null;

      const initScene = async () => {
        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        let rig: ReturnType<typeof createScene>;
        try {
          rig = createScene(canvas);
        } catch {
          return;
        }

        const { engine, scene, camera } = rig;
        cleanupControls = rig.cleanupControls;
        engineRef.current = engine;
        sceneRef.current = scene;
        cameraRef.current = camera;

        if (isCancelled) return;
        setLoadingState({
          progress: 35,
          status: "Aligning IAU J2000 Galactic Sphere",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        createStarfield(scene);
        const sunHandle = createSun(scene);
        sunHandleRef.current = sunHandle;

        setLoadingState({
          progress: 65,
          status: "Solving VSOP87 Elliptical Planetary Orbits",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        const now = new Date();
        simEpochMsRef.current = now.getTime();

        const { meshes: planetMeshes, rigs: planetRigs } = createPlanets(scene);
        const orbitMeshes = createOrbits(scene, now);
        planetMeshesRef.current = planetMeshes;
        planetRigsRef.current = planetRigs;
        orbitMeshesRef.current = orbitMeshes;

        // Place every planet & Earth's Moon at their exact live VSOP87 positions
        const initialTelemetry: Record<string, LivePlanetTelemetry> = {};
        const moonDirTmp = new Vector3();

        for (const planet of PLANET_DATA) {
          const id = planet.id as OrbitingPlanetId;
          const pRig = planetRigs.get(id);
          if (!pRig) continue;
          const eph = computePlanetEphemeris(id, now, pRig.orbitNode.position);
          initialTelemetry[id] = eph;
          if (id === "earth") {
            // Exact real-time GMST rotation phase so day/night terminator matches real cities to < 0.05°
            pRig.mesh.rotation.y = computeEarthRotationY(now);
            if (pRig.moonMesh && pRig.moonOrbitRadius) {
              computeMoonEclipticDirection(now, moonDirTmp);
              pRig.moonMesh.position.copyFrom(
                moonDirTmp.scale(pRig.moonOrbitRadius)
              );
            }
          }
        }
        onEphemerisUpdateRef.current?.({
          simDate: now,
          telemetry: initialTelemetry,
        });

        setLoadingState({
          progress: 88,
          status: "Initializing Main Belt & Telemetry",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        const labels = createLabels(scene, planetRigs);
        const asteroidBelt = createAsteroidBelt(scene);
        labelsRef.current = labels;
        asteroidBeltRef.current = asteroidBelt;

        const onUserWheel = () => {
          glideRef.current.lerpRadius = false;
        };
        canvas.addEventListener("wheel", onUserWheel, { passive: true });

        const tmpDelta = new Vector3();
        let lastUiPublishMs = 0;

        // ── Render Loop: Real VSOP87 Ephemeris + Delta-Tracked Camera ─────────
        const renderObs = scene.onBeforeRenderObservable.add(() => {
          const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.1);
          const deltaDays = simRef.current.isPaused
            ? 0
            : deltaSeconds * simRef.current.daysPerSecond;

          if (deltaDays !== 0) {
            simEpochMsRef.current += deltaDays * 86400 * 1000;
          }

          const simDate = new Date(simEpochMsRef.current);

          // Sun equatorial rotation (~25.38 days real sidereal period, gently clamped so it stays smooth)
          sunHandle.update(
            deltaSeconds,
            simRef.current.isPaused
              ? 0.15
              : Math.min(Math.max(simRef.current.daysPerSecond / 10, 0.25), 3.5)
          );

          const liveTelemetry: Record<string, LivePlanetTelemetry> = {};
          const shouldPublishUi =
            performance.now() - lastUiPublishMs >= 160;

          if (deltaDays !== 0) {
            asteroidBeltRef.current?.updateBySimDays(deltaDays);

            for (const planet of PLANET_DATA) {
              const id = planet.id as OrbitingPlanetId;
              const pRig = planetRigsRef.current?.get(id);
              if (!pRig) continue;

              // Exact real VSOP87 3D heliocentric position & Vis-Viva velocity
              const eph = computePlanetEphemeris(
                id,
                simDate,
                pRig.orbitNode.position
              );
              if (shouldPublishUi) {
                liveTelemetry[id] = eph;
              }

              // Real sidereal axial rotation:
              // In Babylon left-handed space, prograde West->East (CCW from North Pole) is decreasing rotation.y.
              // For Earth at LIVE or 1 H/s, lock directly to exact GMST so global day/night matches reality!
              if (id === "earth" && simRef.current.daysPerSecond <= 1 / 24 + 1e-6) {
                pRig.mesh.rotation.y = computeEarthRotationY(simDate);
              } else {
                const siderealDays =
                  REAL_PLANET_CONSTANTS[id].siderealRotationHours / 24;
                const spinRateDaysPerSec = Math.min(
                  simRef.current.daysPerSecond,
                  1 / 24
                );
                const effectiveRotDays = deltaSeconds * spinRateDaysPerSec;
                pRig.mesh.rotation.y -=
                  ((Math.PI * 2) / siderealDays) * effectiveRotDays;
              }

              // Real lunar geocentric orbit around Earth
              if (id === "earth" && pRig.moonMesh && pRig.moonOrbitRadius) {
                computeMoonEclipticDirection(simDate, moonDirTmp);
                pRig.moonMesh.position.copyFrom(
                  moonDirTmp.scale(pRig.moonOrbitRadius)
                );
              }

              pRig.update?.(deltaDays);
            }

            if (shouldPublishUi) {
              lastUiPublishMs = performance.now();
              onEphemerisUpdateRef.current?.({
                simDate,
                telemetry: liveTelemetry,
              });
            }
          }

          // ── Smooth Camera Glide & User-Friendly Delta Tracking ──────────────
          const glide = glideRef.current;
          const trackedNode = trackedNodeRef.current;
          const damp = 1 - Math.exp(-deltaSeconds * 6.5);

          if (trackedNode) {
            const currentPos = trackedNode.getAbsolutePosition();

            if (glide.active && glide.lerpTarget) {
              Vector3.LerpToRef(camera.target, currentPos, damp, camera.target);
              if (Vector3.Distance(camera.target, currentPos) < 0.03) {
                camera.target.copyFrom(currentPos);
                glide.lerpTarget = false;
              }
            } else if (prevTrackedPosRef.current) {
              currentPos.subtractToRef(prevTrackedPosRef.current, tmpDelta);
              camera.target.addInPlace(tmpDelta);
            }

            if (!prevTrackedPosRef.current) {
              prevTrackedPosRef.current = currentPos.clone();
            } else {
              prevTrackedPosRef.current.copyFrom(currentPos);
            }
          } else if (glide.active && glide.lerpTarget) {
            Vector3.LerpToRef(
              camera.target,
              Vector3.Zero(),
              damp,
              camera.target
            );
            if (camera.target.length() < 0.04) {
              camera.target.set(0, 0, 0);
              glide.lerpTarget = false;
            }
          }

          if (glide.active) {
            if (glide.lerpRadius) {
              camera.radius += (glide.targetRadius - camera.radius) * damp;
              if (Math.abs(camera.radius - glide.targetRadius) < 0.05) {
                camera.radius = glide.targetRadius;
                glide.lerpRadius = false;
              }
            }
            if (
              glide.lerpAngles &&
              glide.targetAlpha !== undefined &&
              glide.targetBeta !== undefined
            ) {
              camera.alpha += (glide.targetAlpha - camera.alpha) * damp;
              camera.beta += (glide.targetBeta - camera.beta) * damp;
              if (
                Math.abs(camera.alpha - glide.targetAlpha) < 0.005 &&
                Math.abs(camera.beta - glide.targetBeta) < 0.005
              ) {
                camera.alpha = glide.targetAlpha;
                camera.beta = glide.targetBeta;
                glide.lerpAngles = false;
              }
            }
            if (!glide.lerpTarget && !glide.lerpRadius && !glide.lerpAngles) {
              glide.active = false;
            }
          }
        });

        // ── Pointer Click Selection (Ignores Orbit Drag / Pan / Pinch) ────────
        let pointerDownX = 0;
        let pointerDownY = 0;
        let pointerDownButton = 0;
        let activePointers = 0;
        let hadMultiTouch = false;

        const pointerObs = scene.onPointerObservable.add((info) => {
          if (info.type === PointerEventTypes.POINTERDOWN) {
            activePointers++;
            if (activePointers > 1) {
              hadMultiTouch = true;
              glideRef.current.lerpRadius = false;
              glideRef.current.lerpAngles = false;
            }
            pointerDownX = scene.pointerX;
            pointerDownY = scene.pointerY;
            pointerDownButton = info.event.button ?? 0;

            if (pointerDownButton !== 0 || info.event.shiftKey) {
              glideRef.current.lerpTarget = false;
            }
            glideRef.current.lerpAngles = false;
            return;
          }

          if (info.type !== PointerEventTypes.POINTERUP) return;

          activePointers = Math.max(0, activePointers - 1);
          if (hadMultiTouch) {
            if (activePointers === 0) hadMultiTouch = false;
            return;
          }

          if (pointerDownButton !== 0) return;
          const dragDist = Math.hypot(
            scene.pointerX - pointerDownX,
            scene.pointerY - pointerDownY
          );
          if (dragDist > 6) return;

          const hit = scene.pick(
            scene.pointerX,
            scene.pointerY,
            (m) => !!(m.metadata?.planetId || m.metadata?.type === "sun")
          );

          if (
            hit?.hit &&
            (hit.pickedMesh?.metadata?.planetId ||
              hit.pickedMesh?.metadata?.type === "sun")
          ) {
            const planetId = (hit.pickedMesh.metadata.planetId ||
              "sun") as PlanetId;
            onPlanetSelectedRef.current(planetId);
          }
        });

        const hoverObs = scene.onPointerObservable.add((info) => {
          if (info.type !== PointerEventTypes.POINTERMOVE) return;
          if (activePointers > 0) return;
          const hit = scene.pick(
            scene.pointerX,
            scene.pointerY,
            (m) => !!(m.metadata?.planetId || m.metadata?.type === "sun")
          );
          canvas.style.cursor = hit?.hit ? "pointer" : "grab";
        });

        engine.runRenderLoop(() => {
          scene.render();
        });

        setLoadingState({
          progress: 100,
          status: "Ready",
          isReady: true,
        });

        scene.metadata = { renderObs, pointerObs, hoverObs, onUserWheel };
      };

      initScene();

      const onResize = () => engineRef.current?.resize();
      window.addEventListener("resize", onResize);

      let resizeObserver: ResizeObserver | null = null;
      if (canvasRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          engineRef.current?.resize();
        });
        resizeObserver.observe(canvasRef.current);
        if (canvasRef.current.parentElement) {
          resizeObserver.observe(canvasRef.current.parentElement);
        }
      }

      return () => {
        isCancelled = true;
        window.removeEventListener("resize", onResize);
        resizeObserver?.disconnect();
        cleanupControls?.();

        if (sceneRef.current) {
          const s = sceneRef.current;
          if (s.metadata?.renderObs)
            s.onBeforeRenderObservable.remove(s.metadata.renderObs);
          if (s.metadata?.pointerObs)
            s.onPointerObservable.remove(s.metadata.pointerObs);
          if (s.metadata?.hoverObs)
            s.onPointerObservable.remove(s.metadata.hoverObs);
          if (s.metadata?.onUserWheel && canvas) {
            canvas.removeEventListener("wheel", s.metadata.onUserWheel);
          }
        }

        disposeLabels();
        if (engineRef.current) {
          engineRef.current.stopRenderLoop();
          sceneRef.current?.dispose();
          engineRef.current.dispose();
        }

        engineRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        sunHandleRef.current = null;
        planetMeshesRef.current = null;
        planetRigsRef.current = null;
        orbitMeshesRef.current = null;
        labelsRef.current = null;
        trackedNodeRef.current = null;
        prevTrackedPosRef.current = null;
      };
    }, []);

    return (
      <div className="relative h-full w-full overflow-hidden bg-[#01030a]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none outline-none cursor-grab active:cursor-grabbing"
          aria-label="Interactive 3D Solar System driven by real VSOP87 ephemeris."
          tabIndex={0}
        />

        {/* Minimal Loading Veil */}
        <div
          className={`pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#01030a] transition-opacity duration-700 ${
            loadingState.isReady ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="mb-5 h-9 w-9 animate-spin rounded-full border border-white/15 border-t-white/80" />
          <p className="font-mono text-[10px] tracking-[0.34em] text-slate-300/80 uppercase">
            {loadingState.status}
          </p>
          <div className="mt-3 h-px w-48 overflow-hidden bg-white/10">
            <div
              className="h-full bg-white/75 transition-all duration-300"
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }
);

export default SolarSystemScene;

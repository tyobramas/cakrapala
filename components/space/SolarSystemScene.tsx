"use client";

/**
 * SolarSystemScene — Babylon.js 3D Solar System & Cinematic Planetary Focus Engine.
 *
 * Features:
 * - Full 3D Keplerian Orbit Simulation & Multi-Layered Starfield
 * - Smooth Cinema-Grade Camera Glide & Zoom into Planet Globes on Click
 * - 360° Free Interactive Rotation around High-Res Rotating Planet Globes
 * - Seamless Return to Heliocentric Solar System View
 */

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";

import {
  Engine,
  Scene,
  ArcRotateCamera,
  HighlightLayer,
  Color3,
  Mesh,
  Vector3,
  Animation,
  CubicEase,
  EasingFunction,
} from "@babylonjs/core";

import {
  createScene,
} from "@/lib/babylon/createScene";
import { createSun } from "@/lib/babylon/createSun";
import {
  createPlanets,
  type PlanetMeshMap,
} from "@/lib/babylon/createPlanets";
import {
  createOrbits,
  setOrbitsVisible,
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
  HIGHLIGHT_COLOR,
  HIGHLIGHT_INTENSITY,
  CAMERA_INITIAL_RADIUS,
  CAMERA_INITIAL_ALPHA,
  CAMERA_INITIAL_BETA,
  CAMERA_MIN_RADIUS,
} from "@/lib/babylon/sceneConstants";
import type { PlanetId, SimulationState } from "@/lib/astronomy/types";

const BASE_SPEED_SCALE = 0.3;

export type SolarSystemSceneHandle = {
  resetCamera: () => void;
  deselectPlanet: () => void;
  focusPlanet: (id: PlanetId | null) => void;
};

type Props = {
  simulationState: SimulationState;
  selectedPlanetId?: PlanetId | null;
  onPlanetSelected: (id: PlanetId | null) => void;
};

type SimRef = {
  isPaused: boolean;
  simulationSpeed: number;
};

const SolarSystemScene = forwardRef<SolarSystemSceneHandle, Props>(
  function SolarSystemScene({ simulationState, selectedPlanetId, onPlanetSelected }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [loadingState, setLoadingState] = useState<{
      progress: number;
      status: string;
      isReady: boolean;
    }>({
      progress: 15,
      status: "CALIBRATING 3D ORRERY ENGINE...",
      isReady: false,
    });

    const engineRef = useRef<Engine | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const cameraRef = useRef<ArcRotateCamera | null>(null);
    const planetMeshesRef = useRef<PlanetMeshMap | null>(null);
    const orbitMeshesRef = useRef<OrbitMeshMap | null>(null);
    const labelsRef = useRef<LabelMap | null>(null);
    const asteroidBeltRef = useRef<AsteroidBeltHandle | null>(null);
    const hlRef = useRef<HighlightLayer | null>(null);
    const selectedMeshRef = useRef<Mesh | null>(null);
    const focusedMeshRef = useRef<Mesh | null>(null);
    const orbitAnglesRef = useRef<Map<PlanetId, number>>(new Map());

    const onPlanetSelectedRef = useRef(onPlanetSelected);
    useEffect(() => {
      onPlanetSelectedRef.current = onPlanetSelected;
    }, [onPlanetSelected]);

    const simRef = useRef<SimRef>({
      isPaused: simulationState.isPaused,
      simulationSpeed: simulationState.simulationSpeed,
    });

    useEffect(() => {
      simRef.current.isPaused = simulationState.isPaused;
      simRef.current.simulationSpeed = simulationState.simulationSpeed;
    }, [simulationState.isPaused, simulationState.simulationSpeed]);

    useEffect(() => {
      if (orbitMeshesRef.current) {
        setOrbitsVisible(orbitMeshesRef.current, simulationState.showOrbits);
      }
    }, [simulationState.showOrbits]);

    useEffect(() => {
      if (labelsRef.current) {
        setLabelsVisible(labelsRef.current, simulationState.showLabels);
      }
    }, [simulationState.showLabels]);

    // ── Smooth Camera Focus Animation Helper ──────────────────────────────────
    const smoothFocusTarget = (targetMesh: Mesh | null, visualRadius: number = 2.0) => {
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!camera || !scene) return;

      const ease = new CubicEase();
      ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

      if (targetMesh) {
        focusedMeshRef.current = targetMesh;
        const targetRadius = Math.max(3.8, visualRadius * 3.8);
        camera.lowerRadiusLimit = Math.max(1.5, visualRadius * 1.5);

        // Smoothly glide camera target to mesh position
        Animation.CreateAndStartAnimation(
          "camTargetGlide",
          camera,
          "target",
          60,
          45,
          camera.target.clone(),
          targetMesh.position.clone(),
          Animation.ANIMATIONLOOPMODE_CONSTANT,
          ease
        );

        // Smoothly zoom camera radius to planet close-up view
        Animation.CreateAndStartAnimation(
          "camRadiusGlide",
          camera,
          "radius",
          60,
          45,
          camera.radius,
          targetRadius,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
          ease
        );
      } else {
        focusedMeshRef.current = null;
        camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;

        // Return camera target to solar system origin
        Animation.CreateAndStartAnimation(
          "camTargetReturn",
          camera,
          "target",
          60,
          45,
          camera.target.clone(),
          Vector3.Zero(),
          Animation.ANIMATIONLOOPMODE_CONSTANT,
          ease
        );

        // Return camera radius to wide heliocentric view
        Animation.CreateAndStartAnimation(
          "camRadiusReturn",
          camera,
          "radius",
          60,
          45,
          camera.radius,
          CAMERA_INITIAL_RADIUS,
          Animation.ANIMATIONLOOPMODE_CONSTANT,
          ease
        );
      }
    };

    // ── Handle external planet selection changes ──────────────────────────────
    useEffect(() => {
      if (!sceneRef.current) return;
      if (selectedPlanetId) {
        const mesh =
          selectedPlanetId === "sun"
            ? (sceneRef.current.getMeshByName("sun") as Mesh)
            : planetMeshesRef.current?.get(selectedPlanetId) || null;

        if (mesh) {
          const planetData = PLANET_DATA.find((p) => p.id === selectedPlanetId);
          const visualRadius = planetData ? planetData.visualRadius : SUN_DATA.visualRadius;
          smoothFocusTarget(mesh, visualRadius);

          if (hlRef.current) {
            if (selectedMeshRef.current) hlRef.current.removeMesh(selectedMeshRef.current);
            hlRef.current.addMesh(
              mesh,
              new Color3(HIGHLIGHT_COLOR.r, HIGHLIGHT_COLOR.g, HIGHLIGHT_COLOR.b)
            );
            selectedMeshRef.current = mesh;
          }
        }
      } else {
        smoothFocusTarget(null);
        if (hlRef.current && selectedMeshRef.current) {
          hlRef.current.removeMesh(selectedMeshRef.current);
          selectedMeshRef.current = null;
        }
      }
    }, [selectedPlanetId]);

    // ── Imperative Handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      resetCamera() {
        smoothFocusTarget(null);
      },
      deselectPlanet() {
        smoothFocusTarget(null);
        if (selectedMeshRef.current && hlRef.current) {
          hlRef.current.removeMesh(selectedMeshRef.current);
          selectedMeshRef.current = null;
        }
        onPlanetSelectedRef.current(null);
      },
      focusPlanet(id: PlanetId | null) {
        if (!id) {
          smoothFocusTarget(null);
          return;
        }
        const mesh =
          id === "sun"
            ? (sceneRef.current?.getMeshByName("sun") as Mesh)
            : planetMeshesRef.current?.get(id) || null;

        if (mesh) {
          const planetData = PLANET_DATA.find((p) => p.id === id);
          smoothFocusTarget(mesh, planetData ? planetData.visualRadius : SUN_DATA.visualRadius);
        }
      },
    }));

    // ── 3D Scene Initialization ───────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (engineRef.current) return;

      let isCancelled = false;

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
        engineRef.current = engine;
        sceneRef.current = scene;
        cameraRef.current = camera;

        if (isCancelled) return;
        setLoadingState({
          progress: 35,
          status: "INITIALIZING SOLAR CORE & STARFIELD...",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        createStarfield(scene);
        createSun(scene);

        setLoadingState({
          progress: 60,
          status: "PROJECTING NASA PLANETARY TEXTURES & ORBITS...",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        const planetMeshes = createPlanets(scene);
        const orbitMeshes = createOrbits(scene);
        planetMeshesRef.current = planetMeshes;
        orbitMeshesRef.current = orbitMeshes;

        for (const planet of PLANET_DATA) {
          orbitAnglesRef.current.set(planet.id, Math.random() * 2 * Math.PI);
        }

        setLoadingState({
          progress: 82,
          status: "POPULATING ASTEROID BELT PARTICLES & LABELS...",
          isReady: false,
        });

        await new Promise((r) => setTimeout(r, 16));
        if (isCancelled) return;

        const labels = createLabels(scene, planetMeshes);
        const asteroidBelt = createAsteroidBelt(scene);
        labelsRef.current = labels;
        asteroidBeltRef.current = asteroidBelt;

        const hl = new HighlightLayer("planetHighlight", scene);
        hl.innerGlow = false;
        hl.outerGlow = true;
        hl.blurHorizontalSize = HIGHLIGHT_INTENSITY;
        hl.blurVerticalSize = HIGHLIGHT_INTENSITY;
        hlRef.current = hl;

        // ── Render Loop & Smooth Orbit + Planet Axial Rotation ────────────────
        const renderObs = scene.onBeforeRenderObservable.add(() => {
          const deltaMs = engine.getDeltaTime();
          const deltaSeconds = Math.min(deltaMs / 1000, 0.1);

          if (!simRef.current.isPaused) {
            asteroidBeltRef.current?.updateRotation(deltaSeconds, simRef.current.simulationSpeed);

            for (const planet of PLANET_DATA) {
              const mesh = planetMeshesRef.current?.get(planet.id);
              if (!mesh) continue;

              const prev = orbitAnglesRef.current.get(planet.id) ?? 0;
              const next =
                prev +
                planet.orbitSpeed *
                  deltaSeconds *
                  simRef.current.simulationSpeed *
                  BASE_SPEED_SCALE;

              orbitAnglesRef.current.set(planet.id, next);

              mesh.position.x = Math.cos(next) * planet.visualOrbitRadius;
              mesh.position.z = Math.sin(next) * planet.visualOrbitRadius;
              // Smooth photorealistic axial spin
              mesh.rotation.y += (0.4 / Math.max(0.5, planet.visualRadius)) * deltaSeconds * simRef.current.simulationSpeed;
            }
          }

          // Smoothly lock camera target to focused planet during orbit
          if (focusedMeshRef.current && camera) {
            camera.target.copyFrom(focusedMeshRef.current.position);
          }
        });

        // ── Strictly On-Click Selection (Ignore Camera Drag/Swipes) ──────────
        const POINTER_DOWN = 1;
        const POINTER_UP = 4;
        let pointerDownX = 0;
        let pointerDownY = 0;

        const pointerObs = scene.onPointerObservable.add((info) => {
          if (info.type === POINTER_DOWN) {
            pointerDownX = scene.pointerX;
            pointerDownY = scene.pointerY;
            return;
          }

          if (info.type !== POINTER_UP) return;

          // Ignore if user was dragging/rotating the camera
          const dragDist = Math.hypot(scene.pointerX - pointerDownX, scene.pointerY - pointerDownY);
          if (dragDist > 6) return;

          const hit = scene.pick(
            scene.pointerX,
            scene.pointerY,
            (m) => !!(m.metadata?.planetId || m.metadata?.type === "sun")
          );

          if (hit?.hit && (hit.pickedMesh?.metadata?.planetId || hit.pickedMesh?.metadata?.type === "sun")) {
            const planetId = (hit.pickedMesh.metadata.planetId || "sun") as PlanetId;
            const pickedMesh = hit.pickedMesh as Mesh;

            if (selectedMeshRef.current && hl) {
              hl.removeMesh(selectedMeshRef.current);
            }
            hl.addMesh(
              pickedMesh,
              new Color3(HIGHLIGHT_COLOR.r, HIGHLIGHT_COLOR.g, HIGHLIGHT_COLOR.b)
            );
            selectedMeshRef.current = pickedMesh;

            const planetData = PLANET_DATA.find((p) => p.id === planetId);
            const visualRadius = planetData ? planetData.visualRadius : SUN_DATA.visualRadius;
            smoothFocusTarget(pickedMesh, visualRadius);

            onPlanetSelectedRef.current(planetId);
          }
        });

        engine.runRenderLoop(() => {
          scene.render();
        });

        setLoadingState({
          progress: 100,
          status: "3D SOLAR SYSTEM READY",
          isReady: true,
        });

        scene.metadata = { renderObs, pointerObs };
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
        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        if (sceneRef.current) {
          const s = sceneRef.current;
          if (s.metadata?.renderObs) s.onBeforeRenderObservable.remove(s.metadata.renderObs);
          if (s.metadata?.pointerObs) s.onPointerObservable.remove(s.metadata.pointerObs);
        }

        disposeLabels();
        hlRef.current?.dispose();
        if (engineRef.current) {
          engineRef.current.stopRenderLoop();
          sceneRef.current?.dispose();
          engineRef.current.dispose();
        }

        engineRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        planetMeshesRef.current = null;
        orbitMeshesRef.current = null;
        labelsRef.current = null;
        hlRef.current = null;
        selectedMeshRef.current = null;
        focusedMeshRef.current = null;
      };
    }, []);

    return (
      <div className="relative w-full h-full overflow-hidden bg-[#020617]">
        <canvas
          ref={canvasRef}
          className="w-full h-full block outline-none cursor-grab active:cursor-grabbing"
          aria-label="Interactive 3D solar system. Click any planet to zoom into its rotating globe."
          tabIndex={0}
        />

        {/* ── Progressive Loading HUD ────────────────────────────────────────── */}
        {!loadingState.isReady && (
          <div className="absolute inset-0 bg-[#020617]/95 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-2xl font-mono">
            <div className="w-16 h-16 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
            <div className="text-cyan-300 font-black tracking-widest text-sm mb-2 uppercase">
              {loadingState.status}
            </div>
            <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{loadingState.progress}% COMPLETED</span>
          </div>
        )}
      </div>
    );
  }
);

export default SolarSystemScene;

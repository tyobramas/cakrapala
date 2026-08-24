/**
 * Creates and configures the Babylon.js scene with its camera and ambient lighting.
 * This module is responsible for the engine-level bootstrap only —
 * scene objects (Sun, planets, orbits, starfield) are added by separate modules.
 */

import {
  Engine,
  Scene,
  Color4,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color3,
} from "@babylonjs/core";

import {
  SCENE_CLEAR_COLOR_HEX,
  CAMERA_INITIAL_RADIUS,
  CAMERA_MIN_RADIUS,
  CAMERA_MAX_RADIUS,
  CAMERA_INITIAL_ALPHA,
  CAMERA_INITIAL_BETA,
  AMBIENT_LIGHT_INTENSITY,
} from "./sceneConstants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToColor4(hex: string): Color4 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color4(r, g, b, 1);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Container returned by createScene so callers hold references needed later. */
export type SceneRig = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
};

/**
 * Bootstraps a Babylon.js Engine + Scene bound to `canvas`.
 * Should be called exactly once per component mount.
 * Dispose via `rig.engine.dispose()` on unmount.
 */
export function createScene(canvas: HTMLCanvasElement): SceneRig {
  const engine = new Engine(canvas, /* antialiasing */ true, {
    preserveDrawingBuffer: false,
    stencil: true,
    powerPreference: "high-performance",
  });

  const scene = new Scene(engine);
  scene.clearColor = hexToColor4(SCENE_CLEAR_COLOR_HEX);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const camera = new ArcRotateCamera(
    "mainCamera",
    CAMERA_INITIAL_ALPHA,
    CAMERA_INITIAL_BETA,
    CAMERA_INITIAL_RADIUS,
    Vector3.Zero(),
    scene
  );
  camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
  camera.upperRadiusLimit = CAMERA_MAX_RADIUS;
  camera.minZ = 0.5;
  camera.maxZ = 12000;
  camera.attachControl(canvas, /* noPreventDefault */ true);
  // Smooth inertia for a premium feel.
  camera.inertia = 0.75;
  camera.wheelPrecision = 5;
  camera.pinchPrecision = 30;

  // ── Ambient light ───────────────────────────────────────────────────────────
  const ambientLight = new HemisphericLight(
    "ambientLight",
    new Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = AMBIENT_LIGHT_INTENSITY;
  ambientLight.diffuse = new Color3(0.6, 0.7, 1.0);
  ambientLight.groundColor = new Color3(0.1, 0.05, 0.15);

  return { engine, scene, camera };
}

/**
 * Resets the camera to its initial position and target.
 * Uses smooth animation via Babylon's camera animation support.
 */
export function resetCamera(camera: ArcRotateCamera): void {
  camera.setTarget(Vector3.Zero());
  camera.alpha = CAMERA_INITIAL_ALPHA;
  camera.beta = CAMERA_INITIAL_BETA;
  camera.radius = CAMERA_INITIAL_RADIUS;
}

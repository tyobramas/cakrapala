/**
 * Creates and configures the Babylon.js Engine, Scene, ACES tone-mapping,
 * and silky-smooth Orbit / Pinch / Pan / Zoom camera controls.
 */

import {
  Engine,
  Scene,
  Color4,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color3,
  ImageProcessingConfiguration,
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

function hexToColor4(hex: string): Color4 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color4(r, g, b, 1);
}

export type SceneRig = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  cleanupControls: () => void;
};

/**
 * Bootstraps a HiDPI Babylon.js Engine + Scene bound to `canvas`.
 */
export function createScene(canvas: HTMLCanvasElement): SceneRig {
  const engine = new Engine(
    canvas,
    /* antialiasing */ true,
    {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: "high-performance",
      antialias: true,
    },
    /* adaptToDeviceRatio */ true
  );

  // Cap hardware scaling at 2x Retina for razor-sharp rendering at 60 FPS
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.setHardwareScalingLevel(1 / dpr);

  const scene = new Scene(engine);
  scene.clearColor = hexToColor4(SCENE_CLEAR_COLOR_HEX);

  // Filmic ACES tone mapping for rich solar highlights and crisp deep-space contrast
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.08;
  scene.imageProcessingConfiguration.contrast = 1.06;

  // ── Camera with Proportional Zoom, Natural Pinch & Smooth Panning ─────────
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
  camera.lowerBetaLimit = 0.08;
  camera.upperBetaLimit = Math.PI - 0.08;
  camera.minZ = 0.12;
  camera.maxZ = 16000;

  // Attach controls with preventDefault enabled so wheel/pinch never scrolls or zooms the page
  camera.attachControl(canvas, /* noPreventDefault */ false, /* useCtrlForPanning */ false);

  // Silky rotational & zoom inertia
  camera.inertia = 0.86;
  camera.angularSensibilityX = 1150;
  camera.angularSensibilityY = 1150;

  // Proportional zoom: equally smooth from 350-unit overview down to 1.8-unit close-up
  camera.wheelDeltaPercentage = 0.018;
  camera.pinchDeltaPercentage = 0.008;
  camera.useNaturalPinchZoom = true;

  // Smooth right-drag / Shift+drag / middle-drag / 2-finger pan with safe boundary
  camera.panningSensibility = 60;
  camera.panningInertia = 0.85;
  camera.panningDistanceLimit = 145;
  camera.panningOriginTarget = Vector3.Zero();

  // Dedicated macOS trackpad pinch-to-zoom handler (ctrlKey wheel events) + Shift+left-drag pan
  const onWheelPinch = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      // Trackpad pinch deltaY is small; scale proportionally to current camera radius
      const delta = Math.max(-40, Math.min(40, e.deltaY));
      camera.inertialRadiusOffset -= delta * camera.radius * 0.0045;
    }
  };
  canvas.addEventListener("wheel", onWheelPinch, { passive: false });

  // Prevent browser context menu on right-click pan
  const onContextMenu = (e: MouseEvent) => e.preventDefault();
  canvas.addEventListener("contextmenu", onContextMenu);

  // Dynamically scale panning sensitivity with camera radius so pan feels 1:1 at every zoom level
  const panScaleObs = scene.onBeforeRenderObservable.add(() => {
    camera.panningSensibility = Math.max(18, 2200 / Math.max(camera.radius, 3));
  });

  // ── Subtle Deep-Space Ambient Fill ────────────────────────────────────────
  const ambientLight = new HemisphericLight(
    "ambientLight",
    new Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = AMBIENT_LIGHT_INTENSITY;
  ambientLight.diffuse = new Color3(0.45, 0.56, 0.82);
  ambientLight.groundColor = new Color3(0.05, 0.07, 0.14);

  const cleanupControls = () => {
    canvas.removeEventListener("wheel", onWheelPinch);
    canvas.removeEventListener("contextmenu", onContextMenu);
    scene.onBeforeRenderObservable.remove(panScaleObs);
  };

  return { engine, scene, camera, cleanupControls };
}

export function resetCamera(camera: ArcRotateCamera): void {
  camera.setTarget(Vector3.Zero());
  camera.alpha = CAMERA_INITIAL_ALPHA;
  camera.beta = CAMERA_INITIAL_BETA;
  camera.radius = CAMERA_INITIAL_RADIUS;
}

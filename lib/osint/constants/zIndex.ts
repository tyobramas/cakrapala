// lib/osint/constants/zIndex.ts
// ─────────────────────────────────────────────────────────────────────────────
// Centralized z-index hierarchy for the OSINT / GEOSINT module chrome.
// Structurally guarantees no chrome elements are buried under the Cesium canvas.
// ─────────────────────────────────────────────────────────────────────────────

export const OSINT_Z_INDEX = {
  /** Cesium 3D canvas and base globe container */
  globe: 0,
  /** Cesium credit container / data licensing dock */
  cesiumCredit: 10,
  /** Permanent bottom-right attribution chip and links */
  attribution: 15,
  /** Left vertical navigation rail */
  layerRail: 20,
  /** Top-right badge cluster and imagery status chips */
  topBar: 20,
  /** Bottom-left signals telemetry feed */
  signalsFeed: 20,
  /** Control popovers (Imagery, Fire, Storm, Air, Sea, Eyes settings) */
  popover: 30,
  /** Slide-out inspector drawer for inspected entity */
  inspector: 40,
  /** Command palette modal overlay */
  commandPalette: 50,
  /** Critical alert modal */
  modal: 60,
} as const;

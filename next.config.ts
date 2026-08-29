import type { NextConfig } from "next";

/**
 * Next.js 16 configuration for Cakrapala.
 *
 * CESIUM ASSETS:
 *   Cesium's static Workers, ThirdParty, Assets, and Widgets directories
 *   are copied to public/cesium/ by the `prebuild` script in package.json
 *   (using the `copy-cesium-assets` script) before this build runs.
 *
 *   This approach is required because Next.js 16 uses Turbopack by default
 *   and copy-webpack-plugin is not compatible with Turbopack.
 *
 * CESIUM_BASE_URL:
 *   Set at runtime in CesiumViewer.tsx via setCesiumBaseUrl() → window.CESIUM_BASE_URL = "/cesium".
 */

const nextConfig: NextConfig = {
  // Disable floating development indicator badge
  devIndicators: false,

  // Allow local development origins to prevent cross-origin dev resource blocking
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.3.86"],

  // Declare an empty turbopack config so Next.js does not error on the
  // presence of the webpack config below (used only for non-Turbopack builds).
  turbopack: {},

  // Keep the webpack config for environments that explicitly use webpack
  // (e.g. `next build --webpack`).  Turbopack ignores this block.
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.experiments = {
        ...(config.experiments ?? {}),
        topLevelAwait: true,
      };

      // Handle node: protocol imports (e.g. from satellite.js wasm runtimes)
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );

      // Cesium & satellite.js rely on Node.js built-ins that are not available in browser bundles.
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, boolean | string> | undefined),
        "@spz-loader/core": false,
        "@cesium/wasm-splats": false,
      };
      config.resolve.fallback = {
        ...(config.resolve.fallback as Record<string, boolean> | undefined),
        fs: false,
        path: false,
        os: false,
        crypto: false,
        module: false,
        worker_threads: false,
        url: false,
        stream: false,
        buffer: false,
      };
    }
    return config;
  },
};

export default nextConfig;

"use client";

/**
 * CyberGlobeView — High-Detail 3D Cyber Earth Globe with Orbital Constellation Mesh.
 * Matches the reference aerospace cyber-defense command deck:
 *   - Photorealistic 3D Earth with specular atmosphere glow
 *   - Outer triangular orbital mesh shell (Starlink/telecom constellation web)
 *   - Glowing orbital trajectory paths with satellite node points and collision target
 *   - Interactive mouse rotation / smooth auto-drift
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function CyberGlobeView() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 1. Scene, Camera, Renderer ───────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.2, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── 2. Earth Globe Sphere ────────────────────────────────────────────────
    const textureLoader = new THREE.TextureLoader();
    const earthMap = textureLoader.load("/textures/planets/earth.jpg");
    earthMap.colorSpace = THREE.SRGBColorSpace;

    const globeRadius = 1.85;
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthMap,
      roughness: 0.7,
      metalness: 0.1,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Rotate Earth slightly to show North America / Pacific
    globeMesh.rotation.y = -Math.PI * 0.45;
    globeMesh.rotation.x = 0.28;

    // ── 3. Atmosphere Rim Glow ───────────────────────────────────────────────
    const atmosGeo = new THREE.SphereGeometry(globeRadius * 1.025, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.72 - dot(vNormal, vec3(0, 0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.68, 1.0, 1.0) * intensity * 1.4;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // ── 4. Outer Orbital Constellation Mesh Shell (The Cyber Mesh) ───────────
    const meshRadius = globeRadius * 1.22;
    const meshGeo = new THREE.IcosahedronGeometry(meshRadius, 3);
    const wireGeo = new THREE.WireframeGeometry(meshGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    const meshLines = new THREE.LineSegments(wireGeo, wireMat);
    globeMesh.add(meshLines);

    // Node Points on the Mesh Vertices
    const posAttr = meshGeo.attributes.position;
    const nodeCount = posAttr.count;
    const nodesGeo = new THREE.BufferGeometry();
    const nodePositions = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount * 3; i++) {
      nodePositions[i] = posAttr.array[i];
    }
    nodesGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));

    const nodesMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const meshNodes = new THREE.Points(nodesGeo, nodesMat);
    globeMesh.add(meshNodes);

    // ── 5. Orbital Trajectory Paths (Elliptical Rings around Earth) ──────────
    const createOrbitRing = (radiusX: number, radiusY: number, rotX: number, rotY: number, color: number) => {
      const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(128);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, 0, p.y))
      );
      const ringMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Line(ringGeo, ringMat);
      ringMesh.rotation.x = rotX;
      ringMesh.rotation.y = rotY;
      return ringMesh;
    };

    const orbit1 = createOrbitRing(2.45, 2.3, 0.85, 0.4, 0x38bdf8);
    const orbit2 = createOrbitRing(2.65, 2.4, -0.65, -0.7, 0xf8fafc);
    const orbit3 = createOrbitRing(2.55, 2.35, 1.2, -0.3, 0xef4444);
    globeMesh.add(orbit1);
    globeMesh.add(orbit2);
    globeMesh.add(orbit3);

    // ── 6. Pulsing Red Collision Beacon Node on Earth Orbit ───────────────────
    const beaconGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(1.4, -0.2, 1.5);
    globeMesh.add(beaconMesh);

    // ── 7. Lighting ──────────────────────────────────────────────────────────
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(5, 3, 4);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.4);
    scene.add(ambientLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    blueRimLight.position.set(-5, -2, -3);
    scene.add(blueRimLight);

    // ── 8. Interactive Drag Controls ─────────────────────────────────────────
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      globeMesh.rotation.y += dx * 0.005;
      globeMesh.rotation.x += dy * 0.005;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // ── 9. Render Animation Loop ─────────────────────────────────────────────
    let animId: number;
    let clock = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.01;

      if (!isDragging) {
        globeMesh.rotation.y += 0.0012; // Slow realistic planetary rotation
      }

      // Beacon pulse effect
      const scale = 1 + Math.sin(clock * 5) * 0.35;
      beaconMesh.scale.set(scale, scale, scale);

      renderer.render(scene, camera);
    };
    animate();

    // ── 10. Responsive Resizing ──────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      domEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      resizeObserver.disconnect();
      renderer.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      if (container.contains(domEl)) {
        container.removeChild(domEl);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[480px] sm:min-h-[560px] lg:min-h-[640px] cursor-grab active:cursor-grabbing relative select-none"
    />
  );
}

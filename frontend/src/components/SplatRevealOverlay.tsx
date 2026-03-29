import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 15000;
const FADE_DURATION = 1.6;
const SHIMMER_AMP = 0.03;

interface Props {
  isLoaded: boolean;
  onComplete?: () => void;
}

export default function SplatRevealOverlay({ isLoaded, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<"idle" | "fadeout" | "done">("idle");
  const fadeTimeRef = useRef(0);
  const idleTimeRef = useRef(0);
  const completedRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ── Three.js setup ──────────────────────────────────────────────────
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, -2);
    camera.lookAt(0, 0, 2);

    // ── Backdrop plane ──────────────────────────────────────────────────
    const backdropMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0f,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      backdropMat
    );
    backdrop.position.z = 15;
    backdrop.renderOrder = -1;
    scene.add(backdrop);

    // ── Particles ───────────────────────────────────────────────────────
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const origins = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const roll = Math.random();
      let x: number, y: number, z: number;

      if (roll < 0.55) {
        // Ground plane
        z = Math.random() * 14;
        x = (Math.random() * 2 - 1) * (z + 1.5) * 0.55;
        y = -1.0 + (Math.random() * 2 - 1) * 0.18;
      } else if (roll < 0.70) {
        // Left wall
        x = -(2.0 + Math.random() * 2.5);
        y = -1.0 + Math.random() * 5.5;
        z = 2 + Math.random() * 11;
      } else if (roll < 0.85) {
        // Right wall
        x = 2.0 + Math.random() * 2.5;
        y = -1.0 + Math.random() * 5.5;
        z = 2 + Math.random() * 11;
      } else {
        // Ambient scatter
        x = (Math.random() * 2 - 1) * 7;
        y = -1.5 + Math.random() * 6;
        z = Math.random() * 14;
      }

      origins[i * 3] = x;
      origins[i * 3 + 1] = y;
      origins[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Warm clinical palette: whites, creams, soft accents
      const pick = Math.random();
      const brightness = 0.75 + Math.random() * 0.25;
      if (pick < 0.70) {
        // Warm white
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness * 0.97;
        colors[i * 3 + 2] = brightness * 0.92;
      } else if (pick < 0.85) {
        // Soft grey
        const g = 0.4 + Math.random() * 0.25;
        colors[i * 3] = g;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = g;
      } else if (pick < 0.93) {
        // Accent teal (clinical)
        colors[i * 3] = 0.3 + Math.random() * 0.15;
        colors[i * 3 + 1] = 0.65 + Math.random() * 0.2;
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2;
      } else {
        // Soft red accent
        colors[i * 3] = 0.8 + Math.random() * 0.15;
        colors[i * 3 + 1] = 0.3 + Math.random() * 0.15;
        colors[i * 3 + 2] = 0.3 + Math.random() * 0.15;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.022,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.renderOrder = 999;
    scene.add(points);

    // ── Animation loop ──────────────────────────────────────────────────
    let lastTime = performance.now();

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    function animate() {
      if (completedRef.current) return;

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (phaseRef.current === "idle") {
        idleTimeRef.current += delta;
        const t = idleTimeRef.current;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pos[i * 3] = origins[i * 3] + Math.sin(t * 1.2 + i * 0.003) * SHIMMER_AMP;
          pos[i * 3 + 1] = origins[i * 3 + 1] + Math.cos(t * 0.9 + i * 0.005) * SHIMMER_AMP;
          pos[i * 3 + 2] = origins[i * 3 + 2] + Math.sin(t * 1.0 + i * 0.004) * SHIMMER_AMP;
        }
        posAttr.needsUpdate = true;
      }

      if (phaseRef.current === "fadeout") {
        fadeTimeRef.current += delta;
        const t = Math.min(fadeTimeRef.current / FADE_DURATION, 1.0);
        const opacity = 1.0 - t * t * (3 - 2 * t); // smoothstep ease-out
        mat.opacity = opacity;
        backdropMat.opacity = opacity;

        if (t >= 1.0 && !completedRef.current) {
          completedRef.current = true;
          phaseRef.current = "done";
          onComplete?.();
          return;
        }
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    // ── Resize handler ──────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      completedRef.current = true; // stop animate loop before cancelling RAF
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      backdropMat.dispose();
      backdrop.geometry.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Trigger fadeout when loaded
  useEffect(() => {
    if (isLoaded && phaseRef.current === "idle") {
      phaseRef.current = "fadeout";
      fadeTimeRef.current = 0;
    }
  }, [isLoaded]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
    />
  );
}

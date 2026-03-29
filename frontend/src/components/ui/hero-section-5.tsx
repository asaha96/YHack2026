import * as React from "react";
import * as THREE from "three";

interface DnaHelixProps {
  dissolving: boolean;
  onDissolveComplete?: () => void;
}

function DnaHelix({ dissolving, onDissolveComplete }: DnaHelixProps) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<number | null>(null);
  const dissolvingRef = React.useRef(false);
  const dissolveStartRef = React.useRef(0);
  const meshesRef = React.useRef<THREE.Mesh[]>([]);
  const onCompleteRef = React.useRef(onDissolveComplete);
  const assembleStartRef = React.useRef(performance.now());
  onCompleteRef.current = onDissolveComplete;

  React.useEffect(() => {
    if (dissolving && !dissolvingRef.current) {
      dissolvingRef.current = true;
      dissolveStartRef.current = performance.now();
    }
  }, [dissolving]);

  React.useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(28, el.clientWidth / el.clientHeight, 0.1, 200);
    cam.position.set(0, 0.5, 11);
    cam.lookAt(-3, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x0d2924, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(10, 15, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x2dd4bf, 0.3);
    fill.position.set(-8, -5, -5);
    scene.add(fill);
    const rim = new THREE.PointLight(0x2dd4bf, 0.35, 25);
    rim.position.set(5, -6, 10);
    scene.add(rim);

    const group = new THREE.Group();
    group.rotation.z = -0.35;
    group.rotation.x = 0.08;
    scene.add(group);

    const geos = [
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.SphereGeometry(0.065, 7, 7),
      new THREE.SphereGeometry(0.045, 6, 6),
    ];
    const bondGeo = new THREE.SphereGeometry(0.035, 5, 5);
    const mats: THREE.Material[] = [];

    const mat = (color: number, rough: number) => {
      const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.02, clearcoat: 0.5, clearcoatRoughness: 0.15, transparent: true });
      mats.push(m);
      return m;
    };

    const palette = [
      () => mat(0x2dd4bf, 0.25),
      () => mat(0x14b8a6, 0.3),
      () => mat(0x0d9488, 0.35),
      () => mat(0x5eead4, 0.28),
    ];

    const points = 120;
    const height = 18;
    const radius = 1.2;
    const turns = 5;
    const allMeshes: THREE.Mesh[] = [];

    for (let i = 0; i < points; i++) {
      const t = i / points;
      const y = t * height - height / 2;
      const angle = t * Math.PI * 2 * turns;
      const left = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const right = new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);

      for (const pt of [left, right]) {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < count; j++) {
          const geo = geos[Math.floor(Math.random() * geos.length)];
          const spread = j < 2 ? 0 : 0.12;
          const mesh = new THREE.Mesh(geo, palette[Math.floor(Math.random() * palette.length)]());
          mesh.position.set(
            pt.x + (Math.random() - 0.5) * spread,
            pt.y + (Math.random() - 0.5) * spread * 0.4,
            pt.z + (Math.random() - 0.5) * spread,
          );
          mesh.userData.baseY = mesh.position.y;
          mesh.userData.baseZ = mesh.position.z;
          mesh.userData.baseX = mesh.position.x;
          mesh.userData.normalizedY = t; // 0 = bottom, 1 = top
          // Per-particle randomness for organic motion
          mesh.userData.driftX = (Math.random() - 0.5) * 2.0;
          mesh.userData.driftY = -(0.8 + Math.random() * 1.4); // always falls down
          mesh.userData.driftZ = (Math.random() - 0.5) * 1.2;
          mesh.userData.spinSpeed = (Math.random() - 0.5) * 4;
          mesh.userData.delayJitter = Math.random() * 0.06; // slight timing variation
          group.add(mesh);
          allMeshes.push(mesh);
        }
      }

      if (i % 3 === 0 && i > 0) {
        const dir = new THREE.Vector3().subVectors(right, left);
        const len = dir.length();
        const mid = new THREE.Vector3().lerpVectors(left, right, 0.5);
        const cylGeo = new THREE.CylinderGeometry(0.015, 0.015, len, 6, 1);
        const cylMat = mat(0x2dd4bf, 0.3);
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.copy(mid);
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        cyl.userData.baseY = cyl.position.y;
        cyl.userData.baseZ = cyl.position.z;
        cyl.userData.baseX = cyl.position.x;
        cyl.userData.normalizedY = t;
        cyl.userData.driftX = (Math.random() - 0.5) * 1.5;
        cyl.userData.driftY = -(0.6 + Math.random() * 1.0);
        cyl.userData.driftZ = (Math.random() - 0.5) * 0.8;
        cyl.userData.spinSpeed = (Math.random() - 0.5) * 3;
        cyl.userData.delayJitter = Math.random() * 0.06;
        cyl.userData.isBond = true;
        group.add(cyl);
        allMeshes.push(cyl);
      }
    }
    meshesRef.current = allMeshes;

    const resize = () => {
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    resize();

    // Start all particles scattered and invisible for entrance animation
    // Bonds (cylinders) stay in place — only fade opacity. Balls get scattered.
    const ASSEMBLE_DURATION = 1800; // ms for DNA to fully appear
    let assembled = false;
    for (const mesh of allMeshes) {
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      material.opacity = 0;
      if (mesh.userData.isBond) {
        mesh.scale.setScalar(0.01);
      } else {
        mesh.scale.setScalar(0.4);
        const dx = mesh.userData.driftX as number;
        const dy = mesh.userData.driftY as number;
        const dz = mesh.userData.driftZ as number;
        mesh.position.x = (mesh.userData.baseX as number) + dx;
        mesh.position.y = (mesh.userData.baseY as number) + dy;
        mesh.position.z = (mesh.userData.baseZ as number) + dz;
      }
    }
    assembleStartRef.current = performance.now();

    let t = 0;
    let callbackFired = false;
    let allGone = false;
    const DISSOLVE_DURATION = 1600;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.0012;
      group.rotation.y = t;

      // ── ENTRANCE: assemble particles bottom-to-top ──
      if (!assembled && !dissolvingRef.current) {
        const elapsed = performance.now() - assembleStartRef.current;
        const progress = Math.min(1, elapsed / ASSEMBLE_DURATION);

        for (const mesh of allMeshes) {
          const ny = mesh.userData.normalizedY as number;
          const jitter = mesh.userData.delayJitter as number;
          // Bottom particles appear first (low ny → early fadeStart)
          const fadeStart = ny * 0.85 + jitter;
          const fadeDuration = 0.25;
          const linearProgress = Math.max(0, Math.min(1, (progress - fadeStart) / fadeDuration));

          if (linearProgress > 0) {
            const p = linearProgress;
            const eased = 1 - Math.pow(1 - p, 3);
            const opacityEased = 1 - Math.pow(1 - p, 2);

            const material = mesh.material as THREE.MeshPhysicalMaterial;
            material.opacity = opacityEased;

            if (mesh.userData.isBond) {
              // Bonds: just fade in and scale from thin to full, no position change
              mesh.scale.setScalar(0.01 + 0.99 * eased);
            } else {
              // Balls: drift from scattered position back to base
              mesh.scale.setScalar(0.4 + 0.6 * eased);
              const dx = mesh.userData.driftX as number;
              const dy = mesh.userData.driftY as number;
              const dz = mesh.userData.driftZ as number;
              const remaining = 1 - eased;
              mesh.position.x = (mesh.userData.baseX as number) + remaining * dx;
              mesh.position.y = (mesh.userData.baseY as number) + remaining * dy;
              mesh.position.z = (mesh.userData.baseZ as number) + remaining * dz;
              mesh.rotation.x += (mesh.userData.spinSpeed as number) * 0.02 * remaining;
              mesh.rotation.z += (mesh.userData.spinSpeed as number) * 0.015 * remaining;
            }
          }
        }

        if (progress >= 1) {
          assembled = true;
          for (const mesh of allMeshes) {
            const material = mesh.material as THREE.MeshPhysicalMaterial;
            material.opacity = 1;
            mesh.scale.setScalar(1);
            if (!mesh.userData.isBond) {
              mesh.position.set(
                mesh.userData.baseX as number,
                mesh.userData.baseY as number,
                mesh.userData.baseZ as number,
              );
            }
          }
        }
      }

      // ── EXIT: dissolve particles bottom-to-top ──
      if (dissolvingRef.current && !allGone) {
        const elapsed = performance.now() - dissolveStartRef.current;
        const progress = Math.min(1, elapsed / DISSOLVE_DURATION);

        for (const mesh of allMeshes) {
          const ny = mesh.userData.normalizedY as number;
          const jitter = mesh.userData.delayJitter as number;
          const fadeStart = ny * 0.85 + jitter;
          const fadeDuration = 0.2;
          const linearProgress = Math.max(0, Math.min(1, (progress - fadeStart) / fadeDuration));

          if (linearProgress > 0) {
            const p = linearProgress;
            const eased = 1 - Math.pow(1 - p, 3);
            const opacityEased = p * p;

            const material = mesh.material as THREE.MeshPhysicalMaterial;
            material.opacity = 1 - opacityEased;
            mesh.scale.setScalar(1 - eased * 0.6);

            const dx = mesh.userData.driftX as number;
            const dy = mesh.userData.driftY as number;
            const dz = mesh.userData.driftZ as number;
            mesh.position.x = (mesh.userData.baseX as number) + eased * dx;
            mesh.position.y = (mesh.userData.baseY as number) + eased * dy;
            mesh.position.z = (mesh.userData.baseZ as number) + eased * dz;

            mesh.rotation.x += (mesh.userData.spinSpeed as number) * 0.02;
            mesh.rotation.z += (mesh.userData.spinSpeed as number) * 0.015;
          }
          if (linearProgress >= 1) {
            mesh.visible = false;
          }
        }

        if (progress >= 0.5 && !callbackFired) {
          callbackFired = true;
          onCompleteRef.current?.();
        }

        if (progress >= 1) {
          allGone = true;
        }
      }

      renderer.render(scene, cam);
    };
    animate();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      group.clear();
      geos.forEach((g) => g.dispose());
      bondGeo.dispose();
      mats.forEach((m) => m.dispose());
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, opacity: 0.8, transition: "opacity 0.5s ease" }} aria-hidden="true" />;
}

interface HeroSectionProps {
  dissolving: boolean;
  fading: boolean;
  onBegin: () => void;
  onDissolveComplete: () => void;
}

export function HeroSection({ dissolving, fading, onBegin, onDissolveComplete }: HeroSectionProps) {
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(t);
  }, []);

  const entranceStyle = (delayMs: number): React.CSSProperties => ({
    opacity: entered && !fading ? 1 : 0,
    filter: entered && !fading ? "none" : "blur(8px)",
    transform: entered && !fading ? "none" : fading ? "translateY(-16px) scale(0.98)" : "translateY(22px) scale(0.97)",
    transition: `opacity 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) ${delayMs}ms, filter 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) ${delayMs}ms, transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) ${delayMs}ms`,
  });

  const contentFadeStyle: React.CSSProperties = {
    transition: "opacity 1.3s cubic-bezier(0.22, 0.61, 0.36, 1), filter 1.3s cubic-bezier(0.22, 0.61, 0.36, 1), transform 1.3s cubic-bezier(0.22, 0.61, 0.36, 1)",
    opacity: fading ? 0 : 1,
    filter: fading ? "blur(6px)" : "none",
    transform: fading ? "translateY(-16px) scale(0.98)" : "none",
  };

  return (
    <section style={{
      position: "relative",
      minHeight: "100svh",
      overflow: "hidden",
      background: "var(--page-gradient)",
      fontFamily: "var(--font-sans)",
    }}>
      {/* DNA stays independent — keeps animating during text fade */}
      <DnaHelix dissolving={dissolving} onDissolveComplete={onDissolveComplete} />

      <div style={{ ...entranceStyle(0), position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(47,39,31,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(47,39,31,0.03) 1px, transparent 1px)", backgroundSize: "120px 120px", maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.82), transparent 92%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "linear-gradient(transparent, rgba(248,244,236,0.94))", pointerEvents: "none", zIndex: 5 }} />

      <header style={{
        ...entranceStyle(200),
        position: "relative", zIndex: 20,
        display: "flex", alignItems: "center",
        padding: "20px 40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <img src="/logo.png" alt="Praxis" style={{ height: 44, filter: "var(--logo-filter)" }} />
        </div>
      </header>

      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: 1200, margin: "0 auto",
        padding: "calc(18vh - 40px) 40px 0 60px",
      }}>
        <div style={{
          ...entranceStyle(500),
          display: "inline-block",
          padding: "6px 16px", marginBottom: 28,
          border: "1px solid var(--border)",
          borderRadius: 999,
          fontSize: "0.62rem", fontWeight: 500, fontFamily: "var(--font-mono)",
          color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
          backgroundColor: "var(--panel-glass)",
          backdropFilter: "blur(10px)",
        }}>
          Patient-Specific Surgical Simulation
        </div>

        <h1 style={{
          ...entranceStyle(750),
          fontSize: "clamp(3.4rem, 8vw, 6.6rem)",
          fontWeight: 600,
          lineHeight: 0.92,
          letterSpacing: "-0.06em",
          color: "var(--text-primary)",
          marginBottom: 20,
          fontFamily: "var(--font-serif)",
          maxWidth: 720,
        }}>
          Rehearse the procedure before the first incision.
        </h1>

        <p style={{
          ...entranceStyle(1000),
          fontSize: "1rem", lineHeight: 1.75,
          color: "var(--text-secondary)",
          maxWidth: 500, marginBottom: 36,
          fontFamily: "var(--font-sans)",
        }}>
          Upload patient imaging, reconstruct a 3D anatomy model, and simulate the intervention with hand tracking and AI-guided risk narration.
        </p>

        <button
          onClick={onBegin}
          style={{
            ...entranceStyle(1250),
            padding: "12px 26px", borderRadius: 999,
            border: "1px solid var(--accent)",
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent-light)",
            fontSize: "0.82rem", fontWeight: 600, fontFamily: "var(--font-sans)",
            backdropFilter: "blur(10px)",
          }}
        >
          Begin
        </button>
      </div>
    </section>
  );
}

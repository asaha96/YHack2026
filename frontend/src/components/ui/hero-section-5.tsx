import * as React from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";

function DnaHelix() {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(28, el.clientWidth / el.clientHeight, 0.1, 200);
    cam.position.set(3, 0.5, 11);
    cam.lookAt(0, 0, 0);

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

    // Thin spheres for the helix strands
    const geos = [
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.SphereGeometry(0.065, 7, 7),
      new THREE.SphereGeometry(0.045, 6, 6),
    ];
    const bondGeo = new THREE.SphereGeometry(0.035, 5, 5);
    const mats: THREE.Material[] = [];

    const mat = (color: number, rough: number) => {
      const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.02, clearcoat: 0.5, clearcoatRoughness: 0.15 });
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
    const radius = 1.2; // thinner radius
    const turns = 5;

    for (let i = 0; i < points; i++) {
      const t = i / points;
      const y = t * height - height / 2;
      const angle = t * Math.PI * 2 * turns;
      const left = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const right = new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);

      // Strand particles — fewer, smaller
      for (const pt of [left, right]) {
        const count = 6 + Math.floor(Math.random() * 4);
        for (let j = 0; j < count; j++) {
          const geo = geos[Math.floor(Math.random() * geos.length)];
          const spread = j < 2 ? 0 : 0.12;
          const mesh = new THREE.Mesh(geo, palette[Math.floor(Math.random() * palette.length)]());
          mesh.position.set(
            pt.x + (Math.random() - 0.5) * spread,
            pt.y + (Math.random() - 0.5) * spread * 0.4,
            pt.z + (Math.random() - 0.5) * spread,
          );
          group.add(mesh);
        }
      }

      // Rungs — thin cylinder bars connecting the two strands
      if (i % 3 === 0 && i > 0) {
        const dir = new THREE.Vector3().subVectors(right, left);
        const len = dir.length();
        const mid = new THREE.Vector3().lerpVectors(left, right, 0.5);
        const cylGeo = new THREE.CylinderGeometry(0.015, 0.015, len, 6, 1);
        const cylMat = mat(0x2dd4bf, 0.3);
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.copy(mid);
        // Orient cylinder along the rung direction
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        group.add(cyl);
      }
    }

    const resize = () => {
      cam.aspect = el.clientWidth / el.clientHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    resize();

    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.0012;
      group.rotation.y = t;
      group.rotation.x = 0.08 + Math.sin(t * 3) * 0.015;
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

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, opacity: 0.8 }} aria-hidden="true" />;
}

export function HeroSection() {
  return (
    <section style={{
      position: "relative",
      minHeight: "100svh",
      overflow: "hidden",
      backgroundColor: "var(--bg-primary)",
      fontFamily: "var(--font-sans)",
    }}>
      <DnaHelix />

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 220, background: "linear-gradient(transparent, var(--bg-primary))", pointerEvents: "none", zIndex: 5 }} />

      <header style={{
        position: "relative", zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px",
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
          <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Praxis
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#pipeline" style={{ padding: "7px 16px", borderRadius: 4, border: "1px solid var(--border)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 500, fontFamily: "var(--font-sans)", textDecoration: "none" }}>
            How it works
          </a>
          <Link to="/app" style={{ padding: "7px 16px", borderRadius: 4, border: "1px solid var(--accent)", backgroundColor: "var(--accent-dim)", color: "var(--accent)", fontSize: "0.75rem", fontWeight: 500, fontFamily: "var(--font-sans)", textDecoration: "none" }}>
            Open Platform
          </Link>
        </div>
      </header>

      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: 1200, margin: "0 auto",
        padding: "calc(18vh - 40px) 40px 0 60px",
      }}>
        <div style={{
          display: "inline-block",
          padding: "4px 14px", marginBottom: 28,
          border: "1px solid var(--border)",
          borderRadius: 4,
          fontSize: "0.62rem", fontWeight: 500, fontFamily: "var(--font-mono)",
          color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase",
          backgroundColor: "rgba(10, 10, 12, 0.6)",
          backdropFilter: "blur(8px)",
        }}>
          Patient-Specific Surgical Simulation
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5.5vw, 4rem)",
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: "-0.05em",
          color: "var(--text-primary)",
          marginBottom: 20,
          fontFamily: "var(--font-sans)",
          maxWidth: 580,
        }}>
          Rehearse the procedure before the first incision.
        </h1>

        <p style={{
          fontSize: "0.95rem", lineHeight: 1.7,
          color: "var(--text-secondary)",
          maxWidth: 460, marginBottom: 36,
          fontFamily: "var(--font-sans)",
        }}>
          Upload patient imaging, reconstruct a 3D anatomy model, and simulate the intervention with hand tracking and AI-guided risk narration.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/app" style={{
            padding: "11px 26px", borderRadius: 4,
            border: "1px solid var(--accent)",
            backgroundColor: "var(--accent-dim)",
            color: "var(--accent)",
            fontSize: "0.82rem", fontWeight: 500, fontFamily: "var(--font-sans)",
            textDecoration: "none",
            backdropFilter: "blur(8px)",
          }}>
            Start simulation
          </Link>
          <a href="#pipeline" style={{
            padding: "11px 22px", borderRadius: 4,
            border: "1px solid var(--border)",
            backgroundColor: "rgba(10, 10, 12, 0.5)",
            color: "var(--text-muted)",
            fontSize: "0.82rem", fontWeight: 500, fontFamily: "var(--font-sans)",
            textDecoration: "none",
            backdropFilter: "blur(8px)",
          }}>
            See workflow
          </a>
        </div>
      </div>
    </section>
  );
}

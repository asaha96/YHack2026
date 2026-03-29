import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TUMOR_POSITION, TUMOR_RADIUS, SURGICAL_STEPS } from "../data/surgicalSequence";
import type { Modification } from "../utils/api";
import type { LayeredViewerHandle } from "./SplatAnatomyComposite";

interface Props {
  triggered: boolean;
  viewerRef: React.RefObject<LayeredViewerHandle | null>;
  playAnnotations: (mods: Modification[]) => void;
  onNarrate: (text: string) => void;
}

const COLORS = {
  tumor: 0x1a1a2e,
  tumorEmissive: 0x660022,
  danger: 0xef4444,
  safe: 0x34d399,
  clamp: 0xf59e0b,
  suture: 0xa78bfa,
  approach: 0x60a5fa,
  instrument: 0xc0c0c0,
};

// ── Step card data ──────────────────────────────────────────────────

interface StepCard {
  num: number;
  title: string;
  detail: string;
  color: string;
  delayMs: number;
}

const STEP_CARDS: StepCard[] = [
  {
    num: 1, title: "Tumor Identification",
    detail: "CT imaging reveals a 2.3cm renal mass on the upper pole of the right kidney. The mass is well-circumscribed with a clear fat plane — ideal for nephron-sparing partial nephrectomy.",
    color: "#ef4444", delayMs: 0,
  },
  {
    num: 2, title: "Surgical Approach",
    detail: "Planning a retroperitoneal laparoscopic approach. The arrow shows the optimal trajectory — lateral to the psoas muscle, avoiding the duodenum and IVC. Port placement at the 12th rib tip.",
    color: "#60a5fa", delayMs: 3500,
  },
  {
    num: 3, title: "Hilum Dissection",
    detail: "Identifying the renal hilum — renal artery, renal vein, and ureter must be individually isolated. The artery lies posterior to the vein. Careful dissection avoids injury to accessory vessels.",
    color: "#a78bfa", delayMs: 7000,
  },
  {
    num: 4, title: "Vascular Clamping",
    detail: "Bulldog clamp applied to the main renal artery. Warm ischemia time begins — target under 25 minutes. Mannitol administered pre-clamp for renal protection. Kidney should blanch uniformly.",
    color: "#f59e0b", delayMs: 10500,
  },
  {
    num: 5, title: "Resection Margin",
    detail: "Scoring the parenchyma with electrocautery at 5mm clear margin around the tumor. The dashed line shows the planned excision boundary. Intraoperative ultrasound confirms tumor depth and margin adequacy.",
    color: "#ef4444", delayMs: 14000,
  },
  {
    num: 6, title: "Mass Excision",
    detail: "Tumor excised en bloc with negative margins. Specimen sent for frozen section pathology. The collecting system is inspected — any entry points will require repair with 4-0 Vicryl before renorrhaphy.",
    color: "#34d399", delayMs: 17500,
  },
  {
    num: 7, title: "Renorrhaphy & Closure",
    detail: "Running suture closure of the renal defect using 2-0 V-Loc barbed suture over Surgicel bolsters. Inner layer seals the collecting system, outer layer achieves parenchymal hemostasis.",
    color: "#a78bfa", delayMs: 21000,
  },
  {
    num: 8, title: "Reperfusion Check",
    detail: "Bulldog clamp released — warm ischemia 18 minutes, within safe limits. Kidney reperfuses with good cortical color return. No active bleeding from the suture line. Estimated blood loss: 150cc.",
    color: "#34d399", delayMs: 24500,
  },
];

// ── Geometry helpers (all use mesh-based geometry, no thin lines) ────

/** Arrow: cylinder shaft + cone head. Self-lit via emissive. */
function makeArrow(from: THREE.Vector3, to: THREE.Vector3, color: number, radius = 2): THREE.Group {
  const g = new THREE.Group();
  const dir = to.clone().sub(from);
  const len = dir.length();
  dir.normalize();

  const shaftLen = len * 0.7;
  const headLen = len * 0.3;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, shaftLen, 8),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 }),
  );
  shaft.position.set(0, shaftLen / 2, 0);
  g.add(shaft);

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 2.5, headLen, 10),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.6 }),
  );
  head.position.set(0, shaftLen + headLen / 2, 0);
  g.add(head);

  g.position.copy(from);
  g.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  return g;
}

/** Glowing torus ring */
function makeRing(position: THREE.Vector3, radius: number, tubeRadius: number, color: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }),
  );
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

/** Thick dashed path using cylinder segments with gaps */
function makeDashedPath(points: THREE.Vector3[], color: number, radius = 1.5): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    if (i % 2 === 1) continue; // skip every other = gap
    const a = points[i], b = points[i + 1];
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, len, 6),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 }),
    );
    seg.position.copy(a.clone().lerp(b, 0.5));
    seg.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.add(seg);
  }
  return g;
}

/** X-mark with enclosing circle */
function makeXMark(position: THREE.Vector3, size: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.4 });
  [Math.PI / 4, -Math.PI / 4].forEach(angle => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, size * 2, 6), mat);
    bar.rotation.z = angle;
    g.add(bar);
  });
  g.add(new THREE.Mesh(
    new THREE.TorusGeometry(size, 1, 8, 32),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 }),
  ));
  g.position.copy(position);
  return g;
}

/** Checkmark from two cylinders + enclosing circle */
function makeCheckmark(position: THREE.Vector3, size: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5 });

  const short = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, size * 0.5, 6), mat);
  short.position.set(-size * 0.15, -size * 0.1, 0);
  short.rotation.z = Math.PI / 4;
  g.add(short);

  const long = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, size * 0.9, 6), mat);
  long.position.set(size * 0.2, size * 0.15, 0);
  long.rotation.z = -Math.PI / 6;
  g.add(long);

  g.add(new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.75, 0.8, 8, 32),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.5 }),
  ));
  g.position.copy(position);
  return g;
}

/** Soft glowing beacon sphere — marks where the camera is focusing */
function makeBeacon(position: THREE.Vector3, color: number, radius = 8): THREE.Group {
  const g = new THREE.Group();
  // Inner bright core
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.3, 12, 12),
    new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }),
  ));
  // Outer soft glow
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }),
  ));
  g.position.copy(position);
  g.name = "_beacon";
  return g;
}

// ── Component ────────────────────────────────────────────────────────

export default function SurgicalSimulation({ triggered, viewerRef, playAnnotations, onNarrate }: Props) {
  const hasPlayedRef = useRef(false);
  const tumorMeshRef = useRef<THREE.Mesh | null>(null);
  const surgicalObjectsRef = useRef<THREE.Object3D[]>([]);
  const narrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const objectTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animFramesRef = useRef<number[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  useEffect(() => {
    const check = setInterval(() => {
      const scene = viewerRef.current?.getScene();
      if (!scene || tumorMeshRef.current) return;
      clearInterval(check);
      const ag = scene.getObjectByName("anatomy");
      if (!ag) return;

      const geo = new THREE.SphereGeometry(TUMOR_RADIUS, 16, 16);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
        const noise = 1 + (Math.sin(x * 3 + y * 5) * Math.cos(z * 4 + x * 2)) * 0.15;
        posAttr.setXYZ(i, x * noise, y * noise, z * noise);
      }
      geo.computeVertexNormals();

      const tumor = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: COLORS.tumor, emissive: COLORS.tumorEmissive,
        emissiveIntensity: 0.5, transparent: true, opacity: 0.9, shininess: 30,
      }));
      tumor.position.set(...TUMOR_POSITION);
      tumor.name = "tumor_mass";
      tumor.frustumCulled = false;
      ag.add(tumor);
      tumorMeshRef.current = tumor;
    }, 500);
    return () => { clearInterval(check); cleanupAll(); };
  }, [viewerRef]);

  const cleanupAll = () => {
    animFramesRef.current.forEach(id => cancelAnimationFrame(id));
    animFramesRef.current = [];
    // Restore skin layer
    viewerRef.current?.restoreFromSurgery();
    if (tumorMeshRef.current) {
      tumorMeshRef.current.geometry.dispose();
      (tumorMeshRef.current.material as THREE.Material).dispose();
      tumorMeshRef.current.removeFromParent();
      tumorMeshRef.current = null;
    }
    surgicalObjectsRef.current.forEach(obj => {
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else (child.material as THREE.Material).dispose();
        }
      });
      obj.removeFromParent();
    });
    surgicalObjectsRef.current = [];
    narrationTimersRef.current.forEach(clearTimeout);
    objectTimersRef.current.forEach(clearTimeout);
  };

  /** Add a glowing beacon at a point — appears at showMs, fades out at hideMs */
  const addBeacon = (pos: THREE.Vector3, color: number, showMs: number, hideMs: number) => {
    const beacon = makeBeacon(pos, color);
    beacon.frustumCulled = false;
    beacon.visible = false;
    beacon.traverse(c => { c.frustumCulled = false; });
    const ag = viewerRef.current?.getScene()?.getObjectByName("anatomy");
    if (!ag) return;
    ag.add(beacon);
    surgicalObjectsRef.current.push(beacon);

    // Show with pulse-in
    objectTimersRef.current.push(setTimeout(() => {
      beacon.visible = true;
      beacon.scale.setScalar(0.01);
      const t0 = performance.now();
      function grow() {
        const p = Math.min((performance.now() - t0) / 400, 1);
        beacon.scale.setScalar(p * p * (3 - 2 * p));
        if (p < 1) requestAnimationFrame(grow);
      }
      grow();
    }, showMs));

    // Fade out
    objectTimersRef.current.push(setTimeout(() => {
      const t0 = performance.now();
      function fade() {
        const p = Math.min((performance.now() - t0) / 500, 1);
        beacon.scale.setScalar(1 - p);
        if (p < 1) requestAnimationFrame(fade);
        else { beacon.visible = false; }
      }
      fade();
    }, hideMs));
  };

  const addObj = (obj: THREE.Object3D, delayMs: number) => {
    const ag = viewerRef.current?.getScene()?.getObjectByName("anatomy");
    if (!ag) return;
    obj.frustumCulled = false;
    obj.visible = false;
    obj.traverse(c => { c.frustumCulled = false; });
    ag.add(obj);
    surgicalObjectsRef.current.push(obj);

    const timer = setTimeout(() => {
      obj.visible = true;
      obj.scale.setScalar(0.01);
      const t0 = performance.now();
      function pop() {
        const p = Math.min((performance.now() - t0) / 500, 1);
        obj.scale.setScalar(p * p * (3 - 2 * p)); // smoothstep
        if (p < 1) requestAnimationFrame(pop);
      }
      pop();
    }, delayMs);
    objectTimersRef.current.push(timer);
  };

  /** Orbit camera to view a point from a specific angle */
  const orbitTo = (point: [number, number, number], delayMs: number, dist: number, yaw: number, pitch: number, duration = 1400) => {
    const timer = setTimeout(() => {
      viewerRef.current?.orbitToPoint(point, dist, yaw, pitch, duration);
    }, delayMs);
    objectTimersRef.current.push(timer);
  };

  const createSurgicalObjects = () => {
    const tp = new THREE.Vector3(...TUMOR_POSITION);

    // ── Step 1 (0ms): Danger ring — thick red torus around tumor ──
    const dangerRing = makeRing(tp, TUMOR_RADIUS + 5, 2, COLORS.danger);
    addObj(dangerRing, 0);
    addBeacon(tp, COLORS.danger, 0, 3300);

    // Pulse animation on danger ring
    const pulseStart = performance.now() + 600;
    function pulse() {
      if (!dangerRing.parent) return;
      const t = performance.now() - pulseStart;
      const s = 1 + Math.sin(t * 0.004) * 0.12;
      dangerRing.scale.setScalar(s);
      (dangerRing.material as THREE.MeshPhongMaterial).opacity = 0.7 + Math.sin(t * 0.004) * 0.15;
      if (t < 28000) {
        const id = requestAnimationFrame(pulse);
        animFramesRef.current.push(id);
      }
    }
    objectTimersRef.current.push(setTimeout(() => {
      const id = requestAnimationFrame(pulse);
      animFramesRef.current.push(id);
    }, 600));

    // ── Step 2 (3500ms): Approach arrow — blue arrow pointing at tumor ──
    const approachFrom: [number, number, number] = [TUMOR_POSITION[0] - 45, TUMOR_POSITION[1] + 35, TUMOR_POSITION[2] - 20];
    const approachMid: [number, number, number] = [
      (approachFrom[0] + TUMOR_POSITION[0]) / 2,
      (approachFrom[1] + TUMOR_POSITION[1]) / 2,
      (approachFrom[2] + TUMOR_POSITION[2]) / 2,
    ];
    const approachArrow = makeArrow(
      new THREE.Vector3(...approachFrom), tp,
      COLORS.approach, 2.5,
    );
    addObj(approachArrow, 3500);
    addBeacon(tp, COLORS.approach, 3500, 6800);
    orbitTo(approachMid, 3300, 0.45, -0.6, -0.9);  // front-left, high

    // ── Step 3 (7000ms): Hilum arrow — purple arrow to hilum ──
    const hilumTarget: [number, number, number] = [80, -110, 890];
    const hilumArrow = makeArrow(
      new THREE.Vector3(hilumTarget[0] - 25, hilumTarget[1] - 20, hilumTarget[2] - 15),
      new THREE.Vector3(...hilumTarget),
      COLORS.suture, 2,
    );
    addObj(hilumArrow, 7000);
    addBeacon(new THREE.Vector3(...hilumTarget), COLORS.suture, 7000, 10300);
    orbitTo(hilumTarget, 6800, 0.45, 1.0, -0.1);  // right side, higher

    // ── Step 4 (10500ms): Vascular clamp — yellow X-mark ──
    const clampTarget: [number, number, number] = [50, -100, 880];
    const clampMark = makeXMark(new THREE.Vector3(...clampTarget), 10, COLORS.clamp);
    addObj(clampMark, 10500);
    addBeacon(new THREE.Vector3(...clampTarget), COLORS.clamp, 10500, 13800);
    orbitTo(clampTarget, 10300, 0.42, 0.9, -0.4);  // right, higher

    // ── Step 5 (14000ms): Resection margin — red dashed loop ──
    const marginPts = [
      [135, -68, 860], [140, -75, 870], [135, -85, 880],
      [120, -92, 885], [105, -88, 882], [100, -78, 872],
      [105, -68, 862], [120, -65, 858], [135, -68, 860],
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const margin = makeDashedPath(marginPts, COLORS.danger, 1.5);

    // Add dots at each margin vertex for visibility
    const dotMat = new THREE.MeshPhongMaterial({ color: COLORS.danger, emissive: COLORS.danger, emissiveIntensity: 0.4 });
    marginPts.forEach(p => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), dotMat);
      dot.position.copy(p);
      margin.add(dot);
    });
    addObj(margin, 14000);
    addBeacon(tp, COLORS.danger, 14000, 17300);
    orbitTo(TUMOR_POSITION, 13800, 0.48, -0.4, -1.0);  // front-left, high

    // ── Step 6 (17500ms): Checkmark — mass excised ──
    const checkTarget: [number, number, number] = [TUMOR_POSITION[0], TUMOR_POSITION[1], TUMOR_POSITION[2] + 18];
    const check = makeCheckmark(new THREE.Vector3(...checkTarget), 14, COLORS.safe);
    addObj(check, 17500);
    addBeacon(new THREE.Vector3(...checkTarget), COLORS.safe, 17500, 20800);
    orbitTo(checkTarget, 17300, 0.44, 0.3, -0.4);  // slight right, high

    // ── Step 7 (21000ms): Suture dots — closure ──
    const closureTarget: [number, number, number] = [115, -85, 875];
    const closurePt = new THREE.Vector3(...closureTarget);
    const sutureGroup = new THREE.Group();
    const sutureMat = new THREE.MeshPhongMaterial({ color: COLORS.suture, emissive: COLORS.suture, emissiveIntensity: 0.4 });
    for (let i = 0; i < 8; i++) {
      const t = i / 7 - 0.5;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), sutureMat);
      dot.position.set(
        closurePt.x + Math.sin(t * Math.PI) * 12,
        closurePt.y + t * 22,
        closurePt.z + Math.cos(t * Math.PI * 2) * 3,
      );
      sutureGroup.add(dot);
    }
    // Connect suture dots with thin cylinders (zigzag stitch look)
    for (let i = 0; i < 7; i++) {
      const a = sutureGroup.children[i].position;
      const b = sutureGroup.children[i + 1].position;
      const dir = b.clone().sub(a);
      const len = dir.length();
      dir.normalize();
      const stitch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, len, 4),
        new THREE.MeshPhongMaterial({ color: COLORS.suture, emissive: COLORS.suture, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 }),
      );
      stitch.position.copy(a.clone().lerp(b, 0.5));
      stitch.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      sutureGroup.add(stitch);
    }
    addObj(sutureGroup, 21000);
    addBeacon(closurePt, COLORS.suture, 21000, 24300);
    orbitTo(closureTarget, 20800, 0.44, -0.7, -0.8);  // front-left, high

    // ── Step 8 (24500ms): Reperfusion — green ring at hilum ──
    const finalRing = makeRing(new THREE.Vector3(...hilumTarget), 12, 2, COLORS.safe);
    addObj(finalRing, 24500);
    addBeacon(new THREE.Vector3(...hilumTarget), COLORS.safe, 24500, 28000);
    orbitTo(hilumTarget, 24300, 0.46, 0.6, -0.15);  // right, higher
  };

  useEffect(() => {
    if (!triggered || hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Hide skin so internal structures are visible
    viewerRef.current?.hideForSurgery();

    viewerRef.current?.zoomToAnatomyPoint(TUMOR_POSITION, 0.35, 1500);

    narrationTimersRef.current.forEach(clearTimeout);
    narrationTimersRef.current = SURGICAL_STEPS.map(step => {
      const delay = step.modification.delay_ms ?? 0;
      return setTimeout(() => onNarrate(step.narration), delay);
    });

    createSurgicalObjects();

    // Schedule step card transitions
    STEP_CARDS.forEach(card => {
      objectTimersRef.current.push(setTimeout(() => setActiveStep(card.num), card.delayMs));
    });

    const lastDelay = Math.max(...SURGICAL_STEPS.map(s => (s.modification.delay_ms ?? 0) + (s.modification.duration_ms ?? 0)));

    // Smooth outro: pull camera back to full body, fade layers in, then cleanup
    objectTimersRef.current.push(setTimeout(() => {
      setActiveStep(null);
      const bodyCenter: [number, number, number] = [0, -50, 500];
      viewerRef.current?.orbitToPoint(bodyCenter, 1.2, 0, 0.15, 2500);
    }, lastDelay + 1000));

    objectTimersRef.current.push(setTimeout(() => {
      viewerRef.current?.fadeRestoreLayers(2000);
    }, lastDelay + 2500));

    objectTimersRef.current.push(setTimeout(() => {
      cleanupAll();
    }, lastDelay + 5000));
  }, [triggered, viewerRef, playAnnotations, onNarrate]);

  // ── Step card overlay ──
  const card = STEP_CARDS.find(c => c.num === activeStep);

  return card ? (
    <div
      key={card.num}
      style={{
        position: "absolute",
        top: 80,
        right: 16,
        width: 300,
        background: "rgba(10, 10, 18, 0.88)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${card.color}44`,
        borderLeft: `3px solid ${card.color}`,
        borderRadius: 12,
        padding: "16px 18px",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        animation: "stepCardIn 0.4s ease-out",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: card.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {card.num}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>
          {card.title}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.4)",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 500,
        }}>
          {card.num}/{STEP_CARDS.length}
        </div>
      </div>
      <div style={{
        fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.7)",
        fontWeight: 400,
      }}>
        {card.detail}
      </div>
      {/* Progress dots */}
      <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
        {STEP_CARDS.map(s => (
          <div
            key={s.num}
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: s.num === card.num ? card.color : s.num < card.num ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    </div>
  ) : null;
}

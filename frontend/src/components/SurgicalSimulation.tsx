import { useEffect, useRef } from "react";
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

// Colors for surgical visualization
const COLORS = {
  tumor: 0x1a1a2e,
  tumorEmissive: 0x660022,
  clamp: 0xf59e0b,
  safe: 0x34d399,
  danger: 0xef4444,
  instrument: 0xc0c0c0,
  suture: 0xa78bfa,
};

export default function SurgicalSimulation({ triggered, viewerRef, playAnnotations, onNarrate }: Props) {
  const hasPlayedRef = useRef(false);
  const tumorMeshRef = useRef<THREE.Mesh | null>(null);
  const surgicalObjectsRef = useRef<THREE.Object3D[]>([]);
  const narrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const objectTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Add tumor mesh to the scene on mount ──────────────────────────
  useEffect(() => {
    const check = setInterval(() => {
      const scene = viewerRef.current?.getScene();
      if (!scene || tumorMeshRef.current) return;
      clearInterval(check);

      const anatomyGroup = scene.getObjectByName("anatomy");
      if (!anatomyGroup) return;

      // Create tumor — irregular dark mass with pulsing glow
      const geo = new THREE.SphereGeometry(TUMOR_RADIUS, 16, 16);
      // Distort vertices slightly for organic look
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const noise = 1 + (Math.sin(x * 3 + y * 5) * Math.cos(z * 4 + x * 2)) * 0.15;
        posAttr.setXYZ(i, x * noise, y * noise, z * noise);
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhongMaterial({
        color: COLORS.tumor,
        emissive: COLORS.tumorEmissive,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
        shininess: 30,
      });
      const tumor = new THREE.Mesh(geo, mat);
      tumor.position.set(...TUMOR_POSITION);
      tumor.name = "tumor_mass";
      tumor.frustumCulled = false;
      anatomyGroup.add(tumor);
      tumorMeshRef.current = tumor;
    }, 500);

    return () => {
      clearInterval(check);
      cleanupAll();
    };
  }, [viewerRef]);

  const cleanupAll = () => {
    if (tumorMeshRef.current) {
      tumorMeshRef.current.geometry.dispose();
      (tumorMeshRef.current.material as THREE.Material).dispose();
      tumorMeshRef.current.removeFromParent();
      tumorMeshRef.current = null;
    }
    surgicalObjectsRef.current.forEach((obj) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else (child.material as THREE.Material).dispose();
        }
      });
      obj.removeFromParent();
    });
    surgicalObjectsRef.current = [];
    narrationTimersRef.current.forEach(clearTimeout);
    objectTimersRef.current.forEach(clearTimeout);
  };

  // ── Helper: add a 3D object to the anatomy group with delay ───────
  const addSurgicalObject = (obj: THREE.Object3D, delayMs: number) => {
    const scene = viewerRef.current?.getScene();
    const anatomyGroup = scene?.getObjectByName("anatomy");
    if (!anatomyGroup) return;

    obj.frustumCulled = false;
    obj.visible = false;
    obj.traverse((child) => { child.frustumCulled = false; });
    anatomyGroup.add(obj);
    surgicalObjectsRef.current.push(obj);

    // Fade in after delay
    const timer = setTimeout(() => {
      obj.visible = true;
      // Scale-in animation
      obj.scale.setScalar(0.01);
      const startTime = performance.now();
      function scaleIn() {
        const t = Math.min((performance.now() - startTime) / 600, 1);
        const ease = t * t * (3 - 2 * t);
        obj.scale.setScalar(ease);
        if (t < 1) requestAnimationFrame(scaleIn);
      }
      scaleIn();
    }, delayMs);
    objectTimersRef.current.push(timer);
  };

  // ── Create surgical visualization objects ─────────────────────────
  const createSurgicalObjects = () => {
    // 1. Tumor highlight ring (pulsing red ring around the tumor)
    const ringGeo = new THREE.TorusGeometry(TUMOR_RADIUS + 4, 1.5, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.danger, transparent: true, opacity: 0.7 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(...TUMOR_POSITION);
    ring.rotation.x = Math.PI / 2;
    addSurgicalObject(ring, 0);

    // 2. Kidney isolation boundary — translucent dome over the kidney area
    const domeGeo = new THREE.SphereGeometry(50, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(110, -100, 900);
    dome.rotation.x = Math.PI;
    addSurgicalObject(dome, 3500);

    // 3. Hilum marker — small crossed rods indicating the vascular pedicle
    const hilumGroup = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(1, 1, 20, 6);
    const rodMat = new THREE.MeshPhongMaterial({ color: 0x818cf8, emissive: 0x4433aa, emissiveIntensity: 0.3 });
    const rod1 = new THREE.Mesh(rodGeo, rodMat);
    rod1.rotation.z = Math.PI / 4;
    const rod2 = new THREE.Mesh(rodGeo, rodMat.clone());
    rod2.rotation.z = -Math.PI / 4;
    hilumGroup.add(rod1, rod2);
    hilumGroup.position.set(80, -110, 890);
    addSurgicalObject(hilumGroup, 7000);

    // 4. Arterial clamp — small yellow clamp shape
    const clampGroup = new THREE.Group();
    const jawGeo = new THREE.BoxGeometry(4, 12, 2);
    const jawMat = new THREE.MeshPhongMaterial({ color: COLORS.clamp, emissive: COLORS.clamp, emissiveIntensity: 0.2 });
    const jaw1 = new THREE.Mesh(jawGeo, jawMat);
    jaw1.position.x = -3;
    const jaw2 = new THREE.Mesh(jawGeo, jawMat.clone());
    jaw2.position.x = 3;
    const handleGeo = new THREE.CylinderGeometry(1, 1, 16, 6);
    const handleMat = new THREE.MeshPhongMaterial({ color: COLORS.instrument });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.y = -8;
    clampGroup.add(jaw1, jaw2, handle);
    clampGroup.position.set(50, -100, 880);
    addSurgicalObject(clampGroup, 10500);

    // 5. Resection margin glow — ring of small glowing dots around the tumor
    const dotCount = 16;
    const marginGroup = new THREE.Group();
    const marginRadius = TUMOR_RADIUS + 8;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      const dotGeo = new THREE.SphereGeometry(1.5, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: COLORS.danger, transparent: true, opacity: 0.8 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(
        Math.cos(angle) * marginRadius,
        Math.sin(angle) * marginRadius * 0.6,
        0,
      );
      marginGroup.add(dot);
    }
    marginGroup.position.set(...TUMOR_POSITION);
    addSurgicalObject(marginGroup, 14000);

    // 6. Excision indicator — green checkmark-like shape replacing tumor
    const checkGroup = new THREE.Group();
    const checkPts = [
      new THREE.Vector3(-8, 0, 0),
      new THREE.Vector3(-2, -8, 0),
      new THREE.Vector3(10, 8, 0),
    ];
    const checkGeo = new THREE.BufferGeometry().setFromPoints(checkPts);
    const checkMat = new THREE.LineBasicMaterial({ color: COLORS.safe, linewidth: 3 });
    const checkLine = new THREE.Line(checkGeo, checkMat);
    checkGroup.add(checkLine);
    checkGroup.position.set(TUMOR_POSITION[0], TUMOR_POSITION[1], TUMOR_POSITION[2] + 15);
    addSurgicalObject(checkGroup, 17500);

    // 7. Suture line — curved line across the defect
    const suturePts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = TUMOR_POSITION[0] + Math.sin(t * Math.PI) * 14 - 7;
      const y = TUMOR_POSITION[1] + (t - 0.5) * 20;
      const z = TUMOR_POSITION[2] + Math.cos(t * Math.PI * 3) * 2; // zigzag for suture look
      suturePts.push(new THREE.Vector3(x, y, z));
    }
    const sutureGeo = new THREE.BufferGeometry().setFromPoints(suturePts);
    const sutureMat = new THREE.LineBasicMaterial({ color: COLORS.suture });
    const sutureLine = new THREE.Line(sutureGeo, sutureMat);
    addSurgicalObject(sutureLine, 21000);

    // 8. Reperfusion glow — green pulsing light at the hilum
    const perfLight = new THREE.PointLight(COLORS.safe, 2, 80);
    perfLight.position.set(80, -110, 890);
    addSurgicalObject(perfLight, 24500);
  };

  // ── Trigger simulation on first pinch release ─────────────────────
  useEffect(() => {
    if (!triggered || hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // 1. Zoom camera to the kidney/tumor area
    viewerRef.current?.zoomToAnatomyPoint(TUMOR_POSITION, 0.15, 1500);

    // 2. Fire annotations through existing system
    const mods = SURGICAL_STEPS.map((step) => step.modification);
    playAnnotations(mods);

    // 3. Schedule narration for each step
    narrationTimersRef.current.forEach(clearTimeout);
    narrationTimersRef.current = SURGICAL_STEPS.map((step) => {
      const delay = step.modification.delay_ms ?? 0;
      return setTimeout(() => onNarrate(step.narration), delay);
    });

    // 4. Create 3D surgical objects that animate in with each step
    createSurgicalObjects();

    // 5. Clean up surgical objects after the last step finishes
    const lastDelay = Math.max(...SURGICAL_STEPS.map(s => (s.modification.delay_ms ?? 0) + (s.modification.duration_ms ?? 0)));
    const cleanupTimer = setTimeout(() => {
      cleanupAll();
    }, lastDelay + 3000);
    objectTimersRef.current.push(cleanupTimer);
  }, [triggered, viewerRef, playAnnotations, onNarrate]);

  return null;
}

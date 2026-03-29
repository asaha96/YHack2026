import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { AnatomyLayer } from "./InteractiveVideoOverlay";
import { getRigPairForPart, getSpineFraction } from "../utils/poseRigMaps";
import {
  buildPosePointMap,
  buildTorsoFrame,
  torsoQuaternion,
  type PoseLandmark,
  type TorsoFrame,
} from "../utils/torsoFrame";
import { smoothTorsoFrame, smoothVectorMap } from "../utils/smoothing";
import {
  opacityForDepth,
  projectPlacementToWorld,
  resolveLocalPlacement,
  spineDepth01,
  type LocalPlacement,
} from "../utils/organPlacement";

interface LayersFile {
  layers: Record<
    string,
    {
      parts: { name: string; file: string }[];
    }
  >;
}

const MESH_COLORS: Record<string, number> = {
  skin: 0xe8beaa,
  muscles: 0xc94040,
  skeleton: 0xf5f0e8,
  organs: 0xcc7766,
  vascular: 0x4466cc,
};

const MESH_OPACITY: Record<string, number> = {
  skin: 0.08,
  muscles: 0.22,
  skeleton: 0.35,
  organs: 0.4,
  vascular: 0.32,
};

const OVERLAY_BODY_NORM = 1.35;
const LANDMARK_ALPHA = 0.35;
const TORSO_ALPHA = 0.24;
const ARM_INWARD_ROTATION = 0.1;
const HIGHLIGHT = new THREE.Color("#22d3ee");
const BLACK = new THREE.Color(0x000000);

function meshMaxExtent(box: THREE.Box3): number {
  const sz = box.getSize(new THREE.Vector3());
  return Math.max(sz.x, sz.y, sz.z, 1e-8);
}

function restDirFromBox(box: THREE.Box3): THREE.Vector3 {
  const sz = box.getSize(new THREE.Vector3());
  let best = new THREE.Vector3(sz.x, 0, 0);
  if (sz.y >= sz.x && sz.y >= sz.z) best.set(0, sz.y, 0);
  if (sz.z >= sz.x && sz.z >= sz.y) best.set(0, 0, sz.z);
  return best.normalize();
}

function getAngleQuat(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
  const a = from.clone();
  const b = to.clone();
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) {
    return new THREE.Quaternion();
  }
  a.normalize();
  b.normalize();
  return new THREE.Quaternion().setFromUnitVectors(a, b);
}

function classifyKind(name: string): "segment" | "spine" | "torso" {
  if (getRigPairForPart(name)) return "segment";
  if (getSpineFraction(name) !== undefined && name !== "sacrum") return "spine";
  return "torso";
}

type RiggedEntry = {
  mesh: THREE.Mesh;
  name: string;
  layer: AnatomyLayer;
  kind: "segment" | "spine" | "torso";
  restCenter: THREE.Vector3;
  restDir: THREE.Vector3;
  restBoneLength: number;
  baseOpacity: number;
  pair?: [string, string];
  spineFrac?: number;
  localPlacement: LocalPlacement;
};

interface Props {
  landmarks: PoseLandmark[] | null;
  width: number;
  height: number;
  visibleLayers: Set<AnatomyLayer>;
  enabled: boolean;
  selectedStructure?: string | null;
  scaleMultiplier?: number;
  yOffset?: number;
  onSelectStructure?: (name: string) => void;
}

export default function PoseRiggedAnatomy({
  landmarks,
  width,
  height,
  visibleLayers,
  enabled,
  selectedStructure = null,
  scaleMultiplier = 1,
  yOffset = 0,
  onSelectStructure,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const riggedMapRef = useRef<Map<string, RiggedEntry>>(new Map());
  const pickableMeshesRef = useRef<THREE.Mesh[]>([]);
  const landmarksRef = useRef<PoseLandmark[] | null>(null);
  const smoothedPointsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const smoothedFrameRef = useRef<TorsoFrame | null>(null);
  const rafRef = useRef<number>(0);

  landmarksRef.current = landmarks;

  useEffect(() => {
    for (const entry of riggedMapRef.current.values()) {
      const mat = entry.mesh.material;
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const active = entry.name === selectedStructure;
      mat.emissive.copy(active ? HIGHLIGHT : BLACK);
      mat.emissiveIntensity = active ? 1.2 : 0;
    }
  }, [selectedStructure]);

  useEffect(() => {
    if (!enabled || width < 16 || height < 16) return;

    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setLoadError(null);
    smoothedPointsRef.current = new Map();
    smoothedFrameRef.current = null;

    const scene = new THREE.Scene();
    const aspect = width / Math.max(height, 1);
    const camera = new THREE.OrthographicCamera(
      -aspect,
      aspect,
      1,
      -1,
      0.01,
      20
    );
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.sortObjects = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);
    pickableMeshesRef.current = [];

    scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(0.3, 0.4, 1.3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.32);
    fill.position.set(-0.4, -0.1, 0.8);
    scene.add(fill);

    const loader = new OBJLoader();
    const riggedMap = new Map<string, RiggedEntry>();
    riggedMapRef.current = riggedMap;

    let aborted = false;
    const boxTool = new THREE.Box3();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (ev: PointerEvent) => {
      if (!onSelectStructure) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickableMeshesRef.current, false);
      const hit = hits.find((item) => item.object instanceof THREE.Mesh);
      if (hit?.object instanceof THREE.Mesh && hit.object.name) {
        onSelectStructure(hit.object.name);
      }
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    (async () => {
      try {
        const res = await fetch("/models/anatomy/layers.json");
        const data: LayersFile = await res.json();
        const loadedMeshes: { mesh: THREE.Mesh; name: string; layer: AnatomyLayer }[] = [];

        for (const [layerName, layerData] of Object.entries(data.layers)) {
          if (!visibleLayers.has(layerName as AnatomyLayer)) continue;

          for (const part of layerData.parts) {
            if (aborted) return;
            try {
              const text = await fetch(`/models/${part.file}`).then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.text();
              });
              const obj = loader.parse(text);
              const opacity = MESH_OPACITY[layerName] ?? 0.35;
              const color = MESH_COLORS[layerName] ?? 0xaaaaaa;

              obj.traverse((ch) => {
                if (!(ch instanceof THREE.Mesh)) return;
                const geom = ch.geometry as THREE.BufferGeometry;
                geom.computeBoundingBox();
                const mat = new THREE.MeshStandardMaterial({
                  color,
                  transparent: true,
                  opacity,
                  depthWrite: layerName !== "vascular" && opacity > 0.25,
                  metalness: 0.04,
                  roughness: 0.86,
                  side: THREE.DoubleSide,
                });
                if (layerName === "vascular") {
                  mat.blending = THREE.AdditiveBlending;
                  mat.depthWrite = false;
                }
                ch.material = mat;
                ch.name = part.name;
                loadedMeshes.push({
                  mesh: ch,
                  name: part.name,
                  layer: layerName as AnatomyLayer,
                });
                pickableMeshesRef.current.push(ch);
              });
            } catch {
              /* skip missing */
            }
          }
        }

        if (aborted) return;

        const union = new THREE.Box3();
        for (const { mesh } of loadedMeshes) {
          union.union(boxTool.setFromObject(mesh));
        }

        const uSize = union.getSize(new THREE.Vector3());
        const gScale = OVERLAY_BODY_NORM / Math.max(uSize.x, uSize.y, uSize.z, 1e-6);
        for (const { mesh } of loadedMeshes) {
          const geom = mesh.geometry as THREE.BufferGeometry;
          geom.scale(gScale, gScale, gScale);
          geom.computeBoundingBox();
        }

        const unionPre = new THREE.Box3();
        for (const { mesh } of loadedMeshes) {
          unionPre.union(boxTool.setFromObject(mesh));
        }
        const preSize = unionPre.getSize(new THREE.Vector3());
        if (preSize.z >= preSize.x && preSize.z >= preSize.y) {
          for (const { mesh } of loadedMeshes) {
            const geom = mesh.geometry as THREE.BufferGeometry;
            geom.rotateX(-Math.PI / 2);
            geom.computeBoundingBox();
          }
        }

        const torsoRefBox = new THREE.Box3();
        for (const { mesh, name } of loadedMeshes) {
          if (classifyKind(name) !== "segment") {
            torsoRefBox.union(boxTool.setFromObject(mesh));
          }
        }
        const torsoSize = torsoRefBox.getSize(new THREE.Vector3());
        const torsoCenter = torsoRefBox.getCenter(new THREE.Vector3());

        for (const { mesh, name, layer } of loadedMeshes) {
          boxTool.setFromObject(mesh);
          const restCenter = boxTool.getCenter(new THREE.Vector3());
          const restDir = restDirFromBox(boxTool);
          const restBoneLength = meshMaxExtent(boxTool);
          const kind = classifyKind(name);
          const fallbackPlacement: LocalPlacement = {
            x: (restCenter.x - torsoCenter.x) / Math.max(torsoSize.x, 1e-6),
            y: (restCenter.y - torsoRefBox.min.y) / Math.max(torsoSize.y, 1e-6),
            z: (restCenter.z - torsoRefBox.min.z) / Math.max(torsoSize.z, 1e-6),
            scale: restBoneLength / Math.max(torsoSize.y, 1e-6),
          };

          riggedMap.set(name, {
            mesh,
            name,
            layer,
            kind,
            restCenter,
            restDir,
            restBoneLength,
            baseOpacity: MESH_OPACITY[layer] ?? 0.35,
            pair: getRigPairForPart(name),
            spineFrac: getSpineFraction(name),
            localPlacement: resolveLocalPlacement(name, fallbackPlacement),
          });
          scene.add(mesh);
        }

        setLoading(false);
      } catch (e) {
        if (!aborted) {
          setLoadError(e instanceof Error ? e.message : "load failed");
          setLoading(false);
        }
      }
    })();

    const tick = () => {
      if (aborted) return;
      rafRef.current = requestAnimationFrame(tick);

      const lm = landmarksRef.current;
      if (!lm || lm.length === 0) {
        for (const entry of riggedMapRef.current.values()) {
          entry.mesh.visible = false;
        }
        renderer.render(scene, camera);
        return;
      }

      const liveAspect = width / Math.max(height, 1);
      const rawPoints = buildPosePointMap(lm, liveAspect);
      smoothedPointsRef.current = smoothVectorMap(
        smoothedPointsRef.current,
        rawPoints,
        LANDMARK_ALPHA
      );

      const frame = buildTorsoFrame(smoothedPointsRef.current);
      if (!frame) {
        for (const entry of riggedMapRef.current.values()) {
          entry.mesh.visible = false;
        }
        renderer.render(scene, camera);
        return;
      }

      smoothedFrameRef.current = smoothTorsoFrame(
        smoothedFrameRef.current,
        frame,
        TORSO_ALPHA
      );
      const liveFrame = smoothedFrameRef.current;
      const adjustedFrame: TorsoFrame = {
        ...liveFrame,
        origin: liveFrame.origin.clone().add(new THREE.Vector3(0, yOffset, 0)),
        hipCenter: liveFrame.hipCenter.clone().add(new THREE.Vector3(0, yOffset, 0)),
        shoulderCenter: liveFrame.shoulderCenter.clone().add(new THREE.Vector3(0, yOffset, 0)),
        torsoCenter: liveFrame.torsoCenter.clone().add(new THREE.Vector3(0, yOffset, 0)),
        width: liveFrame.width * scaleMultiplier,
        height: liveFrame.height * scaleMultiplier,
        depth: liveFrame.depth * scaleMultiplier,
      };
      const torsoRot = torsoQuaternion(adjustedFrame);

      for (const entry of riggedMapRef.current.values()) {
        const mat = entry.mesh.material;
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;

        entry.mesh.visible = true;

        if (entry.kind === "segment" && entry.pair) {
          const pA = smoothedPointsRef.current.get(entry.pair[0]);
          const pB = smoothedPointsRef.current.get(entry.pair[1]);
          if (!pA || !pB) {
            entry.mesh.visible = false;
            continue;
          }

          const start = pA.clone().add(new THREE.Vector3(0, yOffset, 0));
          const end = pB.clone().add(new THREE.Vector3(0, yOffset, 0));
          const mid = start.clone().add(end).multiplyScalar(0.5);
          const seg = end.clone().sub(start);
          const length = Math.max(seg.length() * scaleMultiplier, 1e-4);
          const dir = seg.normalize();
          const q = getAngleQuat(entry.restDir, dir);

          if (
            entry.name.includes("humerus") ||
            entry.name.includes("radius") ||
            entry.name.includes("ulna")
          ) {
            const inward = new THREE.Quaternion().setFromAxisAngle(
              adjustedFrame.yAxis,
              entry.name.startsWith("left_") ? ARM_INWARD_ROTATION : -ARM_INWARD_ROTATION
            );
            q.multiply(inward);
          }

          let s = length / Math.max(entry.restBoneLength, 1e-6);
          s *= THREE.MathUtils.clamp(adjustedFrame.width / 0.7, 0.9, 1.12);
          const pos = mid.clone().sub(
            entry.restCenter.clone().applyQuaternion(q).multiplyScalar(s)
          );

          entry.mesh.position.copy(pos);
          entry.mesh.quaternion.copy(q);
          entry.mesh.scale.setScalar(s);
          entry.mesh.renderOrder = 100;
          mat.opacity = entry.baseOpacity;
          continue;
        }

        if (entry.kind === "spine" && entry.spineFrac !== undefined) {
          const y = 1 - entry.spineFrac;
          const z = spineDepth01(entry.spineFrac);
          const here = projectPlacementToWorld(
            adjustedFrame,
            { x: 0, y, z, scale: 0.06 },
            1
          );
          const ahead = projectPlacementToWorld(
            adjustedFrame,
            { x: 0, y: y - 0.03, z: spineDepth01(entry.spineFrac + 0.03), scale: 0.06 },
            1
          );
          const tangent = ahead.position.clone().sub(here.position).normalize();
          const q = getAngleQuat(entry.restDir, tangent);
          const s = Math.max(here.scale / Math.max(entry.restBoneLength, 1e-6), 0.03);
          const pos = here.position.clone().sub(
            entry.restCenter.clone().applyQuaternion(q).multiplyScalar(s)
          );

          entry.mesh.position.copy(pos);
          entry.mesh.quaternion.copy(q);
          entry.mesh.scale.setScalar(s);
          entry.mesh.renderOrder = 200 + Math.round(here.depth01 * 100);
          mat.opacity = opacityForDepth(entry.baseOpacity, here.depth01);
          continue;
        }

        const world = projectPlacementToWorld(adjustedFrame, entry.localPlacement, 1);
        const q = torsoRot.clone();
        const s = Math.max(world.scale / Math.max(entry.restBoneLength, 1e-6), 0.02);
        const pos = world.position.clone().sub(
          entry.restCenter.clone().applyQuaternion(q).multiplyScalar(s)
        );

        entry.mesh.position.copy(pos);
        entry.mesh.quaternion.copy(q);
        entry.mesh.scale.setScalar(s);
        entry.mesh.renderOrder = 300 + Math.round(world.depth01 * 100);
        mat.opacity = opacityForDepth(entry.baseOpacity, world.depth01);
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      aborted = true;
      cancelAnimationFrame(rafRef.current);
      riggedMapRef.current.clear();
      pickableMeshesRef.current = [];
      smoothedPointsRef.current = new Map();
      smoothedFrameRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    enabled,
    height,
    onSelectStructure,
    scaleMultiplier,
    visibleLayers,
    width,
    yOffset,
  ]);

  useEffect(() => {
    const cam = cameraRef.current;
    const rend = rendererRef.current;
    if (!cam || !rend) return;
    const aspect = width / Math.max(height, 1);
    cam.left = -aspect;
    cam.right = aspect;
    cam.top = 1;
    cam.bottom = -1;
    cam.updateProjectionMatrix();
    rend.setSize(width, height);
  }, [height, width]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
      }}
    >
      {(loading || loadError) && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 10,
            color: loadError ? "#f87171" : "rgba(255,255,255,0.5)",
            fontFamily: "'JetBrains Mono', monospace",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {loadError ?? (loading ? "Loading 3D anatomy..." : "")}
        </div>
      )}
    </div>
  );
}

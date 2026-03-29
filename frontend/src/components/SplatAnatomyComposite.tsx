import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { getWorld, selectSpzUrl } from "../utils/worldlabs";
import type { Modification } from "../utils/api";

// ── Constants ───────────────────────────────────────────────────────────
const LAYER_ORDER = ["skin", "muscles", "nervous", "organs", "vascular", "skeleton"];
const LAYER_COLORS: Record<string, number> = {
  skin: 0xe8beaa, muscles: 0xc94040, skeleton: 0xf5f0e8, organs: 0xcc7766, vascular: 0x4466cc, nervous: 0xf0d060,
};
const LAYER_OPACITY: Record<string, number> = {
  skin: 0.25, muscles: 0.6, skeleton: 0.9, organs: 0.85, vascular: 0.75, nervous: 0.85,
};

// Default scale & offset to place anatomy inside the splat world
const DEFAULT_SCALE = 0.0006;
const DEFAULT_OFFSET = { x: 0, y: 0.5, z: 0.85 };
const SHOW_PLACEMENT_UI = false;
const SHOW_CAMERA_DEBUG = false;

// WASD + Space/Shift movement speed
const MOVE_SPEED = 0.02;
const MOVE_KEYS = new Set(["w", "a", "s", "d", " ", "shift"]);

// ── Types ───────────────────────────────────────────────────────────────
interface LayersMetadata {
  layers: Record<string, {
    label: string; color: string; visible: boolean;
    parts: { name: string; file: string; fma_id: string; label: string }[];
  }>;
}

interface Props {
  worldId?: string;
  onOrganClick: (organName: string, point: number[], normal: number[]) => void;
  onIncisionTrace: (organName: string, points: number[][]) => void;
  modifications: Modification[];
  animationProgress?: Map<number, number>;
  selectedOrgan: string | null;
  cursorPosition: { x: number; y: number } | null;
  onReady?: () => void;
  onLoadProgress?: (step: string, progress: number) => void;
}

export interface GestureInput {
  type: "pan" | "rotate" | "zoom" | "none";
  /** Normalized screen position 0-1 */
  screenX: number;
  screenY: number;
}

export interface LayeredViewerHandle {
  getCamera: () => THREE.Camera | null;
  getScene: () => THREE.Scene | null;
  getCanvasRect: () => DOMRect | null;
  captureCanvas: () => string | null;
  /** Write gesture input every frame — render loop reads it */
  gestureInput: GestureInput;
  /** Smoothly move camera to look at an anatomy-local point */
  zoomToAnatomyPoint: (localPoint: [number, number, number], distance?: number, durationMs?: number) => void;
}

// ── Component ───────────────────────────────────────────────────────────
const SplatAnatomyComposite = forwardRef<LayeredViewerHandle, Props>(
  ({ worldId, onOrganClick, onIncisionTrace, modifications, animationProgress, selectedOrgan, cursorPosition, onReady, onLoadProgress }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const splatViewerRef = useRef<any>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const anatomySceneRef = useRef<THREE.Scene>(new THREE.Scene());  // separate scene for anatomy overlay
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const anatomyGroupRef = useRef<THREE.Group>(new THREE.Group());
    const layerGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
    const modGroupRef = useRef<THREE.Group>(new THREE.Group());
    const labelGroupRef = useRef<THREE.Group>(new THREE.Group());
    const labelRendererRef = useRef<CSS2DRenderer | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState("Loading...");
    const [cameraDebug, setCameraDebug] = useState({ x: 0, y: 0, z: 0, zoom: 0 });
    const cameraDebugFrameRef = useRef(0);

    const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
      skin: true, muscles: true, nervous: true, organs: true, vascular: true, skeleton: true,
    });
    // Optimal showcase defaults: translucent skin reveals muscles + nerves underneath,
    // skeleton subtle in back, organs/vascular prominent — each layer visible without overlap
    const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({
      skin: 0.08, muscles: 0.18, nervous: 0.9, organs: 0.85, vascular: 0.7, skeleton: 0.15,
    });

    // Anatomy placement controls (tunable via UI)
    const [anatomyScale, setAnatomyScale] = useState(DEFAULT_SCALE);
    const [anatomyOffset, setAnatomyOffset] = useState(DEFAULT_OFFSET);
    const keysDownRef = useRef<Set<string>>(new Set());

    // Gesture-based camera control (written by AppPage, read by render loop)
    const gestureInputRef = useRef<GestureInput>({ type: "none", screenX: 0.5, screenY: 0.5 });
    const prevGesturePosRef = useRef<{ x: number; y: number } | null>(null);
    // Smoothed velocity for gesture camera — lerp toward target delta
    const gestureVelRef = useRef({ dx: 0, dy: 0 });
    const GESTURE_SMOOTHING = 0.15; // lerp factor (0 = no response, 1 = instant)

    // Compute offset vector from state (used in raycasting & label placement)
    const anatomyOffsetVec = new THREE.Vector3(anatomyOffset.x, anatomyOffset.y, anatomyOffset.z);

    const isDraggingRef = useRef(false);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const tracePointsRef = useRef<number[][]>([]);
    const traceOrganRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCamera: () => cameraRef.current,
      getScene: () => sceneRef.current,
      getCanvasRect: () => containerRef.current?.getBoundingClientRect() || null,
      captureCanvas: () => {
        try {
          const canvas = containerRef.current?.querySelector("canvas");
          return canvas?.toDataURL("image/png").split(",")[1] || null;
        } catch { return null; }
      },
      get gestureInput() { return gestureInputRef.current; },
      set gestureInput(v: GestureInput) { gestureInputRef.current = v; },
      zoomToAnatomyPoint: (localPoint: [number, number, number], distance = 0.25, durationMs = 1500) => {
        const camera = cameraRef.current;
        const viewer = splatViewerRef.current;
        if (!camera || !viewer) return;

        // Convert anatomy-local coords to world coords
        const grp = anatomyGroupRef.current;
        const targetWorld = new THREE.Vector3(...localPoint)
          .multiplyScalar(grp.scale.x)
          .add(grp.position);

        // Camera end position: offset from target along current view direction
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const endPos = targetWorld.clone().sub(camDir.multiplyScalar(distance));

        const startPos = camera.position.clone();
        const startTarget = viewer.controls?.target?.clone() || targetWorld.clone();
        const startTime = performance.now();

        function animate() {
          const t = Math.min((performance.now() - startTime) / durationMs, 1);
          const ease = t * t * (3 - 2 * t); // smoothstep
          camera.position.lerpVectors(startPos, endPos, ease);
          if (viewer.controls?.target) {
            viewer.controls.target.lerpVectors(startTarget, targetWorld, ease);
          }
          if (t < 1) requestAnimationFrame(animate);
        }
        animate();
      },
    }));

    // ── Initialize: try splat world, fall back to standalone renderer ──
    useEffect(() => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      let disposed = false;
      let rendererRef: THREE.WebGLRenderer | null = null;
      let controlsRef: OrbitControls | null = null;
      let rafId: number;

      // CSS2D label renderer (overlays HTML labels on the 3D scene)
      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(container.clientWidth, container.clientHeight);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0";
      labelRenderer.domElement.style.left = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      labelRenderer.domElement.style.zIndex = "2";
      container.appendChild(labelRenderer.domElement);
      labelRendererRef.current = labelRenderer;

      // WASD + Space/Shift keyboard navigation (hoisted for cleanup)
      const onKeyDown = (e: KeyboardEvent) => {
        const k = e.key === " " ? " " : e.key.toLowerCase();
        if (k === "shift" || MOVE_KEYS.has(k)) {
          e.preventDefault();
          keysDownRef.current.add(k);
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        const k = e.key === " " ? " " : e.key.toLowerCase();
        keysDownRef.current.delete(k);
        if (e.key === "Shift") keysDownRef.current.delete("shift");
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      // ── Fallback: standalone Three.js renderer (matches original LayeredAnatomyViewer) ──
      function initStandalone() {
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f4ec);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(40, w / h, 1, 10000);
        camera.position.set(400, -50, 1800);
        camera.lookAt(0, -120, 900);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        container.appendChild(renderer.domElement);
        rendererRef = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, -120, 1000);
        controls.minDistance = 400;
        controls.maxDistance = 4000;
        controlsRef = controls;

        // Lighting — clinical, well-lit anatomy (exact match)
        scene.add(new THREE.AmbientLight(0xf2ebe2, 1.35));
        const mainLight = new THREE.DirectionalLight(0xfffaf4, 1.55);
        mainLight.position.set(600, 100, 2000);
        mainLight.castShadow = true;
        scene.add(mainLight);
        const fillLight = new THREE.DirectionalLight(0xd8cdc0, 0.45);
        fillLight.position.set(-500, -200, 800);
        scene.add(fillLight);
        const backLight = new THREE.DirectionalLight(0xffffff, 0.55);
        backLight.position.set(-200, 300, -400);
        scene.add(backLight);
        const rimLight = new THREE.DirectionalLight(0xcdb9ab, 0.4);
        rimLight.position.set(300, -400, 1200);
        scene.add(rimLight);

        // Anatomy at normal scale (no shrinking — layers added directly to scene like original)
        anatomyGroupRef.current.name = "anatomy";
        scene.add(anatomyGroupRef.current);
        modGroupRef.current.name = "modifications";
        scene.add(modGroupRef.current);
        labelGroupRef.current.name = "labels";
        scene.add(labelGroupRef.current);

        function animate() {
          if (disposed) return;
          rafId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
          labelRenderer.render(scene, camera);
        }
        animate();
      }

      // ── Try splat world first, fall back on any error ──
      async function initSplat() {
        if (!worldId) throw new Error("No worldId");

        setLoadProgress("Fetching world model...");
        onLoadProgress?.("Connecting to World Labs...", 0.05);
        const world = await getWorld(worldId);
        const spzUrl = selectSpzUrl(world);
        if (!spzUrl) throw new Error("No SPZ URL available");
        if (disposed) return;
        onLoadProgress?.("Downloading world environment...", 0.10);

        setLoadProgress("Loading world environment...");
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [0.1345, -0.0296, -0.1243],
          initialCameraLookAt: [0, 0, 1],
          rootElement: container,
          selfDrivenMode: false,
          sharedMemoryForWorkers: false,
          dynamicScene: false,
        });
        splatViewerRef.current = viewer;

        onLoadProgress?.("Reconstructing 3D environment...", 0.15);
        await viewer.addSplatScene(spzUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        });
        if (disposed) return;
        onLoadProgress?.("Initializing spatial renderer...", 0.50);

        cameraRef.current = viewer.camera || null;
        const camera = cameraRef.current;
        if (!viewer.threeScene || !camera) throw new Error("Could not access splat viewer scene");
        // Use the anatomy scene as the public scene ref (for raycasting, etc.)
        sceneRef.current = anatomySceneRef.current;

        // Anatomy goes in a SEPARATE scene so it renders ON TOP of splats
        const anatScene = anatomySceneRef.current;
        anatScene.add(new THREE.AmbientLight(0xf2ebe2, 1.35));
        const mainLight = new THREE.DirectionalLight(0xfffaf4, 1.55);
        mainLight.position.set(1, 0.5, 3);
        anatScene.add(mainLight);
        const fillLight = new THREE.DirectionalLight(0xd8cdc0, 0.45);
        fillLight.position.set(-1, -0.5, 1);
        anatScene.add(fillLight);
        const backLight = new THREE.DirectionalLight(0xffffff, 0.55);
        backLight.position.set(-0.5, 0.8, -1);
        anatScene.add(backLight);

        anatomyGroupRef.current.name = "anatomy";
        anatomyGroupRef.current.scale.setScalar(DEFAULT_SCALE);
        anatomyGroupRef.current.position.set(DEFAULT_OFFSET.x, DEFAULT_OFFSET.y, DEFAULT_OFFSET.z);
        anatScene.add(anatomyGroupRef.current);
        modGroupRef.current.name = "modifications";
        anatomyGroupRef.current.add(modGroupRef.current);
        labelGroupRef.current.name = "labels";
        anatScene.add(labelGroupRef.current);

        function animate() {
          if (disposed) return;
          rafId = requestAnimationFrame(animate);

          const keys = keysDownRef.current;
          if (keys.size > 0 && camera) {
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, -1, 0)).normalize();
            const delta = new THREE.Vector3();
            if (keys.has("w")) delta.addScaledVector(forward, MOVE_SPEED);
            if (keys.has("s")) delta.addScaledVector(forward, -MOVE_SPEED);
            if (keys.has("a")) delta.addScaledVector(right, -MOVE_SPEED);
            if (keys.has("d")) delta.addScaledVector(right, MOVE_SPEED);
            if (keys.has(" ")) delta.y -= MOVE_SPEED;
            if (keys.has("shift")) delta.y += MOVE_SPEED;
            camera.position.add(delta);
            if (viewer.controls?.target) viewer.controls.target.add(delta);
          }

          // Apply hand gesture camera control (smoothed)
          const gi = gestureInputRef.current;
          const vel = gestureVelRef.current;
          if (gi.type !== "none" && camera) {
            const prev = prevGesturePosRef.current;
            if (prev) {
              const rawDx = gi.screenX - prev.x;
              const rawDy = gi.screenY - prev.y;
              // Lerp velocity toward raw delta for smooth transitions
              vel.dx += (rawDx - vel.dx) * GESTURE_SMOOTHING;
              vel.dy += (rawDy - vel.dy) * GESTURE_SMOOTHING;
              const dx = vel.dx;
              const dy = vel.dy;

              if (gi.type === "pan") {
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
                const panDelta = new THREE.Vector3();
                panDelta.addScaledVector(right, -dx * 4.0);
                panDelta.addScaledVector(up, dy * 4.0);
                camera.position.add(panDelta);
                if (viewer.controls?.target) viewer.controls.target.add(panDelta);
              } else if (gi.type === "rotate") {
                const controls = viewer.controls;
                if (controls) {
                  const offset = camera.position.clone().sub(controls.target);
                  const spherical = new THREE.Spherical().setFromVector3(offset);
                  spherical.theta -= dx * 6.0;
                  spherical.phi += dy * 6.0;
                  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                  offset.setFromSpherical(spherical);
                  camera.position.copy(controls.target).add(offset);
                  camera.lookAt(controls.target);
                }
              } else if (gi.type === "zoom") {
                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                camera.position.addScaledVector(forward, -dy * 5.0);
              }
            }
            prevGesturePosRef.current = { x: gi.screenX, y: gi.screenY };
          } else {
            // Decay velocity smoothly when gesture stops
            vel.dx *= 0.85;
            vel.dy *= 0.85;
            if (Math.abs(vel.dx) > 0.0001 || Math.abs(vel.dy) > 0.0001) {
              // Apply residual momentum for smooth stop
              // (only if we had a previous gesture type to continue)
            }
            prevGesturePosRef.current = null;
          }

          // Update camera debug info every 10 frames
          cameraDebugFrameRef.current++;
          if (cameraDebugFrameRef.current % 10 === 0 && camera) {
            const p = camera.position;
            const target = viewer.controls?.target;
            const dist = target ? p.distanceTo(target) : 0;
            setCameraDebug({ x: p.x, y: p.y, z: p.z, zoom: dist });
          }

          // 1. Render splats (clears canvas + draws splat cloud)
          viewer.update();
          viewer.render();
          // 2. Render anatomy ON TOP (no clear — overlays on splat background)
          const r = viewer.renderer;
          if (r) {
            const prevAutoClear = r.autoClear;
            r.autoClear = false;
            r.render(anatScene, camera);
            r.autoClear = prevAutoClear;
          }
          labelRenderer.render(anatScene, camera);
        }
        animate();
      }

      (async () => {
        try {
          await initSplat();
        } catch (err: any) {
          if (disposed) return;
          console.warn("Splat world failed, falling back to standalone renderer:", err.message);
          // Reset scale/position for standalone mode (no splat world = normal scale)
          setAnatomyScale(1);
          setAnatomyOffset({ x: 0, y: 0, z: 0 });
          anatomyGroupRef.current.scale.setScalar(1);
          anatomyGroupRef.current.position.set(0, 0, 0);
          initStandalone();
        }

        if (disposed) return;

        // Load anatomy layers (works in both modes)
        setLoadProgress("Loading anatomy model...");
        onLoadProgress?.("Segmenting anatomical structures...", 0.55);
        await loadLayers();
        if (disposed) return;

        onLoadProgress?.("Preparing simulation environment...", 0.95);
        setIsLoading(false);
        setLoadProgress("");
        // Brief delay so the progress bar visually reaches 100%
        await new Promise(r => setTimeout(r, 400));
        onLoadProgress?.("Ready", 1.0);
        onReady?.();
      })();

      const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (cameraRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
        }
        if (rendererRef) rendererRef.setSize(w, h);
        labelRenderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        if (splatViewerRef.current) {
          try { splatViewerRef.current.stop(); splatViewerRef.current.dispose(); } catch { /* */ }
          splatViewerRef.current = null;
        }
        if (rendererRef) {
          rendererRef.dispose();
          if (container.contains(rendererRef.domElement)) container.removeChild(rendererRef.domElement);
        }
        if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement);
      };
    }, [worldId]);

    // ── Load OBJ layers into anatomyGroup ───────────────────────────────
    const loadLayers = async () => {
      const res = await fetch("/models/anatomy/layers.json");
      const data: LayersMetadata = await res.json();
      const loader = new OBJLoader();
      const layerEntries = Object.entries(data.layers);

      // Hide anatomy until all parts are loaded for a seamless reveal
      anatomyGroupRef.current.visible = false;

      const allFetches: { layerName: string; part: typeof data.layers[string]["parts"][number]; promise: Promise<string> }[] = [];
      for (const [layerName, layerData] of layerEntries) {
        for (const part of layerData.parts) {
          allFetches.push({
            layerName, part,
            promise: fetch(`/models/${part.file}`).then(r => r.text()).catch(() => ""),
          });
        }
      }

      const results = await Promise.all(allFetches.map(f => f.promise));

      // Build all layer groups from fetched data
      let idx = 0;
      for (const [layerName, layerData] of layerEntries) {
        const group = new THREE.Group();
        group.name = layerName;
        group.visible = true;

        for (const part of layerData.parts) {
          const objText = results[idx++];
          if (!objText) continue;
          try {
            const obj = loader.parse(objText);

            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const mat = new THREE.MeshPhongMaterial({
                  color: LAYER_COLORS[layerName] || 0xcccccc,
                  specular: layerName === "nervous" ? 0x444400 : 0x222222,
                  shininess: layerName === "skeleton" ? 60 : layerName === "nervous" ? 40 : 20,
                  transparent: true,
                  opacity: LAYER_OPACITY[layerName] || 0.8,
                  side: layerName === "skin" ? THREE.DoubleSide : THREE.FrontSide,
                  depthWrite: layerName !== "skin",
                });
                if (layerName === "nervous") {
                  mat.emissive = new THREE.Color(0x504010);
                  mat.emissiveIntensity = 0.3;
                }
                child.material = mat;
                child.userData.organName = part.name;
                child.userData.layerName = layerName;
                child.name = part.name;
              }
            });

            obj.name = part.name;
            obj.userData.organName = part.name;
            obj.userData.layerName = layerName;
            group.add(obj);
          } catch (e) {
            console.warn(`Failed to load ${part.file}:`, e);
          }
        }

        anatomyGroupRef.current.add(group);
        layerGroupsRef.current.set(layerName, group);
      }

      // Reveal anatomy all at once
      anatomyGroupRef.current.visible = true;
    };

    // ── Reactively update anatomy placement when scale/offset change ───
    useEffect(() => {
      const grp = anatomyGroupRef.current;
      grp.scale.setScalar(anatomyScale);
      grp.position.set(anatomyOffset.x, anatomyOffset.y, anatomyOffset.z);
      console.log(`[Anatomy Placement] scale=${anatomyScale.toFixed(5)} offset=(${anatomyOffset.x.toFixed(3)}, ${anatomyOffset.y.toFixed(3)}, ${anatomyOffset.z.toFixed(3)})`);
    }, [anatomyScale, anatomyOffset]);

    // ── Layer visibility ────────────────────────────────────────────────
    useEffect(() => {
      layerGroupsRef.current.forEach((group, name) => {
        group.visible = layerVisibility[name] ?? true;
      });
    }, [layerVisibility]);

    // ── Layer opacity ───────────────────────────────────────────────────
    useEffect(() => {
      layerGroupsRef.current.forEach((group, name) => {
        const opacity = layerOpacity[name] ?? 0.8;
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshPhongMaterial;
            mat.opacity = opacity;
          }
        });
      });
    }, [layerOpacity]);

    // ── Highlight selected organ ────────────────────────────────────────
    useEffect(() => {
      layerGroupsRef.current.forEach((group) => {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshPhongMaterial;
            if (child.userData.organName === selectedOrgan) {
              mat.emissive = new THREE.Color(0x7c5cfc);
              mat.emissiveIntensity = 0.4;
            } else {
              mat.emissive = new THREE.Color(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        });
      });
    }, [selectedOrgan]);

    // ── Render modifications ────────────────────────────────────────────
    useEffect(() => {
      while (modGroupRef.current.children.length > 0) {
        const child = modGroupRef.current.children[0];
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else (child.material as THREE.Material).dispose();
        }
        modGroupRef.current.remove(child);
      }
      while (labelGroupRef.current.children.length > 0) {
        const c = labelGroupRef.current.children[0];
        if (c instanceof CSS2DObject) c.element.remove();
        labelGroupRef.current.remove(c);
      }

      modifications.forEach((mod, index) => {
        const progress = animationProgress?.get(index) ?? 1;
        if (progress <= 0) return;

        if (mod.type === "incision" && mod.coordinates.length >= 2) {
          const pts = mod.coordinates.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          geo.setDrawRange(0, Math.max(2, Math.floor(pts.length * progress)));
          modGroupRef.current.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: mod.color || "#ff6b6b", linewidth: 3 })));
        } else if ((mod.type === "zone" || mod.type === "heatmap") && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const r = mod.radius || (mod.type === "heatmap" ? 30 : 20);
          const score = mod.score ?? 0.5;
          const color = mod.type === "heatmap"
            ? new THREE.Color().lerpColors(new THREE.Color("#7c5cfc"), new THREE.Color("#34d399"), score)
            : new THREE.Color(mod.color || "#fbbf24");
          const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: (mod.type === "heatmap" ? 0.15 + 0.35 * score : 0.3) * progress });
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
          sphere.position.set(c[0], c[1], c[2]);
          sphere.scale.setScalar(0.3 + 0.7 * progress);
          modGroupRef.current.add(sphere);
        } else if (mod.type === "highlight" && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const mat = new THREE.MeshBasicMaterial({ color: mod.color || "#7c5cfc", transparent: true, opacity: 0.6 * progress });
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(15, 16, 16), mat);
          sphere.position.set(c[0], c[1], c[2]);
          sphere.scale.setScalar(0.5 + 0.5 * progress);
          modGroupRef.current.add(sphere);
        } else if ((mod.type as string) === "measurement" && mod.coordinates.length >= 2) {
          const start = new THREE.Vector3(...mod.coordinates[0] as [number, number, number]);
          const end = new THREE.Vector3(...mod.coordinates[1] as [number, number, number]);
          const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
          const lineMat = new THREE.LineDashedMaterial({ color: mod.color || "#fbbf24", dashSize: 6, gapSize: 4, transparent: true, opacity: progress });
          const line = new THREE.Line(geo, lineMat);
          line.computeLineDistances();
          modGroupRef.current.add(line);
          for (const pt of [start, end]) {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({ color: mod.color || "#fbbf24", transparent: true, opacity: progress }));
            dot.position.copy(pt);
            modGroupRef.current.add(dot);
          }
          if ((mod as any).distance_mm !== undefined && progress > 0.3) {
            const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
            const div = document.createElement("div");
            div.style.cssText = `padding:3px 10px;border-radius:999px;background:rgba(251,191,36,0.18);backdrop-filter:blur(8px);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;font-size:11px;font-family:var(--font-mono),monospace;font-weight:600;letter-spacing:0.04em;white-space:nowrap;opacity:${Math.min(1, (progress - 0.3) * 1.4)};`;
            div.textContent = `${(mod as any).distance_mm.toFixed(1)} mm`;
            const labelObj = new CSS2DObject(div);
            labelObj.position.copy(mid).add(new THREE.Vector3(0, 15, 0));
            labelGroupRef.current.add(labelObj);
          }
        } else if ((mod.type as string) === "corridor" && mod.coordinates.length >= 2) {
          const pts = mod.coordinates.map(c => new THREE.Vector3(c[0], c[1], c[2]));
          const curve = new THREE.CatmullRomCurve3(pts);
          const radiusStart = 8, radiusEnd = 3;
          const tubeGeo = new THREE.TubeGeometry(curve, 64, radiusStart, 8, false);
          const gradient = (mod as any).risk_gradient || pts.map(() => 0.5);
          const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
          const safeColor = new THREE.Color("#34d399");
          const warnColor = new THREE.Color("#fbbf24");
          const dangerColor = new THREE.Color("#ef4444");
          for (let v = 0; v < tubeGeo.attributes.position.count; v++) {
            const pos = new THREE.Vector3().fromBufferAttribute(tubeGeo.attributes.position, v);
            let bestT = 0, bestDist = Infinity;
            for (let s = 0; s <= 20; s++) {
              const st = s / 20;
              const d = curve.getPoint(st).distanceTo(pos);
              if (d < bestDist) { bestDist = d; bestT = st; }
            }
            const gi = bestT * (gradient.length - 1);
            const lo = Math.floor(gi), hi = Math.min(lo + 1, gradient.length - 1);
            const frac = gi - lo;
            const risk = gradient[lo] * (1 - frac) + gradient[hi] * frac;
            const c = risk < 0.5
              ? new THREE.Color().lerpColors(safeColor, warnColor, risk * 2)
              : new THREE.Color().lerpColors(warnColor, dangerColor, (risk - 0.5) * 2);
            colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
          }
          tubeGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          for (let v = 0; v < tubeGeo.attributes.position.count; v++) {
            const pos = new THREE.Vector3().fromBufferAttribute(tubeGeo.attributes.position, v);
            let bestT = 0, bestDist = Infinity;
            for (let s = 0; s <= 20; s++) {
              const st = s / 20;
              const d = curve.getPoint(st).distanceTo(pos);
              if (d < bestDist) { bestDist = d; bestT = st; }
            }
            const scale = 1 - bestT * (1 - radiusEnd / radiusStart);
            const center = curve.getPoint(bestT);
            const offset = pos.clone().sub(center);
            offset.multiplyScalar(scale);
            pos.copy(center).add(offset);
            tubeGeo.attributes.position.setXYZ(v, pos.x, pos.y, pos.z);
          }
          tubeGeo.attributes.position.needsUpdate = true;
          const tubeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 * progress, side: THREE.DoubleSide });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.scale.setScalar(0.3 + 0.7 * progress);
          modGroupRef.current.add(tube);
        }

        if (mod.label && mod.coordinates.length >= 1 && progress > 0.5) {
          const c = mod.coordinates[0];
          const div = document.createElement("div");
          div.style.cssText = `padding:4px 10px;border-radius:999px;background:rgba(255,252,247,0.86);backdrop-filter:blur(8px);border:1px solid rgba(47,39,31,0.12);color:#171311;font-size:11px;font-family:var(--font-mono), ui-monospace, monospace;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;box-shadow:0 8px 20px rgba(38,29,20,0.08);opacity:${Math.min(1, (progress - 0.5) * 2)};`;
          div.textContent = mod.label + (mod.score !== undefined ? ` ${Math.round(mod.score * 100)}%` : "");
          const labelObj = new CSS2DObject(div);
          // Transform from anatomy-local coords to world space using actual group transform
          const grp = anatomyGroupRef.current;
          const s = grp.scale.x; // uniform scale
          const worldPos = new THREE.Vector3(c[0], c[1], c[2] + 30)
            .multiplyScalar(s)
            .add(grp.position);
          labelObj.position.copy(worldPos);
          labelGroupRef.current.add(labelObj);
        }
      });
    }, [modifications, animationProgress]);

    // ── Mouse handlers (raycasting into anatomy group) ──────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
      tracePointsRef.current = [];
      traceOrganRef.current = null;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!mouseDownPosRef.current) return;
      if (Math.abs(e.clientX - mouseDownPosRef.current.x) > 5 || Math.abs(e.clientY - mouseDownPosRef.current.y) > 5) isDraggingRef.current = true;

      if (e.shiftKey && isDraggingRef.current && cameraRef.current && sceneRef.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(mouse, cameraRef.current);
        const hits = rc.intersectObjects(anatomyGroupRef.current.children, true);
        if (hits.length > 0) {
          // Convert hit point back to anatomy-local coords for the backend
          const grp = anatomyGroupRef.current;
          const localPt = hits[0].point.clone().sub(grp.position).divideScalar(grp.scale.x);
          tracePointsRef.current.push([localPt.x, localPt.y, localPt.z]);
          if (!traceOrganRef.current) traceOrganRef.current = hits[0].object.userData?.organName || "unknown";
        }
      }
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
      if (!mouseDownPosRef.current) return;
      if (e.shiftKey && isDraggingRef.current && tracePointsRef.current.length > 2 && traceOrganRef.current) {
        onIncisionTrace(traceOrganRef.current, tracePointsRef.current);
        mouseDownPosRef.current = null;
        return;
      }
      if (!isDraggingRef.current && cameraRef.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(mouse, cameraRef.current);
        const hits = rc.intersectObjects(anatomyGroupRef.current.children, true);
        if (hits.length > 0) {
          const hit = hits[0];
          const grp = anatomyGroupRef.current;
          const localPt = hit.point.clone().sub(grp.position).divideScalar(grp.scale.x);
          const normal = hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 1, 0];
          onOrganClick(hit.object.userData?.organName || "unknown", [localPt.x, localPt.y, localPt.z], normal);
        }
      }
      mouseDownPosRef.current = null;
    }, [onOrganClick, onIncisionTrace]);

    const toggleLayer = (name: string) => setLayerVisibility((prev) => ({ ...prev, [name]: !prev[name] }));

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair", background: "#0a0a0f", outline: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Layer controls — hidden by default, kept for dev tuning
          Optimal defaults: skin 0.08, muscles 0.18, nervous 0.9, organs 0.85, vascular 0.7, skeleton 0.15
        */}
        {false && <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {LAYER_ORDER.map((name) => (
            <div
              key={name}
              onClick={() => toggleLayer(name)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 999,
                backgroundColor: layerVisibility[name] ? "rgba(20,20,28,0.82)" : "rgba(20,20,28,0.56)",
                border: `1px solid ${layerVisibility[name] ? "var(--accent)" : "rgba(255,255,255,0.12)"}`,
                cursor: "pointer", backdropFilter: "blur(10px)",
                transition: "all 0.2s ease", fontSize: "0.75rem", fontWeight: 500,
                color: layerVisibility[name] ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `#${LAYER_COLORS[name]?.toString(16).padStart(6, "0")}`, opacity: layerVisibility[name] ? 1 : 0.3 }} />
              {name.charAt(0).toUpperCase() + name.slice(1)}
              {layerVisibility[name] && (
                <input
                  type="range" min="0" max="100"
                  value={(layerOpacity[name] ?? 0.8) * 100}
                  onChange={(e) => { e.stopPropagation(); setLayerOpacity((prev) => ({ ...prev, [name]: Number(e.target.value) / 100 })); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 60, height: 3, accentColor: "var(--accent)" }}
                />
              )}
            </div>
          ))}
        </div>}

        {/* Anatomy placement controls (dev tuning) */}
        {SHOW_PLACEMENT_UI && <div style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 10,
          padding: "10px 14px", borderRadius: 10,
          backgroundColor: "rgba(10,10,18,0.88)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column", gap: 8,
          fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.7)",
          minWidth: 220,
        }}>
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>Anatomy Placement</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Scale
            <input type="range" min="0.0001" max="0.01" step="0.0001"
              value={anatomyScale}
              onChange={(e) => setAnatomyScale(Number(e.target.value))}
              style={{ flex: 1, height: 3, accentColor: "#7c5cfc" }}
            />
            <span style={{ minWidth: 52, textAlign: "right" }}>{anatomyScale.toFixed(4)}</span>
          </label>
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {axis.toUpperCase()}
              <input type="range" min="-5" max="10" step="0.05"
                value={anatomyOffset[axis]}
                onChange={(e) => setAnatomyOffset((prev) => ({ ...prev, [axis]: Number(e.target.value) }))}
                style={{ flex: 1, height: 3, accentColor: "#7c5cfc" }}
              />
              <span style={{ minWidth: 42, textAlign: "right" }}>{anatomyOffset[axis].toFixed(2)}</span>
            </label>
          ))}
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            WASD move · Space up · Shift down
          </div>
        </div>}

        {isLoading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 10 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>{loadProgress}</span>
          </div>
        )}

        {/* Camera position debug */}
        {SHOW_CAMERA_DEBUG && <div style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          padding: "8px 12px", borderRadius: 8,
          backgroundColor: "rgba(10,10,18,0.85)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.6)",
          lineHeight: 1.6,
        }}>
          <div>x: {cameraDebug.x.toFixed(4)}</div>
          <div>y: {cameraDebug.y.toFixed(4)}</div>
          <div>z: {cameraDebug.z.toFixed(4)}</div>
          <div style={{ marginTop: 4, color: "rgba(255,255,255,0.4)" }}>zoom: {cameraDebug.zoom.toFixed(4)}</div>
        </div>}

        {cursorPosition && (
          <div style={{ position: "absolute", left: cursorPosition.x - 10, top: cursorPosition.y - 10, width: 20, height: 20, border: "2px solid var(--accent)", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 0 8px rgba(109, 98, 87, 0.28)" }} />
        )}
      </div>
    );
  }
);

SplatAnatomyComposite.displayName = "SplatAnatomyComposite";
export default SplatAnatomyComposite;

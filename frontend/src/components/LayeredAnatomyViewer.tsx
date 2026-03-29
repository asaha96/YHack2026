import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Modification } from "../utils/api";

interface LayerData {
  label: string;
  color: string;
  visible: boolean;
  parts: { name: string; file: string; fma_id: string; label: string }[];
}

interface LayersMetadata {
  layers: Record<string, LayerData>;
}

interface Props {
  onOrganClick: (organName: string, point: number[], normal: number[]) => void;
  onIncisionTrace: (organName: string, points: number[][]) => void;
  modifications: Modification[];
  animationProgress?: Map<number, number>;
  selectedOrgan: string | null;
  cursorPosition: { x: number; y: number } | null;
}

export interface LayeredViewerHandle {
  getCamera: () => THREE.Camera | null;
  getScene: () => THREE.Scene | null;
  getCanvasRect: () => DOMRect | null;
  captureCanvas: () => string | null;
}

const LAYER_ORDER = ["skin", "muscles", "organs", "vascular", "skeleton"];
const LAYER_COLORS: Record<string, number> = {
  skin: 0xe8beaa,
  muscles: 0xc94040,
  skeleton: 0xf5f0e8,
  organs: 0xcc7766,
  vascular: 0x4466cc,
};
const LAYER_OPACITY: Record<string, number> = {
  skin: 0.25,
  muscles: 0.6,
  skeleton: 0.9,
  organs: 0.85,
  vascular: 0.75,
};

const LayeredAnatomyViewer = forwardRef<LayeredViewerHandle, Props>(
  ({ onOrganClick, onIncisionTrace, modifications, animationProgress, selectedOrgan, cursorPosition }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const labelRendererRef = useRef<CSS2DRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const layerGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
    const modGroupRef = useRef<THREE.Group>(new THREE.Group());
    const labelGroupRef = useRef<THREE.Group>(new THREE.Group());
    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState("");
    const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
      skin: true,
      muscles: true,
      organs: true,
      vascular: true,
      skeleton: true,
    });
    const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({
      skin: 0.06,
      muscles: 0.12,
      organs: 0.9,
      vascular: 0.85,
      skeleton: 0.2,
    });
    const isDraggingRef = useRef(false);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const tracePointsRef = useRef<number[][]>([]);
    const traceOrganRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCamera: () => cameraRef.current,
      getScene: () => sceneRef.current,
      getCanvasRect: () => containerRef.current?.getBoundingClientRect() || null,
      captureCanvas: () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        return rendererRef.current.domElement.toDataURL("image/png").split(",")[1];
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8f4ec);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(40, width / height, 1, 10000);
      camera.position.set(400, -50, 1800);
      camera.lookAt(0, -120, 900);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(width, height);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0";
      labelRenderer.domElement.style.left = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      container.appendChild(labelRenderer.domElement);
      labelRendererRef.current = labelRenderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, -120, 1000);
      controls.minDistance = 400;
      controls.maxDistance = 4000;
      controls.autoRotate = false;
      controls.enableRotate = true;
      controlsRef.current = controls;

      // Lighting — clinical, well-lit anatomy
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

      modGroupRef.current.name = "modifications";
      scene.add(modGroupRef.current);
      labelGroupRef.current.name = "labels";
      scene.add(labelGroupRef.current);

      loadLayers(scene);

      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        labelRenderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        container.removeChild(renderer.domElement);
        container.removeChild(labelRenderer.domElement);
        renderer.dispose();
      };
    }, []);

    const loadLayers = async (scene: THREE.Scene) => {
      try {
        const res = await fetch("/models/anatomy/layers.json");
        const data: LayersMetadata = await res.json();
        const loader = new OBJLoader();

        for (const [layerName, layerData] of Object.entries(data.layers)) {
          const group = new THREE.Group();
          group.name = layerName;
          group.visible = layerVisibility[layerName] ?? layerData.visible;

          let loaded = 0;
          for (const part of layerData.parts) {
            try {
              setLoadProgress(`${layerData.label}: ${part.label}`);
              const objText = await (await fetch(`/models/${part.file}`)).text();
              const obj = loader.parse(objText);

              obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.material = new THREE.MeshPhongMaterial({
                    color: LAYER_COLORS[layerName] || 0xcccccc,
                    specular: 0x222222,
                    shininess: layerName === "skeleton" ? 60 : 20,
                    transparent: true,
                    opacity: LAYER_OPACITY[layerName] || 0.8,
                    side: layerName === "skin" ? THREE.DoubleSide : THREE.FrontSide,
                    depthWrite: layerName !== "skin",
                  });
                  child.userData.organName = part.name;
                  child.userData.layerName = layerName;
                  child.name = part.name;
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              obj.name = part.name;
              obj.userData.organName = part.name;
              obj.userData.layerName = layerName;
              group.add(obj);
              loaded++;
            } catch (e) {
              console.warn(`Failed to load ${part.file}:`, e);
            }
          }

          scene.add(group);
          layerGroupsRef.current.set(layerName, group);
        }

        setIsLoading(false);
        setLoadProgress("");
      } catch (e) {
        console.error("Failed to load layers:", e);
        setIsLoading(false);
      }
    };

    // Update layer visibility
    useEffect(() => {
      layerGroupsRef.current.forEach((group, name) => {
        group.visible = layerVisibility[name] ?? true;
      });
    }, [layerVisibility]);

    // Update layer opacity
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

    // Highlight selected organ
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

    // Render modifications
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
        } else if (mod.type === "measurement" && mod.coordinates.length >= 2) {
          const start = new THREE.Vector3(...mod.coordinates[0] as [number, number, number]);
          const end = new THREE.Vector3(...mod.coordinates[1] as [number, number, number]);
          // Dashed line
          const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
          const lineMat = new THREE.LineDashedMaterial({ color: mod.color || "#fbbf24", dashSize: 6, gapSize: 4, transparent: true, opacity: progress });
          const line = new THREE.Line(geo, lineMat);
          line.computeLineDistances();
          modGroupRef.current.add(line);
          // Endpoint spheres
          for (const pt of [start, end]) {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({ color: mod.color || "#fbbf24", transparent: true, opacity: progress }));
            dot.position.copy(pt);
            modGroupRef.current.add(dot);
          }
          // Midpoint distance label
          if (mod.distance_mm !== undefined && progress > 0.3) {
            const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
            const div = document.createElement("div");
            div.style.cssText = `padding:3px 10px;border-radius:999px;background:rgba(251,191,36,0.18);backdrop-filter:blur(8px);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;font-size:11px;font-family:var(--font-mono),monospace;font-weight:600;letter-spacing:0.04em;white-space:nowrap;opacity:${Math.min(1,(progress-0.3)*1.4)};`;
            div.textContent = `${mod.distance_mm.toFixed(1)} mm`;
            const labelObj = new CSS2DObject(div);
            labelObj.position.copy(mid).add(new THREE.Vector3(0, 15, 0));
            labelGroupRef.current.add(labelObj);
          }
        } else if (mod.type === "corridor" && mod.coordinates.length >= 2) {
          const pts = mod.coordinates.map(c => new THREE.Vector3(c[0], c[1], c[2]));
          const curve = new THREE.CatmullRomCurve3(pts);
          const segments = 64;
          const radiusStart = 8, radiusEnd = 3;
          const tubeGeo = new THREE.TubeGeometry(curve, segments, radiusStart, 8, false);
          // Apply vertex colors from risk_gradient
          const gradient = mod.risk_gradient || pts.map(() => 0.5);
          const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
          const safeColor = new THREE.Color("#34d399");
          const warnColor = new THREE.Color("#fbbf24");
          const dangerColor = new THREE.Color("#ef4444");
          for (let v = 0; v < tubeGeo.attributes.position.count; v++) {
            const pos = new THREE.Vector3().fromBufferAttribute(tubeGeo.attributes.position, v);
            // Approximate t along tube by closest point
            let bestT = 0, bestDist = Infinity;
            for (let s = 0; s <= 20; s++) {
              const st = s / 20;
              const d = curve.getPoint(st).distanceTo(pos);
              if (d < bestDist) { bestDist = d; bestT = st; }
            }
            // Interpolate gradient
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
          // Taper radius by scaling vertices
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
          div.style.cssText = `padding:4px 10px;border-radius:999px;background:rgba(255,252,247,0.86);backdrop-filter:blur(8px);border:1px solid rgba(47,39,31,0.12);color:#171311;font-size:11px;font-family:var(--font-mono), ui-monospace, monospace;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;box-shadow:0 8px 20px rgba(38,29,20,0.08);opacity:${Math.min(1,(progress-0.5)*2)};`;
          div.textContent = mod.label + (mod.score !== undefined ? ` ${Math.round(mod.score * 100)}%` : "");
          const labelObj = new CSS2DObject(div);
          labelObj.position.set(c[0], c[1] + 30, c[2]);
          labelGroupRef.current.add(labelObj);
        }
      });

      // De-overlap labels: nudge any that are too close in 3D space
      const labels = labelGroupRef.current.children as THREE.Object3D[];
      const MIN_DIST = 45; // minimum distance between label positions
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i].position;
          const b = labels[j].position;
          const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < MIN_DIST) {
            const push = (MIN_DIST - dist) / 2;
            // Push apart vertically (Y axis) so they stack neatly
            if (a.y >= b.y) {
              a.y += push;
              b.y -= push;
            } else {
              a.y -= push;
              b.y += push;
            }
          }
        }
      }
    }, [modifications, animationProgress]);

    // Mouse handlers
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
        const hits = rc.intersectObjects(sceneRef.current.children, true);
        if (hits.length > 0) {
          const p = hits[0].point;
          tracePointsRef.current.push([p.x, p.y, p.z]);
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
      if (!isDraggingRef.current && cameraRef.current && sceneRef.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(mouse, cameraRef.current);
        const hits = rc.intersectObjects(sceneRef.current.children, true);
        if (hits.length > 0) {
          const hit = hits[0];
          onOrganClick(hit.object.userData?.organName || "unknown", [hit.point.x, hit.point.y, hit.point.z], hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 1, 0]);
        }
      }
      mouseDownPosRef.current = null;
    }, [onOrganClick, onIncisionTrace]);

    const toggleLayer = (name: string) => setLayerVisibility((prev) => ({ ...prev, [name]: !prev[name] }));

    return (
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair", background: "radial-gradient(circle at 50% 22%, rgba(255,255,255,0.76), rgba(248,244,236,0.98) 52%, rgba(243,237,228,1) 100%)" }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        {/* Layer controls */}
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {LAYER_ORDER.map((name) => (
            <div
              key={name}
              onClick={() => toggleLayer(name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                backgroundColor: layerVisibility[name] ? "rgba(255,252,247,0.82)" : "rgba(255,252,247,0.56)",
                border: `1px solid ${layerVisibility[name] ? "var(--accent)" : "var(--border)"}`,
                cursor: "pointer",
                backdropFilter: "blur(10px)",
                transition: "all 0.2s ease",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: layerVisibility[name] ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: `#${LAYER_COLORS[name]?.toString(16).padStart(6, "0")}`, opacity: layerVisibility[name] ? 1 : 0.3 }} />
              {name.charAt(0).toUpperCase() + name.slice(1)}
              {layerVisibility[name] && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(layerOpacity[name] ?? 0.8) * 100}
                  onChange={(e) => {
                    e.stopPropagation();
                    setLayerOpacity((prev) => ({ ...prev, [name]: Number(e.target.value) / 100 }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 60, height: 3, accentColor: "var(--accent)" }}
                />
              )}
            </div>
          ))}
        </div>

        {isLoading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 10 }}>
            <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{loadProgress || "Loading anatomy..."}</span>
          </div>
        )}
        {cursorPosition && (
          <div style={{ position: "absolute", left: cursorPosition.x - 10, top: cursorPosition.y - 10, width: 20, height: 20, border: "2px solid var(--accent)", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 0 8px rgba(109, 98, 87, 0.28)" }} />
        )}
      </div>
    );
  }
);

LayeredAnatomyViewer.displayName = "LayeredAnatomyViewer";
export default LayeredAnatomyViewer;

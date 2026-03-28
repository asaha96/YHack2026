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
      scene.background = new THREE.Color(0x0f0f14);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
      camera.position.set(0, -100, 2500);
      camera.lookAt(0, -100, 800);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
      controls.target.set(0, -100, 800);
      controls.minDistance = 300;
      controls.maxDistance = 5000;
      controlsRef.current = controls;

      // Lighting — scaled for mm-range anatomy
      scene.add(new THREE.AmbientLight(0x445566, 0.8));
      const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
      mainLight.position.set(500, 0, 2000);
      mainLight.castShadow = true;
      scene.add(mainLight);
      const fillLight = new THREE.DirectionalLight(0x7c5cfc, 0.15);
      fillLight.position.set(-500, -200, 500);
      scene.add(fillLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(0, 200, -500);
      scene.add(backLight);

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
      while (modGroupRef.current.children.length > 0) modGroupRef.current.remove(modGroupRef.current.children[0]);
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
        }

        if (mod.label && mod.coordinates.length >= 1 && progress > 0.5) {
          const c = mod.coordinates[0];
          const div = document.createElement("div");
          div.style.cssText = `padding:3px 8px;border-radius:6px;background:rgba(15,15,20,0.85);backdrop-filter:blur(4px);border:1px solid rgba(124,92,252,0.3);color:#f0eef6;font-size:11px;font-family:Inter,system-ui,sans-serif;font-weight:500;white-space:nowrap;opacity:${Math.min(1,(progress-0.5)*2)};`;
          div.textContent = mod.label + (mod.score !== undefined ? ` ${Math.round(mod.score * 100)}%` : "");
          const labelObj = new CSS2DObject(div);
          labelObj.position.set(c[0], c[1] + 30, c[2]);
          labelGroupRef.current.add(labelObj);
        }
      });
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
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
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
                borderRadius: 8,
                backgroundColor: layerVisibility[name] ? "rgba(15, 15, 20, 0.85)" : "rgba(15, 15, 20, 0.5)",
                border: `1px solid ${layerVisibility[name] ? "var(--accent)" : "var(--border)"}`,
                cursor: "pointer",
                backdropFilter: "blur(4px)",
                transition: "all 0.2s ease",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: layerVisibility[name] ? "var(--text-primary)" : "var(--text-muted)",
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
          <div style={{ position: "absolute", left: cursorPosition.x - 10, top: cursorPosition.y - 10, width: 20, height: 20, border: "2px solid var(--accent)", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 0 8px rgba(124, 92, 252, 0.4)" }} />
        )}
      </div>
    );
  }
);

LayeredAnatomyViewer.displayName = "LayeredAnatomyViewer";
export default LayeredAnatomyViewer;

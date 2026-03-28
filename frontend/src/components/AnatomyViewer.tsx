import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Modification } from "../utils/api";

interface OrganMetadata {
  [key: string]: {
    file: string;
    color: string;
    position: number[];
    label: string;
  };
}

interface Props {
  onOrganClick: (organName: string, point: number[], normal: number[]) => void;
  onIncisionTrace: (organName: string, points: number[][]) => void;
  modifications: Modification[];
  animationProgress?: Map<number, number>;
  selectedOrgan: string | null;
  cursorPosition: { x: number; y: number } | null;
}

export interface AnatomyViewerHandle {
  getCamera: () => THREE.Camera | null;
  getScene: () => THREE.Scene | null;
  getCanvasRect: () => DOMRect | null;
  captureCanvas: () => string | null;
}

const AnatomyViewer = forwardRef<AnatomyViewerHandle, Props>(
  ({ onOrganClick, onIncisionTrace, modifications, animationProgress, selectedOrgan, cursorPosition }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const labelRendererRef = useRef<CSS2DRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const organsRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const modGroupRef = useRef<THREE.Group>(new THREE.Group());
    const labelGroupRef = useRef<THREE.Group>(new THREE.Group());
    const [isLoading, setIsLoading] = useState(true);
    const isDraggingRef = useRef(false);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const tracePointsRef = useRef<number[][]>([]);
    const traceOrganRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCamera: () => cameraRef.current,
      getScene: () => sceneRef.current,
      getCanvasRect: () => containerRef.current?.getBoundingClientRect() || null,
      captureCanvas: () => {
        if (!rendererRef.current) return null;
        rendererRef.current.render(sceneRef.current!, cameraRef.current!);
        return rendererRef.current.domElement.toDataURL("image/png").split(",")[1];
      },
    }));

    // Initialize Three.js scene
    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f0f14);
      scene.fog = new THREE.Fog(0x0f0f14, 8, 15);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 1, 5);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // CSS2D label renderer
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
      controls.minDistance = 2;
      controls.maxDistance = 10;
      controlsRef.current = controls;

      scene.add(new THREE.AmbientLight(0x334466, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(3, 5, 4);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0x7c5cfc, 0.2);
      fillLight.position.set(-3, 2, -2);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xff8844, 0.2);
      rimLight.position.set(0, -2, 3);
      scene.add(rimLight);

      modGroupRef.current.name = "modifications";
      scene.add(modGroupRef.current);
      labelGroupRef.current.name = "labels";
      scene.add(labelGroupRef.current);

      const grid = new THREE.GridHelper(10, 20, 0x2a2a3d, 0x1a1a24);
      grid.position.y = -2;
      scene.add(grid);

      loadOrgans(scene);

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

    const loadOrgans = async (scene: THREE.Scene) => {
      try {
        const res = await fetch("/models/metadata.json");
        const metadata: OrganMetadata = await res.json();
        const loader = new OBJLoader();

        for (const [name, data] of Object.entries(metadata)) {
          try {
            const objText = await (await fetch(`/models/${data.file}`)).text();
            const obj = loader.parse(objText);
            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshPhongMaterial({
                  color: new THREE.Color(data.color),
                  specular: 0x333333,
                  shininess: 30,
                  transparent: true,
                  opacity: 0.85,
                });
                child.userData.organName = name;
                child.name = name;
                child.castShadow = true;
                child.receiveShadow = true;
                organsRef.current.set(name, child);
              }
            });
            obj.name = name;
            obj.userData.organName = name;
            scene.add(obj);
          } catch (e) {
            console.warn(`Failed to load ${name}:`, e);
          }
        }
        setIsLoading(false);
      } catch (e) {
        console.error("Failed to load metadata:", e);
        setIsLoading(false);
      }
    };

    useEffect(() => {
      organsRef.current.forEach((mesh, name) => {
        const mat = mesh.material as THREE.MeshPhongMaterial;
        if (name === selectedOrgan) {
          mat.emissive = new THREE.Color(0x7c5cfc);
          mat.emissiveIntensity = 0.35;
          mat.opacity = 1.0;
        } else {
          mat.emissive = new THREE.Color(0x000000);
          mat.emissiveIntensity = 0;
          mat.opacity = 0.85;
        }
      });
    }, [selectedOrgan]);

    // Render modifications with animation support
    useEffect(() => {
      // Clear old
      while (modGroupRef.current.children.length > 0) {
        const child = modGroupRef.current.children[0];
        modGroupRef.current.remove(child);
      }
      while (labelGroupRef.current.children.length > 0) {
        const child = labelGroupRef.current.children[0];
        if (child instanceof CSS2DObject) {
          child.element.remove();
        }
        labelGroupRef.current.remove(child);
      }

      modifications.forEach((mod, index) => {
        const progress = animationProgress?.get(index) ?? 1;
        if (progress <= 0) return; // Not yet visible

        if (mod.type === "incision" && mod.coordinates.length >= 2) {
          const allPoints = mod.coordinates.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
          const geometry = new THREE.BufferGeometry().setFromPoints(allPoints);
          // Animate: draw line progressively
          const drawCount = Math.max(2, Math.floor(allPoints.length * progress));
          geometry.setDrawRange(0, drawCount);
          const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(mod.color || "#ff6b6b"),
            linewidth: 3,
          });
          const line = new THREE.Line(geometry, material);
          modGroupRef.current.add(line);

        } else if (mod.type === "zone" && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const radius = mod.radius || 0.15;
          const geometry = new THREE.SphereGeometry(radius, 16, 16);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(mod.color || "#fbbf24"),
            transparent: true,
            opacity: 0.3 * progress,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(c[0], c[1], c[2]);
          // Pulse animation: scale up
          const scale = 0.3 + 0.7 * progress;
          sphere.scale.setScalar(scale);
          modGroupRef.current.add(sphere);

        } else if (mod.type === "highlight" && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const geometry = new THREE.SphereGeometry(0.08, 16, 16);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(mod.color || "#7c5cfc"),
            transparent: true,
            opacity: 0.6 * progress,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(c[0], c[1], c[2]);
          sphere.scale.setScalar(0.5 + 0.5 * progress);
          modGroupRef.current.add(sphere);

          // Glow ring
          const ringGeo = new THREE.RingGeometry(0.1, 0.14, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(mod.color || "#7c5cfc"),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4 * progress,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(c[0], c[1], c[2]);
          ring.lookAt(cameraRef.current?.position || new THREE.Vector3(0, 0, 5));
          modGroupRef.current.add(ring);

        } else if (mod.type === "heatmap" && mod.coordinates.length >= 1) {
          // Semantic query heatmap
          const c = mod.coordinates[0];
          const score = mod.score ?? 0.5;
          const radius = mod.radius || 0.2;
          const geometry = new THREE.SphereGeometry(radius, 16, 16);
          // Color gradient: purple (low) → green (high)
          const color = new THREE.Color().lerpColors(
            new THREE.Color("#7c5cfc"),
            new THREE.Color("#34d399"),
            score
          );
          const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.15 + 0.35 * score * progress,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(c[0], c[1], c[2]);
          sphere.scale.setScalar(progress);
          modGroupRef.current.add(sphere);
        }

        // Add floating label for any mod with a label
        if (mod.label && mod.coordinates.length >= 1 && progress > 0.5) {
          const c = mod.coordinates[0];
          const div = document.createElement("div");
          div.style.cssText = `
            padding: 3px 8px;
            border-radius: 6px;
            background: rgba(15, 15, 20, 0.85);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(124, 92, 252, 0.3);
            color: #f0eef6;
            font-size: 11px;
            font-family: Inter, system-ui, sans-serif;
            font-weight: 500;
            white-space: nowrap;
            opacity: ${Math.min(1, (progress - 0.5) * 2)};
            transition: opacity 0.3s ease;
          `;
          div.textContent = mod.label;
          if (mod.score !== undefined) {
            div.textContent += ` ${Math.round(mod.score * 100)}%`;
          }
          const labelObj = new CSS2DObject(div);
          labelObj.position.set(c[0], c[1] + 0.2, c[2]);
          labelGroupRef.current.add(labelObj);
        }
      });
    }, [modifications, animationProgress]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
      tracePointsRef.current = [];
      traceOrganRef.current = null;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!mouseDownPosRef.current) return;
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDraggingRef.current = true;

      if (e.shiftKey && isDraggingRef.current && cameraRef.current && sceneRef.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
        if (intersects.length > 0) {
          const p = intersects[0].point;
          tracePointsRef.current.push([p.x, p.y, p.z]);
          if (!traceOrganRef.current) {
            traceOrganRef.current = intersects[0].object.userData?.organName || "unknown";
          }
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
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          const organName = hit.object.userData?.organName || hit.object.name || "unknown";
          const point = [hit.point.x, hit.point.y, hit.point.z];
          const normal = hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 1, 0];
          onOrganClick(organName, point, normal);
        }
      }

      mouseDownPosRef.current = null;
    }, [onOrganClick, onIncisionTrace]);

    return (
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {isLoading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading anatomy...</span>
          </div>
        )}
        {cursorPosition && (
          <div style={{ position: "absolute", left: cursorPosition.x - 10, top: cursorPosition.y - 10, width: 20, height: 20, border: "2px solid var(--accent)", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 0 8px rgba(124, 92, 252, 0.4)" }} />
        )}
      </div>
    );
  }
);

AnatomyViewer.displayName = "AnatomyViewer";
export default AnatomyViewer;

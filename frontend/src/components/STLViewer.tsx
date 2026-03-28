import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Modification } from "../utils/api";

interface STLStructure {
  name: string;
  color: string;
}

interface Props {
  stlUrls: string[];
  structures: STLStructure[];
  onOrganClick: (organName: string, point: number[], normal: number[]) => void;
  onIncisionTrace: (organName: string, points: number[][]) => void;
  modifications: Modification[];
  animationProgress?: Map<number, number>;
  selectedOrgan: string | null;
  cursorPosition: { x: number; y: number } | null;
}

export interface STLViewerHandle {
  getCamera: () => THREE.Camera | null;
  getScene: () => THREE.Scene | null;
  getCanvasRect: () => DOMRect | null;
  captureCanvas: () => string | null;
}

const STLViewer = forwardRef<STLViewerHandle, Props>(
  ({ stlUrls, structures, onOrganClick, onIncisionTrace, modifications, animationProgress, selectedOrgan, cursorPosition }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const labelRendererRef = useRef<CSS2DRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const meshesRef = useRef<THREE.Mesh[]>([]);
    const modGroupRef = useRef<THREE.Group>(new THREE.Group());
    const labelGroupRef = useRef<THREE.Group>(new THREE.Group());
    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState("");
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

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f0f14);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      camera.position.set(0, 0, 500);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Label renderer
      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(width, height);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0";
      labelRenderer.domElement.style.left = "0";
      labelRenderer.domElement.style.pointerEvents = "none";
      container.appendChild(labelRenderer.domElement);
      labelRendererRef.current = labelRenderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 50;
      controls.maxDistance = 3000;
      controlsRef.current = controls;

      // Lighting
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

      // Modification + label groups
      modGroupRef.current.name = "modifications";
      scene.add(modGroupRef.current);
      labelGroupRef.current.name = "labels";
      scene.add(labelGroupRef.current);

      // Load STL files
      const loader = new STLLoader();
      const loadedMeshes: THREE.Mesh[] = [];
      let loadCount = 0;

      const STRUCTURE_OPACITY: Record<string, number> = {
        bone: 0.9,
        contrast_tissue: 0.6,
        soft_tissue: 0.4,
      };

      stlUrls.forEach((url, index) => {
        const structInfo = structures[index] || { name: `structure_${index}`, color: "#cccccc" };
        setLoadProgress(`Loading ${structInfo.name}...`);

        // Load from backend API
        const fullUrl = `http://localhost:8000/api${url}`;

        loader.load(
          fullUrl,
          (geometry) => {
            geometry.computeVertexNormals();
            geometry.center();

            const material = new THREE.MeshPhongMaterial({
              color: new THREE.Color(structInfo.color),
              specular: 0x222222,
              shininess: structInfo.name === "bone" ? 60 : 20,
              transparent: true,
              opacity: STRUCTURE_OPACITY[structInfo.name] ?? 0.7,
              side: THREE.DoubleSide,
              depthWrite: true,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData.organName = structInfo.name;
            mesh.name = structInfo.name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            scene.add(mesh);
            loadedMeshes.push(mesh);
            loadCount++;

            // Once all loaded, auto-fit camera
            if (loadCount === stlUrls.length) {
              meshesRef.current = loadedMeshes;

              // Compute bounding box of all meshes
              const box = new THREE.Box3();
              loadedMeshes.forEach((m) => box.expandByObject(m));
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);

              // Position camera to fit
              const fov = camera.fov * (Math.PI / 180);
              const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;

              camera.position.set(center.x, center.y, center.z + cameraDistance);
              controls.target.copy(center);
              controls.minDistance = cameraDistance * 0.1;
              controls.maxDistance = cameraDistance * 5;
              controls.update();

              setIsLoading(false);
              setLoadProgress("");
            }
          },
          (progress) => {
            if (progress.total > 0) {
              setLoadProgress(`Loading ${structInfo.name}: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
          },
          (error) => {
            console.error(`Failed to load ${url}:`, error);
            loadCount++;
            if (loadCount === stlUrls.length) {
              meshesRef.current = loadedMeshes;
              setIsLoading(false);
            }
          }
        );
      });

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
      };
      animate();

      // Resize handler
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
    }, [stlUrls, structures]);

    // Highlight selected organ
    useEffect(() => {
      meshesRef.current.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshPhongMaterial;
        if (mesh.userData.organName === selectedOrgan) {
          mat.emissive = new THREE.Color(0x7c5cfc);
          mat.emissiveIntensity = 0.4;
        } else {
          mat.emissive = new THREE.Color(0x000000);
          mat.emissiveIntensity = 0;
        }
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
          div.style.cssText = `padding:3px 8px;border-radius:6px;background:rgba(15,15,20,0.85);backdrop-filter:blur(4px);border:1px solid rgba(124,92,252,0.3);color:#f0eef6;font-size:11px;font-family:Inter,system-ui,sans-serif;font-weight:500;white-space:nowrap;opacity:${Math.min(1, (progress - 0.5) * 2)};`;
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
        const hits = rc.intersectObjects(sceneRef.current.children, true).filter((h) => {
          const n = h.object.userData?.organName;
          return n && n !== "modifications" && n !== "labels";
        });
        if (hits.length > 0) {
          const hit = hits[0];
          onOrganClick(
            hit.object.userData?.organName || "unknown",
            [hit.point.x, hit.point.y, hit.point.z],
            hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 1, 0]
          );
        }
      }
      mouseDownPosRef.current = null;
    }, [onOrganClick, onIncisionTrace]);

    return (
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        {isLoading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 10 }}>
            <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{loadProgress || "Loading CT scan..."}</span>
          </div>
        )}
        {cursorPosition && (
          <div style={{ position: "absolute", left: cursorPosition.x - 10, top: cursorPosition.y - 10, width: 20, height: 20, border: "2px solid var(--accent)", borderRadius: "50%", pointerEvents: "none", boxShadow: "0 0 8px rgba(124, 92, 252, 0.4)" }} />
        )}
      </div>
    );
  }
);

STLViewer.displayName = "STLViewer";
export default STLViewer;

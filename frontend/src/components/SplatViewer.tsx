import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import type { Modification } from "../utils/api";

interface Props {
  splatPath: string;
  onPointClick: (point: number[]) => void;
  modifications: Modification[];
}

export interface SplatViewerHandle {
  getCamera: () => THREE.Camera | null;
  getScene: () => THREE.Scene | null;
  getCanvasRect: () => DOMRect | null;
}

const SplatViewer = forwardRef<SplatViewerHandle, Props>(
  ({ splatPath, onPointClick, modifications }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const modGroupRef = useRef<THREE.Group>(new THREE.Group());
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCamera: () => cameraRef.current,
      getScene: () => sceneRef.current,
      getCanvasRect: () => containerRef.current?.getBoundingClientRect() || null,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;

      try {
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 1, 5],
          initialCameraLookAt: [0, 0, 0],
          rootElement: container,
          selfDrivenMode: true,
          sharedMemoryForWorkers: false,
        });

        viewerRef.current = viewer;

        // Access internal Three.js objects
        if (viewer.threeScene) sceneRef.current = viewer.threeScene;
        if (viewer.camera) cameraRef.current = viewer.camera;

        // Add modification overlay group
        if (sceneRef.current) {
          modGroupRef.current.name = "modifications";
          sceneRef.current.add(modGroupRef.current);
        }

        // Load the splat scene
        viewer
          .addSplatScene(splatPath, {
            splatAlphaRemovalThreshold: 5,
            showLoadingUI: false,
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          })
          .then(() => {
            viewer.start();
            setIsLoading(false);

            // Grab scene/camera refs after start if not available before
            if (!sceneRef.current && viewer.threeScene) sceneRef.current = viewer.threeScene;
            if (!cameraRef.current && viewer.camera) cameraRef.current = viewer.camera;
          })
          .catch((err: Error) => {
            console.error("Failed to load splat:", err);
            setLoadError(err.message || "Failed to load 3D scene");
            setIsLoading(false);
          });
      } catch (err: any) {
        console.error("SplatViewer init error:", err);
        setLoadError(err.message || "Failed to initialize viewer");
        setIsLoading(false);
      }

      return () => {
        if (viewerRef.current) {
          try {
            viewerRef.current.stop();
            viewerRef.current.dispose();
          } catch {
            // Viewer cleanup can throw
          }
        }
      };
    }, [splatPath]);

    // Click handler for raycasting
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (!cameraRef.current || !sceneRef.current) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        // Create a point along the ray at a reasonable depth for interaction
        const direction = raycaster.ray.direction.clone();
        const origin = raycaster.ray.origin.clone();
        const point = origin.add(direction.multiplyScalar(3));

        onPointClick([point.x, point.y, point.z]);
      },
      [onPointClick]
    );

    // Render modifications
    useEffect(() => {
      while (modGroupRef.current.children.length > 0) {
        modGroupRef.current.remove(modGroupRef.current.children[0]);
      }

      for (const mod of modifications) {
        if (mod.type === "incision" && mod.coordinates.length >= 2) {
          const points = mod.coordinates.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(mod.color || "#7c5cfc"),
            linewidth: 3,
          });
          modGroupRef.current.add(new THREE.Line(geometry, material));
        } else if (mod.type === "zone" && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const geometry = new THREE.SphereGeometry(0.15, 16, 16);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(mod.color || "#fbbf24"),
            transparent: true,
            opacity: 0.3,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(c[0], c[1], c[2]);
          modGroupRef.current.add(sphere);
        } else if (mod.type === "highlight" && mod.coordinates.length >= 1) {
          const c = mod.coordinates[0];
          const geometry = new THREE.SphereGeometry(0.08, 16, 16);
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(mod.color || "#7c5cfc"),
            transparent: true,
            opacity: 0.5,
          });
          const sphere = new THREE.Mesh(geometry, material);
          sphere.position.set(c[0], c[1], c[2]);
          modGroupRef.current.add(sphere);
        }
      }
    }, [modifications]);

    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          cursor: "crosshair",
          backgroundColor: "#0f0f14",
        }}
        onClick={handleClick}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: "2px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              Loading Gaussian Splat...
            </span>
          </div>
        )}
        {loadError && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              zIndex: 10,
            }}
          >
            <p style={{ color: "var(--risk-high)", marginBottom: 8 }}>
              Splat viewer unavailable
            </p>
            <p style={{ fontSize: "0.75rem" }}>{loadError}</p>
          </div>
        )}
      </div>
    );
  }
);

SplatViewer.displayName = "SplatViewer";
export default SplatViewer;

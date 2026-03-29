import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import { getWorld, selectSpzUrl } from "../utils/worldlabs";

interface Props {
  worldId: string;
  onLoaded: () => void;
  onError?: (err: string) => void;
}

export default function SplatBackground({ worldId, onLoaded, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;

    (async () => {
      try {
        // Fetch world data and resolve SPZ URL
        const world = await getWorld(worldId);
        const spzUrl = selectSpzUrl(world);
        if (!spzUrl) throw new Error("No SPZ URL available for this world");
        if (disposed) return;

        // Initialize Gaussian splat viewer
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [0, 0, -2],
          initialCameraLookAt: [0, 0, 2],
          rootElement: container,
          selfDrivenMode: true,
          sharedMemoryForWorkers: false,
          dynamicScene: false,
        });

        viewerRef.current = viewer;

        await viewer.addSplatScene(spzUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        });

        if (disposed) return;
        viewer.start();
        onLoaded();
      } catch (err: any) {
        if (disposed) return;
        const msg = err.message || "Failed to load world";
        console.error("SplatBackground error:", msg);
        setError(msg);
        onError?.(msg);
      }
    })();

    return () => {
      disposed = true;
      if (viewerRef.current) {
        try {
          viewerRef.current.stop();
          viewerRef.current.dispose();
        } catch {
          // Viewer cleanup can throw
        }
        viewerRef.current = null;
      }
    };
  }, [worldId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "#0a0a0f",
      }}
    >
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-mono)",
          }}
        >
          World model unavailable
        </div>
      )}
    </div>
  );
}

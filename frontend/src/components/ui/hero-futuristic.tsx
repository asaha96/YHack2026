import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAspect, useTexture } from "@react-three/drei";
import type { Mesh, Vector2 } from "three";
import * as THREE from "three/webgpu";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import {
  abs,
  add,
  blendScreen,
  float,
  mix,
  mod,
  mx_cell_noise_float,
  oneMinus,
  pass,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";

import heroPoster from "../../assets/hero.png";

const TEXTUREMAP = {
  src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
};

const DEPTHMAP = {
  src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80&sat=-100&blend=000000&blend-mode=multiply&blend-alpha=35",
};

const WIDTH = 300;
const HEIGHT = 300;

type HeroFuturisticProps = {
  badge?: string;
  title?: string;
  subtitle?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onExplore?: () => void;
};

type PostProcessingInstance = {
  outputNode: unknown;
  renderAsync: () => Promise<void>;
};

type WebGPUThree = typeof THREE & {
  PostProcessing: new (renderer: unknown) => PostProcessingInstance;
  WebGPURenderer: new (parameters: unknown) => {
    init: () => Promise<void>;
  };
};

const webgpuThree = THREE as unknown as WebGPUThree;

function PostProcessing({
  strength = 1,
  threshold = 1,
  fullScreenEffect = true,
}: {
  strength?: number;
  threshold?: number;
  fullScreenEffect?: boolean;
}) {
  const { gl, scene, camera } = useThree();
  const scanProgress = useMemo(() => uniform(0), []);

  const render = useMemo(() => {
    const postProcessing = new webgpuThree.PostProcessing(gl);
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode("output");
    const bloomPass = bloom(scenePassColor, strength, 0.5, threshold);

    const scanPos = float(scanProgress.value);
    const uvY = uv().y;
    const scanWidth = float(0.05);
    const scanLine = smoothstep(0, scanWidth, abs(uvY.sub(scanPos)));
    const redOverlay = vec3(1, 0.18, 0.24).mul(oneMinus(scanLine)).mul(0.38);

    const withScanEffect = mix(
      scenePassColor,
      add(scenePassColor, redOverlay),
      fullScreenEffect ? smoothstep(0.88, 1.0, oneMinus(scanLine)) : 1.0,
    );

    postProcessing.outputNode = withScanEffect.add(bloomPass);
    return postProcessing;
  }, [camera, fullScreenEffect, gl, scanProgress, scene, strength, threshold]);

  useFrame(({ clock }) => {
    // eslint-disable-next-line react-hooks/immutability
    scanProgress.value = Math.sin(clock.getElapsedTime() * 0.5) * 0.5 + 0.5;
    void render.renderAsync();
  }, 1);

  return null;
}

function Scene() {
  const [rawMap, depthMap] = useTexture([TEXTUREMAP.src, DEPTHMAP.src]);
  const meshRef = useRef<Mesh>(null);
  const [visible, setVisible] = useState(false);
  const pointerUniformRef = useRef(uniform(new THREE.Vector2(0, 0)));
  const progressUniformRef = useRef(uniform(0));

  useEffect(() => {
    if (rawMap && depthMap) {
      setVisible(true);
    }
  }, [depthMap, rawMap]);

  const material = useMemo(() => {
    const strength = 0.012;
    const tDepthMap = texture(depthMap);
    const depth = tDepthMap.r;
    // eslint-disable-next-line react-hooks/refs
    const tMap = texture(rawMap, uv().add(depth.mul(pointerUniformRef.current).mul(strength)));

    const aspect = float(WIDTH).div(HEIGHT);
    const tUv = vec2(uv().x.mul(aspect), uv().y);
    const tiling = vec2(120);
    const tiledUv = mod(tUv.mul(tiling), 2).sub(1);
    const brightness = mx_cell_noise_float(tUv.mul(tiling).div(2));
    const dist = float(tiledUv.length());
    const dot = float(smoothstep(0.5, 0.49, dist)).mul(brightness);
    // eslint-disable-next-line react-hooks/refs
    const flow = oneMinus(smoothstep(0, 0.02, abs(depth.sub(progressUniformRef.current))));
    const mask = dot.mul(flow).mul(vec3(10, 0.3, 0.6));
    const final = blendScreen(tMap, mask);

    return new THREE.MeshBasicNodeMaterial({
      colorNode: final,
      transparent: true,
      opacity: 0,
    });
  }, [depthMap, rawMap]);

  const [w, h] = useAspect(WIDTH, HEIGHT);

  useFrame(({ clock, pointer }) => {
    progressUniformRef.current.value = Math.sin(clock.getElapsedTime() * 0.5) * 0.5 + 0.5;
    (pointerUniformRef.current.value as Vector2).copy(pointer);

    const currentMaterial = meshRef.current?.material as { opacity?: number } | undefined;
    if (currentMaterial?.opacity !== undefined) {
      currentMaterial.opacity = THREE.MathUtils.lerp(currentMaterial.opacity, visible ? 1 : 0, 0.07);
    }
  });

  return (
    <mesh
      ref={meshRef}
      scale={[w * 0.46, h * 0.46, 1]}
      material={material}
      position={[0, -0.02, 0]}
    >
      <planeGeometry />
    </mesh>
  );
}

function HeroCanvas() {
  return (
    <Canvas
      camera={{ fov: 38, position: [0, 0, 1.5] }}
      dpr={[1, 1.5]}
      flat
      gl={(props) => {
        const renderer = new webgpuThree.WebGPURenderer(props);
        void renderer.init().catch((error) => {
          console.error("WebGPU renderer init failed", error);
        });
        return renderer as never;
      }}
    >
      <PostProcessing fullScreenEffect />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}

export default function HeroFuturistic({
  badge = "Surgical Simulation",
  title = "Practice on your patient's exact anatomy",
  subtitle = "CT and MRI scans reconstructed into navigable 3D models. Simulate procedures with hand tracking. AI-guided risk assessment.",
  primaryActionLabel = "Start Simulation",
  secondaryActionLabel = "How it works",
  onPrimaryAction,
  onSecondaryAction,
  onExplore,
}: HeroFuturisticProps) {
  const titleWords = useMemo(() => title.split(" "), [title]);
  const wordDelays = useMemo(
    () => titleWords.map((_, index) => ((index * 17) % 7) / 100),
    [titleWords],
  );
  const subtitleDelay = 0.06;
  const [visibleWords, setVisibleWords] = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const webgpuEnabled = typeof navigator !== "undefined" && "gpu" in navigator;

  useEffect(() => {
    if (visibleWords < titleWords.length) {
      const timeout = window.setTimeout(() => setVisibleWords((current) => current + 1), 170);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => setSubtitleVisible(true), 380);
    return () => window.clearTimeout(timeout);
  }, [titleWords.length, visibleWords]);

  return (
    <section className="hero-futuristic">
      <div className="hero-futuristic__grid" aria-hidden="true" />
      <div className="hero-futuristic__glow hero-futuristic__glow--top" aria-hidden="true" />
      <div className="hero-futuristic__glow hero-futuristic__glow--bottom" aria-hidden="true" />

      <div className="hero-futuristic__content">
        <div className="hero-futuristic__badge">{badge}</div>

        <h1 className="hero-futuristic__title" aria-label={title}>
          {titleWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className={index < visibleWords ? "hero-futuristic__word hero-futuristic__word--visible" : "hero-futuristic__word"}
              style={{
                animationDelay: `${index * 0.13 + (wordDelays[index] ?? 0)}s`,
                opacity: index < visibleWords ? undefined : 0,
              }}
            >
              {word}
            </span>
          ))}
        </h1>

        <p
          className={subtitleVisible ? "hero-futuristic__subtitle hero-futuristic__subtitle--visible" : "hero-futuristic__subtitle"}
          style={{
            animationDelay: `${titleWords.length * 0.13 + 0.2 + subtitleDelay}s`,
            opacity: subtitleVisible ? undefined : 0,
          }}
        >
          {subtitle}
        </p>

        <div className="hero-futuristic__actions">
          <button className="hero-futuristic__primary" onClick={onPrimaryAction} type="button">
            <span>{primaryActionLabel}</span>
            <ArrowRight size={16} strokeWidth={2.2} />
          </button>

          <button className="hero-futuristic__secondary" onClick={onSecondaryAction} type="button">
            {secondaryActionLabel}
          </button>
        </div>

        <button className="hero-futuristic__explore" onClick={onExplore} type="button">
          <span>Scroll to explore</span>
          <ArrowDown size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="hero-futuristic__visual" aria-hidden="true">
        {webgpuEnabled ? (
          <HeroCanvas />
        ) : (
          <div className="hero-futuristic__fallback">
            <img className="hero-futuristic__poster" src={heroPoster} alt="" />
          </div>
        )}
      </div>
    </section>
  );
}

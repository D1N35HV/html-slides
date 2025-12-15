import React, { Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// Types for slide items and component props
export type SlideItem = { title?: string; html?: string; imageUrl?: string };
export type LaptopShowcaseHandle = {
  nextSlide: () => void;
  prevSlide: () => void;
  focus: () => void;
};

type LaptopShowcaseProps = {
  slides?: SlideItem[];
  autoPlay?: boolean;
  autoPlayInterval?: number; // ms
  initialOpen?: boolean;
  lidOpenAngle?: number; // degrees
  idleIntensity?: number; // 0..1
  slideTransitionDuration?: number; // ms
  useHDRI?: boolean;
  useGLTF?: boolean;
  gltfUrl?: string; // e.g. '/models/laptop.glb'
};

// Helper: detect WebGL availability
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      (canvas as any).getContext('webgl2')
    );
  } catch {
    return false;
  }
}

// Canvas slide renderer -> CanvasTexture
function useSlideTextures(slides: SlideItem[], width = 1024, height = 640) {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const texA = useRef<THREE.CanvasTexture | null>(null);
  const texB = useRef<THREE.CanvasTexture | null>(null);
  const canvasA = useRef<HTMLCanvasElement | null>(null);
  const canvasB = useRef<HTMLCanvasElement | null>(null);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.floor(width * dpr);
  const H = Math.floor(height * dpr);

  const drawSlide = useCallback((slide: SlideItem, canvas: HTMLCanvasElement) => {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // Background
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, W, H);
    // Header bar
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, 56 * dpr);
    // Circles (window controls)
    const cx = 16 * dpr;
    const cy = 28 * dpr;
    [ '#ef4444', '#f59e0b', '#10b981' ].forEach((c, i) => {
      ctx.beginPath();
      ctx.fillStyle = c;
      ctx.arc(cx + i * 20 * dpr, cy, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    });
    // Title
    ctx.fillStyle = '#e5e7eb';
    ctx.font = `${28 * dpr}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textBaseline = 'top';
    const title = slide.title || 'Slide';
    ctx.fillText(title, 20 * dpr, 68 * dpr);

    // Body HTML simplified to plain text if provided
    if (slide.html) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${18 * dpr}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
      const text = slide.html.replace(/<[^>]*>/g, '');
      const maxWidth = W - 40 * dpr;
      const lineHeight = 28 * dpr;
      const words = text.split(/\s+/);
      let line = '';
      let y = 110 * dpr;
      words.forEach((w) => {
        const test = line + w + ' ';
        const m = ctx.measureText(test);
        if (m.width > maxWidth) {
          ctx.fillText(line, 20 * dpr, y);
          line = w + ' ';
          y += lineHeight;
        } else {
          line = test;
        }
      });
      if (line) ctx.fillText(line, 20 * dpr, y);
    }

    // Optional image placement on right
    // To keep this module self-contained and fast, we skip remote image drawing by default.
    // If imageUrl is present and same-origin, you can enable it here.
  }, [W, H, dpr]);

  // Create textures once
  useMemo(() => {
    canvasA.current = document.createElement('canvas');
    canvasB.current = document.createElement('canvas');
    texA.current = new THREE.CanvasTexture(canvasA.current);
    texB.current = new THREE.CanvasTexture(canvasB.current);
    [texA.current, texB.current].forEach((t) => {
      if (!t) return;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
    });
  }, []);

  // Draw initial
  useEffect(() => {
    if (!slides.length) return;
    if (canvasA.current && texA.current) {
      drawSlide(slides[0], canvasA.current);
      texA.current.needsUpdate = true;
    }
  }, [slides, drawSlide]);

  const setIndex = useCallback((i: number) => {
    if (!slides.length) return;
    const clamped = ((i % slides.length) + slides.length) % slides.length;
    setNext(clamped);
    if (canvasB.current && texB.current) {
      drawSlide(slides[clamped], canvasB.current);
      texB.current.needsUpdate = true;
    }
  }, [slides, drawSlide]);

  const commitNext = useCallback(() => {
    if (next === null) return;
    // Swap A<-B
    const tmpTex = texA.current!;
    texA.current = texB.current!;
    texB.current = tmpTex;
    const tmpCanvas = canvasA.current!;
    canvasA.current = canvasB.current!;
    canvasB.current = tmpCanvas;
    setCurrent(next);
    setNext(null);
  }, [next]);

  return { texA, texB, current, next, setIndex, commitNext, count: slides.length, width: W, height: H };
}

// Three scene: Laptop
function LaptopModel({
  lidOpen, // 0..1
  screenAlpha, // 0..1 alpha of next slide (for crossfade)
  texA,
  texB,
  useGLTF = false,
  gltfUrl,
  idleIntensity = 0.02,
}: {
  lidOpen: number;
  screenAlpha: number;
  texA: React.MutableRefObject<THREE.CanvasTexture | null>;
  texB: React.MutableRefObject<THREE.CanvasTexture | null>;
  useGLTF?: boolean;
  gltfUrl?: string;
  idleIntensity?: number;
}) {
  const group = useRef<THREE.Group>(null!);
  const lid = useRef<THREE.Group>(null!);
  const time = useRef(0);

  useFrame((_, dt) => {
    time.current += dt;
    // Subtle idle bob
    if (group.current) {
      const t = time.current;
      group.current.rotation.y = Math.sin(t * 0.2) * 0.05 * idleIntensity;
      group.current.position.y = Math.sin(t * 0.8) * 0.02 * idleIntensity;
    }
    if (lid.current) {
      const target = THREE.MathUtils.degToRad(90 + 20) * lidOpen; // max ~110deg
      lid.current.rotation.x = THREE.MathUtils.lerp(lid.current.rotation.x, -target, 0.12);
    }
  });

  // Materials
  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#1f2937', metalness: 0.85, roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.6,
  }), []);
  const screenMatA = useMemo(() => new THREE.MeshBasicMaterial({ map: texA.current || undefined, transparent: true, opacity: 1 }), [texA]);
  const screenMatB = useMemo(() => new THREE.MeshBasicMaterial({ map: texB.current || undefined, transparent: true, opacity: 0 }), [texB]);

  // Update crossfade opacities
  useEffect(() => {
    if (screenMatA) screenMatA.opacity = 1 - screenAlpha;
    if (screenMatB) screenMatB.opacity = screenAlpha;
  }, [screenAlpha, screenMatA, screenMatB]);

  // Procedural model (Rounded boxes)
  const baseSize: [number, number, number] = [2.2, 0.1, 1.5];
  const lidSize: [number, number, number] = [2.2, 0.08, 1.45];
  const screenSize: [number, number] = [1.92, 1.08]; // aspect ~16:9

  return (
    <group ref={group} dispose={null}>
      {/* Base */}
      <group position={[0, 0, 0]}>
        <RoundedBox args={baseSize} radius={0.06} smoothness={2} castShadow receiveShadow>
          <primitive object={bodyMat} attach="material" />
        </RoundedBox>
        {/* Keyboard area as slightly inset plane */}
        <mesh position={[0, 0.055, -0.05]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <planeGeometry args={[2.0, 1.2, 1, 1]} />
          <meshPhysicalMaterial color="#111827" roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Trackpad */}
        <mesh position={[0, 0.057, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Replaced unsupported roundedRectGeometry with standard planeGeometry */}
          <planeGeometry args={[0.6, 0.35]} />
          <meshPhysicalMaterial color="#0b1220" roughness={0.9} metalness={0.1} />
        </mesh>
      </group>

      {/* Lid group rotates around back hinge */}
      <group ref={lid} position={[0, 0.055, -0.75]}>
        <group position={[0, 0, 0.725]}>
          <RoundedBox args={lidSize} radius={0.05} smoothness={2} castShadow>
            <primitive object={bodyMat} attach="material" />
          </RoundedBox>
          {/* Screen recess */}
          <mesh position={[0, 0.005, -0.03]}>
            <planeGeometry args={[screenSize[0], screenSize[1]]} />
            <meshStandardMaterial color="#000" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Screen content (two layers for crossfade) */}
          <mesh position={[0, 0.006, -0.029]} renderOrder={1}>
            <planeGeometry args={[screenSize[0] * 0.95, screenSize[1] * 0.90]} />
            <primitive attach="material" object={screenMatA} />
          </mesh>
          <mesh position={[0, 0.0061, -0.0289]} renderOrder={2}>
            <planeGeometry args={[screenSize[0] * 0.95, screenSize[1] * 0.90]} />
            <primitive attach="material" object={screenMatB} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Imperative camera focus helper
function useCameraFocus() {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);

  const focus = useCallback((pos: THREE.Vector3, lookAt: THREE.Vector3) => {
    targetPos.current = pos.clone();
    targetLook.current = lookAt.clone();
  }, []);

  useFrame(() => {
    if (!targetPos.current || !targetLook.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    const look = new THREE.Vector3();
    look.copy(targetLook.current);
    camera.lookAt(look);
    if (camera.position.distanceTo(targetPos.current) < 0.02) {
      targetPos.current = null;
      targetLook.current = null;
    }
  });

  return { focus };
}

// Main 3D scene wrapper
const LaptopScene = forwardRef<LaptopShowcaseHandle, LaptopShowcaseProps>(function LaptopScene(props, ref) {
  const {
    slides = [
      { title: 'Lightning-fast editing', html: 'Drag, drop, and align elements with smart guides. Auto-save keeps your team in sync.' },
      { title: 'Real-time collaboration', html: 'Invite teammates to co-edit. Comments, cursors, and history—all in one place.' },
      { title: 'Beautiful by default', html: 'Templates, typography, and icons built-in, so every deck looks pro.' },
    ],
    autoPlay = true,
    autoPlayInterval = 6000,
    initialOpen = true,
    lidOpenAngle = 110,
    idleIntensity = 0.04,
    slideTransitionDuration = 600,
    useHDRI = true,
    useGLTF = false,
    gltfUrl,
  } = props;

  const { texA, texB, current, next, setIndex, commitNext, count } = useSlideTextures(slides);
  const [alpha, setAlpha] = useState(0); // 0..1 crossfade
  const [lidOpen, setLidOpen] = useState(initialOpen ? 1 : 0);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [isAuto, setIsAuto] = useState(autoPlay);
  const sceneRoot = useRef<HTMLDivElement>(null);
  const clickTime = useRef<number>(0);

  // Camera focus
  const { focus } = useCameraFocus();
  const focusLaptop = useCallback(() => {
    // Position camera closer and centered on screen
    const camPos = new THREE.Vector3(0, 0.9, 1.7);
    const look = new THREE.Vector3(0, 0.5, 0);
    focus(camPos, look);
  }, [focus]);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    nextSlide: () => handleNext(),
    prevSlide: () => handlePrev(),
    focus: () => focusLaptop(),
  }));

  // Slide transition
  const startTransition = useCallback((toIndex: number) => {
    if (next !== null) return; // already transitioning
    setIndex(toIndex);
    const start = performance.now();
    const dur = slideTransitionDuration;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      setAlpha(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        commitNext();
        setAlpha(0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [setIndex, commitNext, slideTransitionDuration, next]);

  const handleNext = useCallback(() => {
    setIsAuto(false);
    startTransition(current + 1);
  }, [current, startTransition]);
  const handlePrev = useCallback(() => {
    setIsAuto(false);
    startTransition(current - 1);
  }, [current, startTransition]);

  // Autoplay
  useEffect(() => {
    if (!isAuto || count < 2) return;
    const id = setInterval(() => startTransition(current + 1), autoPlayInterval);
    return () => clearInterval(id);
  }, [isAuto, count, current, autoPlayInterval, startTransition]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key.toLowerCase() === 'f') focusLaptop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev, focusLaptop]);

  // Lid open animation on mount
  useEffect(() => {
    if (!initialOpen) return;
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      setLidOpen(THREE.MathUtils.smootherstep(t, 0, 1));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [initialOpen]);

  const onCanvasPointerDown = useCallback(() => {
    clickTime.current = performance.now();
  }, []);
  const onCanvasPointerUp = useCallback(() => {
    const dt = performance.now() - clickTime.current;
    if (dt < 200) {
      // tap -> toggle controls
      setControlsEnabled((v) => !v);
    }
  }, []);

  const showWebGL = typeof window !== 'undefined' && webglAvailable();

  return (
    <div className="relative">
      {/* Accessible controls */}
      <div className="absolute z-10 right-3 top-3 flex gap-2">
        <button aria-label="Previous slide" className="px-2 py-1 rounded-md bg-white/90 text-gray-800 shadow hover:bg-white" onClick={handlePrev}>
          ← Prev
        </button>
        <button aria-label="Next slide" className="px-2 py-1 rounded-md bg-white/90 text-gray-800 shadow hover:bg-white" onClick={handleNext}>
          Next →
        </button>
        <button aria-label="Focus on laptop" className="px-2 py-1 rounded-md bg-white/90 text-gray-800 shadow hover:bg-white" onClick={focusLaptop}>
          Focus
        </button>
      </div>

      {/* 3D or fallback */}
      {showWebGL ? (
        <div ref={sceneRoot} className="aspect-[16/10]" onPointerDown={onCanvasPointerDown} onPointerUp={onCanvasPointerUp}>
          <Canvas
            shadows
            dpr={[1, 1.75]}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            camera={{ position: [2.6, 1.6, 3.2], fov: 45 }}
          >
            {/* Lights */}
            <hemisphereLight intensity={0.55} groundColor="#1f2937" />
            <directionalLight castShadow position={[4, 6, 5]} intensity={0.9} shadow-mapSize={[1024, 1024]} />
            <spotLight position={[-4, 4, -3]} angle={0.5} intensity={0.4} penumbra={0.6} />
            <directionalLight position={[0, 2.5, -3]} intensity={0.4} color="#93c5fd" />

            <Suspense fallback={null}>
              {useHDRI ? <Environment preset="city" environmentIntensity={0.7} /> : null}
            </Suspense>

            {/* Laptop */}
            <group position={[0, 0.2, 0]} onClick={focusLaptop}> 
              <LaptopModel lidOpen={lidOpen} screenAlpha={alpha} texA={texA} texB={texB} useGLTF={useGLTF} gltfUrl={gltfUrl} idleIntensity={idleIntensity} />
            </group>

            {/* Ground */}
            <ContactShadows opacity={0.3} scale={10} blur={2.5} far={8} resolution={512} color="#000" />

            <OrbitControls enableDamping enabled={controlsEnabled} enablePan={false} minDistance={2.2} maxDistance={6.5} />
          </Canvas>
        </div>
      ) : (
        <div className="aspect-[16/10] flex items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900 text-slate-100">
          <div className="w-[88%] h-[70%] rounded-lg border border-white/10 bg-black/40 p-5">
            <div className="text-lg font-semibold">3D preview unavailable</div>
            <div className="mt-2 text-sm opacity-80">Your browser does not support WebGL. Showing a static preview.</div>
            <div className="mt-4 p-4 rounded-md bg-white/5">{slides[current]?.title}</div>
          </div>
        </div>
      )}
    </div>
  );
});

// Page section wrapper with copy + 3D scene
const Showcase3D: React.FC = () => {
  const sceneRef = useRef<LaptopShowcaseHandle>(null);
  return (
    <section id="showcase" className="relative">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold"
            >
              Edit slides on a 3D laptop.
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-3 text-gray-600"
            >
              Lightweight Three.js scene with animated lid, emissive screen, and smooth slide transitions. Orbit, focus, and keyboard-ready.
            </motion.p>
            <ul className="mt-6 space-y-3 text-gray-600">
              <li>• Procedural model (no heavy assets) with optional glTF swap</li>
              <li>• Canvas-based slide texture for crisp text</li>
              <li>• Orbit controls, click-to-focus, arrow key navigation</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button className="px-3 py-2 bg-blue-600 text-white rounded-md" onClick={() => sceneRef.current?.prevSlide()}>Prev ←</button>
              <button className="px-3 py-2 bg-blue-600 text-white rounded-md" onClick={() => sceneRef.current?.nextSlide()}>Next →</button>
              <button className="px-3 py-2 bg-slate-800 text-white rounded-md" onClick={() => sceneRef.current?.focus()}>Focus</button>
            </div>
          </div>
          <div className="relative rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl shadow-elevated overflow-hidden">
            <LaptopScene ref={sceneRef} autoPlay autoPlayInterval={6000} initialOpen lidOpenAngle={110} idleIntensity={0.04} slideTransitionDuration={600} useHDRI />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Showcase3D;

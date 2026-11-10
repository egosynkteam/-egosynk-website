"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import type { Group } from "three";
import { BRAND } from "@/lib/brand";

const MODEL = "/models/hydro-150.glb";

function can3D() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

function Tub({ spin, onReady }: { spin: boolean; onReady: () => void }) {
  const { scene } = useGLTF(MODEL);
  const ref = useRef<Group>(null);
  // Mounts only once the model has loaded (it suspends until then): swap the still out now.
  useEffect(() => { onReady(); }, [onReady]);
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return <primitive ref={ref} object={scene} />;
}

// Drag to turn the HYDRO tub. Opened from the "View in 3D" button (tub-viewer.tsx). The still
// render shows until the model has loaded, and stays if WebGL isn't available. With reduced
// motion on, the tub doesn't spin by itself.
export function Tub3D() {
  // Only ever rendered in the browser (see tub-viewer.tsx), so this can read the device directly.
  const [mode] = useState<"still" | "3d">(() => (can3D() ? "3d" : "still"));
  const [ready, setReady] = useState(false);
  const [markReady] = useState(() => () => setReady(true));
  const [spin] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches);

  return (
    <div className="relative aspect-[4/5] w-full">
      <Image src="/img/hydro-tub-34.webp" alt="HYDRO 150 pre-workout tub, Salted Nimbu, 420 g" fill priority sizes="(min-width: 768px) 45vw, 90vw"
        className={`object-contain transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />
      {mode === "3d" && (
        <Canvas className="!absolute inset-0" camera={{ position: [0, 0.04, 0.62], fov: 28 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
          role="img" aria-label="3D view of the HYDRO 150 tub. Drag to turn it.">
          <Suspense fallback={null}>
            <Environment resolution={256}>
              <Lightformer intensity={2.2} position={[0, 3, 2]} scale={[6, 2, 1]} />
              <Lightformer intensity={1.4} position={[-3, 1, 1]} scale={[2, 4, 1]} />
              <Lightformer intensity={2.6} color={BRAND.rustBright} position={[3, 0.5, -1]} scale={[1, 4, 1]} />
            </Environment>
            <ambientLight intensity={0.25} />
            <directionalLight position={[1.5, 2, 2]} intensity={1.6} />
            {/* Center puts the tub's middle at the origin; the camera distance frames it. */}
            <Center>
              <Tub spin={spin} onReady={markReady} />
            </Center>
            <ContactShadows position={[0, -0.1, 0]} opacity={0.55} scale={0.5} blur={2.4} far={0.2} />
          </Suspense>
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.8} maxPolarAngle={Math.PI / 1.9} />
        </Canvas>
      )}
      {mode === "3d" && (
        <p className="mono pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-micro uppercase tracking-[0.14em] text-steel">Drag to turn</p>
      )}
    </div>
  );
}

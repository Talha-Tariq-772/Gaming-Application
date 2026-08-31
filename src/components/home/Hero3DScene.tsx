"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

/**
 * Deliberately minimal: one wireframe geometry, two lights, no textures,
 * no shadows, no post-processing, no controls. This is the "cheaper
 * option that achieves the look" — the point is a 3D moment exists, not
 * a fully art-directed scene. Capped DPR keeps GPU cost down on retina
 * displays where it wouldn't add visible detail anyway.
 *
 * Only ever mounted by HeroVisual.tsx once eligibility (motion, viewport,
 * hardwareConcurrency) has already been checked — this module is never
 * imported statically by anything, only via next/dynamic.
 */
function RotatingShape() {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.x += delta * 0.15;
    mesh.current.rotation.y += delta * 0.25;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.4, 0]} />
      <meshStandardMaterial color="#c1440e" wireframe />
    </mesh>
  );
}

export default function Hero3DScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} intensity={1.4} color="#c1440e" />
      <RotatingShape />
    </Canvas>
  );
}

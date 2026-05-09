"use client";

import { useRef } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CombatEnemyShip } from "@/types/game";
import { RANGE_BY_ID } from "@/lib/combat/ranges";

interface EnemyDragControllerProps {
  staged: CombatEnemyShip;
  onDrag: (azimuthDeg: number, elevationDeg: number) => void;
}

// Convert a world-space point to (azimuthDeg, elevationDeg). Inverse of
// `shipWorldPosition`. Azimuth is measured clockwise from +X looking down +Y.
function worldToSpherical(p: THREE.Vector3): { azimuthDeg: number; elevationDeg: number } {
  const r = p.length();
  if (r < 1e-4) return { azimuthDeg: 0, elevationDeg: 0 };
  const elevationRad = Math.asin(p.y / r);
  const azimuthRad = Math.atan2(p.z, p.x);
  let azimuthDeg = (azimuthRad * 180) / Math.PI;
  azimuthDeg = ((azimuthDeg % 360) + 360) % 360;
  return {
    azimuthDeg,
    elevationDeg: (elevationRad * 180) / Math.PI,
  };
}

// Renders a transparent sphere at the ship's range radius. On left-press the
// sphere captures the pointer so subsequent moves continue to update the
// staged position even when the cursor strays past the sphere's edge in
// screen-space.
export default function EnemyDragController({ staged, onDrag }: EnemyDragControllerProps) {
  const pressedRef = useRef(false);
  const radius = RANGE_BY_ID[staged.range].radius;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return; // left-button only
    e.stopPropagation();
    pressedRef.current = true;
    // Pointer capture on the canvas so subsequent pointer events keep firing
    // even if the cursor leaves the sphere's screen-space hit area.
    const target = e.nativeEvent.target as Element | null;
    target?.setPointerCapture?.(e.nativeEvent.pointerId);
    const sph = worldToSpherical(e.point);
    onDrag(sph.azimuthDeg, sph.elevationDeg);
  };
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!pressedRef.current) return;
    e.stopPropagation();
    const sph = worldToSpherical(e.point);
    onDrag(sph.azimuthDeg, sph.elevationDeg);
  };
  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!pressedRef.current) return;
    e.stopPropagation();
    pressedRef.current = false;
    const target = e.nativeEvent.target as Element | null;
    target?.releasePointerCapture?.(e.nativeEvent.pointerId);
  };

  return (
    <mesh
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <sphereGeometry args={[radius, 48, 24]} />
      {/* `transparent + opacity 0` (instead of visible=false) keeps the mesh
         eligible for raycasting on all browsers — invisible-mesh raycast
         behavior has historically been inconsistent across environments. */}
      <meshBasicMaterial
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

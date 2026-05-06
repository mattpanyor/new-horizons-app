"use client";

import { useState } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { WeaponDef } from "@/lib/combat/playerShip";
import { CAMERA_MAX_DISTANCE } from "@/lib/combat/ranges";
import WeaponVolume from "./WeaponVolume";

interface WeaponAimControllerProps {
  weapon: WeaponDef;
  color: string;
  onPlace: (axis: { x: number; y: number; z: number }) => void;
}

// Renders an invisible large sphere as a raycast target. Pointer move on the
// sphere updates the local aim axis (cursor projects onto a unit sphere from
// origin). Left-click commits via onPlace. The WeaponVolume preview follows
// the aim axis until placement.
export default function WeaponAimController({
  weapon,
  color,
  onPlace,
}: WeaponAimControllerProps) {
  // Initial axis = +X (bow). Updated as the user moves the mouse.
  const [axis, setAxis] = useState<{ x: number; y: number; z: number }>(() => ({
    x: 1,
    y: 0,
    z: 0,
  }));

  const updateFromIntersection = (
    point: THREE.Vector3,
  ) => {
    const len = Math.sqrt(
      point.x * point.x + point.y * point.y + point.z * point.z,
    );
    if (len < 1e-4) return;
    setAxis({ x: point.x / len, y: point.y / len, z: point.z / len });
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    updateFromIntersection(e.point);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.nativeEvent.button !== 0) return; // only left-click commits
    e.stopPropagation();
    onPlace(axis);
  };

  // Large sphere covering the whole orbitable region. Invisible material but
  // depth-write off so it doesn't occlude actual scene meshes.
  const targetRadius = CAMERA_MAX_DISTANCE * 1.05;

  return (
    <>
      <mesh onPointerMove={handlePointerMove} onClick={handleClick}>
        <sphereGeometry args={[targetRadius, 32, 16]} />
        <meshBasicMaterial visible={false} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <WeaponVolume weapon={weapon} axis={axis} color={color} />
    </>
  );
}

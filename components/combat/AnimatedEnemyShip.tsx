"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { CombatEnemyShip } from "@/types/game";
import { FACE_BY_ID } from "@/lib/combat/faces";
import { SIZE_CLASS_BY_ID } from "@/lib/combat/sizeClasses";
import { resolveFactionColor } from "@/lib/combat/factions";
import { shadeColor } from "./ships/shipColor";
import { shipWorldPosition } from "./EnemyShip";
import Corvette from "./ships/Corvette";
import Frigate from "./ships/Frigate";
import Destroyer from "./ships/Destroyer";
import Cruiser from "./ships/Cruiser";
import Battlecruiser from "./ships/Battlecruiser";
import ObjectShip from "./ships/ObjectShip";

interface AnimatedEnemyShipProps {
  current: CombatEnemyShip;
  // Previous canonical state (from before the most recent gm-phase End Turn).
  // null/undefined → no animation, ship sits at `current` position.
  previous: CombatEnemyShip | null;
  // Timestamp (performance.now()) when the animation begins.
  animStartMs: number | null;
  // Duration of the animation in ms.
  animDurationMs: number;
  // Render in a darkened palette + dimmed label (face-filter inactive half).
  dim?: boolean;
  onClick?: () => void;
  onContextMenu?: (screenX: number, screenY: number) => void;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

function ShipMesh({
  sizeClass,
  color,
}: {
  sizeClass: CombatEnemyShip["sizeClass"];
  color: string;
}) {
  switch (sizeClass) {
    case "corvette":      return <Corvette      color={color} />;
    case "frigate":       return <Frigate       color={color} />;
    case "destroyer":     return <Destroyer     color={color} />;
    case "cruiser":       return <Cruiser       color={color} />;
    case "battlecruiser": return <Battlecruiser color={color} />;
    case "object":        return <ObjectShip    color={color} />;
  }
}

function buildFacingQuat(
  facing: CombatEnemyShip["facing"],
  pos: THREE.Vector3,
): THREE.Quaternion {
  const localFaceAxis = new THREE.Vector3(...FACE_BY_ID[facing].axis);
  const towardPlayer = pos.clone().multiplyScalar(-1).normalize();
  const q = new THREE.Quaternion();
  if (towardPlayer.lengthSq() < 1e-8) return q;
  q.setFromUnitVectors(localFaceAxis, towardPlayer);
  return q;
}

// Renders a ship with optional from→current animation. During the animation
// window, position and orientation lerp/slerp between previous and current; on
// completion, group sits at the canonical current position. Out-of-window
// renders are a snap to current.
export default function AnimatedEnemyShip({
  current,
  previous,
  animStartMs,
  animDurationMs,
  dim = false,
  onClick,
  onContextMenu,
}: AnimatedEnemyShipProps) {
  const groupRef = useRef<THREE.Group>(null);
  const sizeDef = SIZE_CLASS_BY_ID[current.sizeClass];
  const baseColor = resolveFactionColor(current.factionId);
  const color = dim ? shadeColor(baseColor, -0.35) : baseColor;

  // Pre-compute target (current) and source (previous) world transforms.
  const targetPos = useMemo(
    () => new THREE.Vector3(
      ...shipWorldPosition(current.range, current.azimuthDeg, current.elevationDeg),
    ),
    [current.range, current.azimuthDeg, current.elevationDeg],
  );
  const targetQuat = useMemo(() => buildFacingQuat(current.facing, targetPos), [current.facing, targetPos]);

  const sourcePos = useMemo(() => {
    if (!previous) return targetPos.clone();
    return new THREE.Vector3(
      ...shipWorldPosition(previous.range, previous.azimuthDeg, previous.elevationDeg),
    );
  }, [previous, targetPos]);
  const sourceQuat = useMemo(() => {
    if (!previous) return targetQuat.clone();
    return buildFacingQuat(previous.facing, sourcePos);
  }, [previous, sourcePos, targetQuat]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (animStartMs === null || !previous) {
      // Snap to canonical.
      g.position.copy(targetPos);
      g.quaternion.copy(targetQuat);
      return;
    }
    const elapsed = performance.now() - animStartMs;
    const t = Math.min(1, Math.max(0, elapsed / animDurationMs));
    // ease-in-out cubic.
    const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    g.position.lerpVectors(sourcePos, targetPos, k);
    g.quaternion.copy(sourceQuat).slerp(targetQuat, k);
  });

  return (
    <group
      ref={groupRef}
      scale={sizeDef.scale}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onContextMenu={
        onContextMenu
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              e.nativeEvent.preventDefault();
              onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
            }
          : undefined
      }
    >
      <ShipMesh sizeClass={current.sizeClass} color={color} />
      {current.label && (
        <Html
          position={[0, sizeDef.scale * 1.1, 0]}
          center
          occlude={false}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className={`px-2 py-0.5 rounded bg-black/55 border text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap ${
              dim
                ? "border-white/8 text-white/30"
                : "border-white/15 text-white/90"
            }`}
            style={cinzel}
          >
            {current.label}
          </div>
        </Html>
      )}
    </group>
  );
}

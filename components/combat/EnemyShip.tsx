"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import type { CombatEnemyShip } from "@/types/game";
import { RANGE_BY_ID } from "@/lib/combat/ranges";
import { FACE_BY_ID } from "@/lib/combat/faces";
import { SIZE_CLASS_BY_ID } from "@/lib/combat/sizeClasses";
import { resolveFactionColor } from "@/lib/combat/factions";
import { shadeColor } from "./ships/shipColor";
import Corvette from "./ships/Corvette";
import Frigate from "./ships/Frigate";
import Destroyer from "./ships/Destroyer";
import Cruiser from "./ships/Cruiser";
import Battlecruiser from "./ships/Battlecruiser";
import ObjectShip from "./ships/ObjectShip";
import ShipShield from "./ShipShield";

interface EnemyShipProps {
  enemy: CombatEnemyShip;
  // When true, render a thin red outline ring + ghost (used by GM staging).
  ghost?: boolean;
  // Override label visibility (default: shown).
  showLabel?: boolean;
  // When true, render in a darkened palette + dimmed label. Used by the face
  // filter to demote ships in the inactive hemisphere.
  dim?: boolean;
  // Click handler for GM interactions (Phase 6+). Ignored when undefined.
  onClick?: () => void;
  // Right-click handler for GM context menu (Phase 7+).
  onContextMenu?: (screenX: number, screenY: number) => void;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Convert (range, azimuthDeg, elevationDeg) to a world-space position.
//  azimuth = 0 → +X (bow direction = north on screen)
//  azimuth increases clockwise when viewed from above (+Y), so +Z is +90°.
//  elevation = 0 → equator, +90 → directly above the player on +Y.
export function shipWorldPosition(
  range: CombatEnemyShip["range"],
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  const r = RANGE_BY_ID[range].radius;
  const az = azimuthDeg * (Math.PI / 180);
  const el = elevationDeg * (Math.PI / 180);
  const horiz = r * Math.cos(el);
  return [horiz * Math.cos(az), r * Math.sin(el), horiz * Math.sin(az)];
}

// Quaternion that rotates the ship's local face axis to point AT the player
// (origin). The ship is placed at `position`; the direction toward the player
// is -position normalized.
function facingQuaternion(
  facing: CombatEnemyShip["facing"],
  position: [number, number, number],
): THREE.Quaternion {
  const localFaceAxis = new THREE.Vector3(...FACE_BY_ID[facing].axis);
  const towardPlayer = new THREE.Vector3(
    -position[0],
    -position[1],
    -position[2],
  ).normalize();
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(localFaceAxis, towardPlayer);
  return q;
}

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

export default function EnemyShip({
  enemy,
  ghost = false,
  showLabel = true,
  dim = false,
  onClick,
  onContextMenu,
}: EnemyShipProps) {
  const position = useMemo(
    () => shipWorldPosition(enemy.range, enemy.azimuthDeg, enemy.elevationDeg),
    [enemy.range, enemy.azimuthDeg, enemy.elevationDeg],
  );
  const quat = useMemo(
    () => facingQuaternion(enemy.facing, position),
    [enemy.facing, position],
  );

  const sizeDef = SIZE_CLASS_BY_ID[enemy.sizeClass];
  const baseColor = ghost ? "#ef4444" : resolveFactionColor(enemy.factionId);
  // Strong lightness reduction so the dim ships read as clearly "not the
  // current focus" — but they remain visible silhouettes.
  const color = dim ? shadeColor(baseColor, -0.35) : baseColor;

  return (
    <group
      position={position}
      quaternion={quat}
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
      <ShipMesh sizeClass={enemy.sizeClass} color={color} />
      {enemy.shieldsUp && !ghost && <ShipShield radii={sizeDef.shieldRadii} />}
      {showLabel && enemy.label && (
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
            {enemy.label}
          </div>
        </Html>
      )}
    </group>
  );
}

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { CombatEnemyShip } from "@/types/game";
import { RANGE_BY_ID } from "@/lib/combat/ranges";
import { VISUAL } from "@/lib/combat/visual";
import { shipWorldPosition } from "./EnemyShip";
import EnemyShip from "./EnemyShip";

interface StagingGhostProps {
  // The ship's pre-edit (original) state — where the red silhouette renders.
  original: CombatEnemyShip;
  // The ship's currently-staged state — where the live ship sits. The line
  // connects the two; the distance label measures the great-circle arc on the
  // shell (plus radial delta if the range band changed).
  staged: CombatEnemyShip;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

function formatDistance(units: number): string {
  return units < 0.5 ? "<½ u" : `${units.toFixed(1)} u`;
}

function arcOnShell(
  origin: [number, number, number],
  destination: [number, number, number],
  segments: number,
): Float32Array {
  // Great-circle arc on a sphere of constant radius (= |origin|). If the radii
  // differ (range change), interpolate radius linearly along the arc.
  const a = new THREE.Vector3(...origin);
  const b = new THREE.Vector3(...destination);
  const rA = a.length();
  const rB = b.length();
  const aN = a.clone().normalize();
  const bN = b.clone().normalize();
  const dot = THREE.MathUtils.clamp(aN.dot(bN), -1, 1);
  const omega = Math.acos(dot);
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let p: THREE.Vector3;
    if (omega < 1e-4) {
      // Same direction — straight radial blend.
      p = aN.clone().multiplyScalar(rA + (rB - rA) * t);
    } else {
      // SLERP direction, lerp radius.
      const sinOmega = Math.sin(omega);
      const wA = Math.sin((1 - t) * omega) / sinOmega;
      const wB = Math.sin(t * omega) / sinOmega;
      const dir = aN.clone().multiplyScalar(wA).addScaledVector(bN, wB);
      const r = rA + (rB - rA) * t;
      p = dir.normalize().multiplyScalar(r);
    }
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

export default function StagingGhost({ original, staged }: StagingGhostProps) {
  const originalPos = useMemo(
    () =>
      shipWorldPosition(
        original.range,
        original.azimuthDeg,
        original.elevationDeg,
      ),
    [original.range, original.azimuthDeg, original.elevationDeg],
  );
  const stagedPos = useMemo(
    () =>
      shipWorldPosition(staged.range, staged.azimuthDeg, staged.elevationDeg),
    [staged.range, staged.azimuthDeg, staged.elevationDeg],
  );

  // Skip ghost if original and staged positions are identical (range + angles).
  const moved =
    original.range !== staged.range ||
    Math.abs(original.azimuthDeg - staged.azimuthDeg) > 0.01 ||
    Math.abs(original.elevationDeg - staged.elevationDeg) > 0.01;

  const arcPositions = useMemo(
    () => (moved ? arcOnShell(originalPos, stagedPos, 32) : null),
    [moved, originalPos, stagedPos],
  );

  // Distance: combination of arc (great-circle on the shared shell) + radial delta.
  const distance = useMemo(() => {
    if (!moved) return 0;
    const a = new THREE.Vector3(...originalPos);
    const b = new THREE.Vector3(...stagedPos);
    return a.distanceTo(b);
  }, [moved, originalPos, stagedPos]);

  // Midpoint along arc for the label position.
  const midPoint = useMemo(() => {
    if (!arcPositions) return null;
    const m = arcPositions.length / 2;
    const i = Math.floor(m / 3) * 3;
    return [arcPositions[i], arcPositions[i + 1], arcPositions[i + 2]] as [
      number,
      number,
      number,
    ];
  }, [arcPositions]);

  if (!moved) return null;

  return (
    <>
      {/* Red silhouette ghost at the pre-edit position. */}
      <EnemyShip enemy={original} ghost showLabel={false} />

      {/* Connecting line — great-circle arc on the shell. */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[arcPositions!, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={VISUAL.stagingDistanceLineColor}
          linewidth={VISUAL.stagingDistanceLineWidth}
          transparent
          opacity={0.85}
          depthTest={false}
        />
      </line>

      {/* Distance label at arc midpoint. */}
      {midPoint && (
        <Html
          position={midPoint}
          center
          occlude={false}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className="px-2 py-1 rounded bg-black/60 border border-red-400/40 text-xs font-bold tracking-[0.15em] uppercase text-red-300 whitespace-nowrap"
            style={cinzel}
          >
            {formatDistance(distance)}
            {original.range !== staged.range && (
              <span className="opacity-70 ml-1">
                ({RANGE_BY_ID[original.range].id} → {RANGE_BY_ID[staged.range].id})
              </span>
            )}
          </div>
        </Html>
      )}
    </>
  );
}

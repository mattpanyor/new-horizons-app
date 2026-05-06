"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { VISUAL } from "@/lib/combat/visual";

interface RangeShellProps {
  radius: number;
  // Number of dots on the shell. Falls back to VISUAL.rangeShellDotCount when
  // omitted — callers typically pass a per-range count so density scales with
  // shell size (more dots on bigger spheres so the field doesn't look sparse).
  dotCount?: number;
  // 0..1 — used for hover preview vs toggled-on; both visually identical here
  // but kept as a prop to allow future tuning per state.
  opacity?: number;
}

// Sparse, evenly-distributed dots on a sphere of the given radius using a
// Fibonacci lattice (golden-angle spiral). Cheap to render, looks like floating
// reference markers when toggled. Local-only, never synced.
export default function RangeShell({ radius, dotCount, opacity = 1 }: RangeShellProps) {
  const positions = useMemo(() => {
    const count = Math.max(8, Math.round(dotCount ?? VISUAL.rangeShellDotCount));
    const arr = new Float32Array(count * 3);
    const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // -1..1
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      arr[i * 3] = x * radius;
      arr[i * 3 + 1] = y * radius;
      arr[i * 3 + 2] = z * radius;
    }
    return arr;
  }, [radius, dotCount]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={VISUAL.rangeShellDotColor}
        size={VISUAL.rangeShellDotSize}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

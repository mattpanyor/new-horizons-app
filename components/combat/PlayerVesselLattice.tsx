"use client";

import { useMemo } from "react";
import * as THREE from "three";

// Aegis Graviton Lattice — six nodes in a horizontal hexagon (XZ plane)
// around the player vessel, connected by perimeter edges and three
// diagonals through the center for the "lattice" feel from the ability
// icon. Distinct violet purple, slightly cooler than the Flip aura.
//
// Renders inside the PlayerVessel group so it follows the ship's transform.
// Cheap: 9 line segments + 6 small spheres, all with depth-write off and
// additive blending so they glow against the dark space backdrop.
export default function PlayerVesselLattice() {
  const RADIUS = 1.85;
  const NODE_COLOR = "#c4b5fd";
  const LINE_COLOR = "#a78bfa";

  const nodePositions = useMemo<readonly [number, number, number][]>(() => {
    const verts: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      verts.push([Math.cos(ang) * RADIUS, 0, Math.sin(ang) * RADIUS]);
    }
    return verts;
  }, []);

  const lineGeometry = useMemo(() => {
    const segs: number[] = [];
    // Hex perimeter — 6 edges connecting consecutive vertices.
    for (let i = 0; i < 6; i++) {
      const a = nodePositions[i];
      const b = nodePositions[(i + 1) % 6];
      segs.push(...a, ...b);
    }
    // Three diagonals through center — opposite-vertex pairs. Forms the
    // Star-of-David pattern inside the hex.
    for (let i = 0; i < 3; i++) {
      const a = nodePositions[i];
      const b = nodePositions[i + 3];
      segs.push(...a, ...b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(segs), 3),
    );
    return geom;
  }, [nodePositions]);

  return (
    <group>
      {/* Lattice edges — hex perimeter + 3 internal diagonals. */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          color={LINE_COLOR}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Lattice nodes — small bright spheres at each hex vertex. */}
      {nodePositions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.075, 14, 10]} />
          <meshBasicMaterial
            color={NODE_COLOR}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

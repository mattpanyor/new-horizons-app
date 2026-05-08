"use client";

import * as THREE from "three";

interface ShipShieldProps {
  // Per-axis radii (X bow, Y dorsal, Z beam) IN LOCAL SHIP COORDS. The ship
  // group applies sizeDef.scale to its children, so these are implicitly
  // multiplied by the class scale to get world extents. Non-uniform radii
  // are used to stretch the shield ellipsoid along the ship's bow axis so
  // the hex net follows the ship's general silhouette.
  radii: readonly [number, number, number];
}

// Translucent blue hex-net shield around an enemy ship. Two layers:
//   - Inner sphere — soft blue haze (additive blend) to suggest the field
//   - Outer wireframe icosahedron (detail=2) — the visible "hex" lattice.
//     A 320-triangle icosphere reads as a geodesic hex grid because each
//     vertex hosts ~6 triangles forming a hex around it.
// Both layers use additive blending against the dark space background and
// have depthWrite disabled so they don't occlude the ship beneath them. The
// outer group applies the per-axis scale, so a unit-radius geometry stretches
// into an oblong shield.
export default function ShipShield({ radii }: ShipShieldProps) {
  return (
    <group scale={radii as unknown as [number, number, number]}>
      {/* Inner haze — soft glowing fill. */}
      <mesh scale={0.98}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color="#3a8fff"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer hex-net — wireframe icosphere. */}
      <mesh>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color="#7cc8ff"
          wireframe
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

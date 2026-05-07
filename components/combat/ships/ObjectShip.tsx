"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Generic non-ship object — debris, shuttles, mines, beacons, anything the
// GM wants to drop in as a label-only entity. Single small irregular form
// composed of three small angular shards. Off-axis orientation makes it
// read as "fragment" or "wreckage" rather than a deliberate vessel.
export default function ObjectShip({ color }: ShipProps) {
  const { hull, accent } = getShipShades(color);
  const M = { metalness: 0.7, roughness: 0.45, flatShading: true } as const;
  return (
    <group>
      {/* Tetrahedral core, rotated off-axis. */}
      <mesh rotation={[0.3, 0.7, 0.2]} castShadow receiveShadow>
        <tetrahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      {/* Smaller octahedron offset on one side. */}
      <mesh position={[0.32, 0.18, 0.22]} scale={[0.45, 0.32, 0.42]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={accent} {...M} />
      </mesh>
      {/* Third small fragment on the opposite side, gives the silhouette
         more visual weight without making it look like a "ship." */}
      <mesh position={[-0.2, -0.15, -0.18]} rotation={[0.6, -0.3, 0.4]} castShadow receiveShadow>
        <tetrahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={accent} {...M} />
      </mesh>
    </group>
  );
}

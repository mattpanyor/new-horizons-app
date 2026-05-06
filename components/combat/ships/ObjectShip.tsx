"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Generic non-ship object: small irregular fragment. Used for shuttles, debris,
// mines, beacons, or any future label-only entity.
export default function ObjectShip({ color }: ShipProps) {
  const { hull, accent } = getShipShades(color);
  return (
    <group>
      {/* Tetrahedral core, rotated off-axis. */}
      <mesh rotation={[0.3, 0.7, 0.2]}>
        <tetrahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={hull} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
      {/* Smaller octahedron offset, gives an irregular fragment silhouette. */}
      <mesh position={[0.3, 0.15, 0.2]} scale={[0.5, 0.35, 0.45]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}

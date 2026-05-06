"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Heavy cruiser: large central octahedron flanked by two smaller
// hull-segments, pyramid prow, multiple engine clusters, dorsal antenna spire.
export default function Cruiser({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  return (
    <group>
      {/* Central hull. */}
      <mesh scale={[1.8, 0.6, 0.85]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Flanking hull pods. */}
      <mesh position={[0, 0, 1.0]} scale={[1.0, 0.35, 0.4]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0, -1.0]} scale={[1.0, 0.35, 0.4]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Prow — long pyramid. */}
      <mesh position={[2.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.4, 1.2, 4]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.45} flatShading />
      </mesh>
      {/* Dorsal antenna spire. */}
      <mesh position={[0.2, 0.7, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.2, 1.1, 0]}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color={hull} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Mid-ship turret bumps — three pyramids on dorsal. */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0]}>
          <coneGeometry args={[0.16, 0.32, 4]} />
          <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
        </mesh>
      ))}
      {/* Engines — four large cylinders in cluster. */}
      {[
        [-1.85, 0.22, 0.4],
        [-1.85, 0.22, -0.4],
        [-1.85, -0.22, 0.4],
        [-1.85, -0.22, -0.4],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 0.34, 12]} />
          <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

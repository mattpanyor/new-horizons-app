"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Smallest enemy: elongated octahedron hull with two tetrahedral fins and one
// engine. Pointy + asymmetric, no axis-aligned cuboids.
export default function Corvette({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  return (
    <group>
      {/* Hull — stretched octahedron along bow axis. */}
      <mesh scale={[1.4, 0.45, 0.55]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.5} roughness={0.55} flatShading />
      </mesh>
      {/* Fin port (slight rotation off-axis). */}
      <mesh position={[-0.2, 0.05, -0.55]} rotation={[0, 0.3, 0.4]}>
        <tetrahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.55} flatShading />
      </mesh>
      {/* Fin starboard. */}
      <mesh position={[-0.2, 0.05, 0.55]} rotation={[0, -0.3, 0.4]}>
        <tetrahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.55} flatShading />
      </mesh>
      {/* Engine — single emissive cylinder at stern. */}
      <mesh position={[-1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
        <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.0} />
      </mesh>
    </group>
  );
}

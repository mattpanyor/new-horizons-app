"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Mid-tier enemy: two stacked octahedra forming a longer, double-bulged hull,
// pyramid prow, four engines. More menacing than a frigate, less massive than
// a cruiser.
export default function Destroyer({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  return (
    <group>
      {/* Forward hull octahedron. */}
      <mesh position={[0.5, 0, 0]} scale={[1.4, 0.45, 0.65]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Aft hull octahedron, slightly stretched. */}
      <mesh position={[-0.6, 0, 0]} scale={[1.0, 0.55, 0.7]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Prow — long 4-sided pyramid. */}
      <mesh position={[2.0, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.3, 0.9, 4]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.45} flatShading />
      </mesh>
      {/* Dorsal turret bumps — small tetrahedra. */}
      <mesh position={[0.1, 0.45, 0]} rotation={[0, 0.4, 0]}>
        <tetrahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.7, 0.45, 0]} rotation={[0, -0.4, 0]}>
        <tetrahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Engines — four cylinders in a square pattern at stern. */}
      {[
        [-1.55, 0.18, 0.25],
        [-1.55, 0.18, -0.25],
        [-1.55, -0.18, 0.25],
        [-1.55, -0.18, -0.25],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.085, 0.085, 0.25, 12]} />
          <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.1} />
        </mesh>
      ))}
    </group>
  );
}

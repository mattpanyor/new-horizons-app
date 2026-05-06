"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Enemy frigate: octahedral hull, 4-sided pyramid prow at the bow, two
// tetrahedral wings, two engines. Visually distinct from the player frigate
// (which is curvy + has a dorsal sensor cluster).
export default function Frigate({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  return (
    <group>
      {/* Hull — stretched octahedron. */}
      <mesh scale={[1.6, 0.5, 0.7]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Prow — 4-sided pyramid (cone with radialSegments=4) jutting forward at the bow. */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.35, 0.7, 4]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Wing port — tetrahedron tilted out. */}
      <mesh position={[-0.1, 0, -0.85]} rotation={[0.4, 0.3, 0]}>
        <tetrahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Wing starboard. */}
      <mesh position={[-0.1, 0, 0.85]} rotation={[-0.4, -0.3, 0]}>
        <tetrahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Engines — two emissive cylinders flanking the stern. */}
      <mesh position={[-1.3, 0, 0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.28, 12]} />
        <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[-1.3, 0, -0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.28, 12]} />
        <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

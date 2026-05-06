"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Battlecruiser: largest enemy class. Triple-stacked octahedra spine,
// prominent spinal pyramid prow, multiple bridge sections, gun-battery bumps,
// six engines.
export default function Battlecruiser({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  return (
    <group>
      {/* Triple-stacked hull octahedra along bow axis. */}
      <mesh position={[1.0, 0, 0]} scale={[1.4, 0.55, 0.85]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.2, 0, 0]} scale={[1.7, 0.7, 1.05]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-1.5, 0, 0]} scale={[1.3, 0.65, 0.85]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Spinal mount — long pyramid forward of all hull sections. */}
      <mesh position={[3.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.45, 1.6, 4]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.45} flatShading />
      </mesh>
      {/* Bridge tower stack — two pyramids stepping up on dorsal mid-ship. */}
      <mesh position={[-0.1, 0.82, 0]}>
        <coneGeometry args={[0.32, 0.5, 4]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.1, 1.18, 0]}>
        <coneGeometry args={[0.18, 0.32, 4]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Gun-battery turrets — five pyramids along dorsal spine. */}
      {[1.5, 0.8, 0.0, -0.8, -1.6].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0]}>
          <coneGeometry args={[0.18, 0.36, 4]} />
          <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
        </mesh>
      ))}
      {/* Tetrahedral wings flanking mid-ship. */}
      <mesh position={[-0.3, 0, 1.2]} rotation={[0.3, 0.4, 0]}>
        <tetrahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[-0.3, 0, -1.2]} rotation={[-0.3, -0.4, 0]}>
        <tetrahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={accent} metalness={0.55} roughness={0.5} flatShading />
      </mesh>
      {/* Engine cluster — six cylinders at the stern in 3x2 grid. */}
      {[
        [-2.4, 0.32, 0.45],
        [-2.4, 0.32, 0.0],
        [-2.4, 0.32, -0.45],
        [-2.4, -0.32, 0.45],
        [-2.4, -0.32, 0.0],
        [-2.4, -0.32, -0.45],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.4, 12]} />
          <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.3} />
        </mesh>
      ))}
    </group>
  );
}

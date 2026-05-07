"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Heavy combat ship. Two-section hull, long pyramidal prow, tall bridge
// tower, multiple gun turret pairs along the spine, four-engine cluster.
export default function Destroyer({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  const M = { metalness: 0.85, roughness: 0.3, flatShading: true } as const;
  const Macc = { metalness: 0.8, roughness: 0.35, flatShading: true } as const;

  return (
    <group>
      {/* Forward hull. */}
      <mesh position={[0.55, 0, 0]} scale={[1.4, 0.45, 0.7]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Aft hull, slightly broader. */}
      <mesh position={[-0.65, 0, 0]} scale={[1.0, 0.55, 0.78]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Long pyramidal prow. */}
      <mesh position={[2.05, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.3, 0.95, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Bridge tower — three-step stack, centerline. */}
      <mesh position={[-0.5, 0.55, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.22, 0.3, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[-0.5, 0.8, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.14, 0.22, 4]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      <mesh position={[-0.5, 1.0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Forward gun turret — single dorsal-spine, centerline. */}
      <mesh position={[1.05, 0.45, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.15, 0.22, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[1.3, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.32, 10]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Mid-ship turret pairs (mirrored). Two pairs spaced along the spine. */}
      {[
        { x: 0.4, z: 0.42 },
        { x: -1.15, z: 0.42 },
      ].flatMap(({ x, z }) =>
        [-z, z].map((zPos) => (
          <group key={`${x}-${zPos}`} position={[x, 0.4, zPos]}>
            <mesh castShadow receiveShadow>
              <coneGeometry args={[0.1, 0.16, 4]} />
              <meshStandardMaterial color={accent} {...Macc} />
            </mesh>
            <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.22, 8]} />
              <meshStandardMaterial color={accent} {...Macc} />
            </mesh>
          </group>
        )),
      )}

      {/* Wing-tip stabilizers (mirrored). */}
      {[-0.9, 0.9].map((z) => (
        <mesh
          key={z}
          position={[-0.4, 0, z]}
          rotation={[z > 0 ? -0.3 : 0.3, 0, 0]}
          castShadow
          receiveShadow
        >
          <tetrahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Engine cluster — four cylinders in a 2×2 grid (mirrored). */}
      {[
        [-1.6, 0.18, 0.28],
        [-1.6, 0.18, -0.28],
        [-1.6, -0.18, 0.28],
        [-1.6, -0.18, -0.28],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.09, 0.3, 12]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.22, 12]} />
            <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

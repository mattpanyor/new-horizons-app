"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Light attack craft. Sleek elongated hull, twin engines, twin forward gun
// barrels, swept-back fins. All non-centerline meshes are mirrored across
// the bow axis (XY plane).
//
// Bow points +X; port = -Z; starboard = +Z; dorsal = +Y.
export default function Corvette({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  const M = { metalness: 0.85, roughness: 0.3, flatShading: true } as const;
  const Macc = { metalness: 0.8, roughness: 0.35, flatShading: true } as const;

  return (
    <group>
      {/* Hull — stretched octahedron, centerline. */}
      <mesh scale={[1.45, 0.4, 0.5]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Cockpit dome — centerline, dorsal-forward. */}
      <mesh position={[0.35, 0.32, 0]} scale={[0.35, 0.18, 0.28]} castShadow receiveShadow>
        <sphereGeometry args={[1, 16, 8]} />
        <meshStandardMaterial color={hull} metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Forward bow ridge — small pyramid jutting fore on the centerline. */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.14, 0.32, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Forward twin gun barrels (mirrored). Skinny — no readable shadow. */}
      {[-0.3, 0.3].map((z) => (
        <mesh key={z} position={[0.95, -0.05, z]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Wing fins — swept-back tetrahedra (mirrored). */}
      {[-0.55, 0.55].map((z) => (
        <mesh
          key={z}
          position={[-0.25, 0.05, z]}
          rotation={[z > 0 ? 0.25 : -0.25, 0, 0.4]}
          castShadow
          receiveShadow
        >
          <tetrahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Antenna spire — centerline, dorsal-aft. Receive only. */}
      <mesh position={[-0.5, 0.4, 0]} receiveShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.32, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Engines — twin cylinders at stern (mirrored). */}
      {[-0.18, 0.18].map((z) => (
        <mesh key={z} position={[-1.05, 0, z]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.26, 14]} />
          <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.0} />
        </mesh>
      ))}
    </group>
  );
}

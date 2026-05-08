"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Standard mid-sized combat ship. Pyramidal prow, raised bridge tower, twin
// dorsal gun turrets, twin engine pods, swept wings. All non-centerline
// meshes mirrored port/starboard across the bow axis.
export default function Frigate({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  const M = { metalness: 0.85, roughness: 0.3, flatShading: true } as const;
  const Macc = { metalness: 0.8, roughness: 0.35, flatShading: true } as const;

  return (
    <group>
      {/* Main hull — stretched octahedron, centerline. */}
      <mesh scale={[1.6, 0.5, 0.7]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Prow — 4-sided pyramid jutting forward. */}
      <mesh position={[1.55, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.32, 0.65, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Bridge tower — stepped pyramid, centerline dorsal. */}
      <mesh position={[0.1, 0.55, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.22, 0.32, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[0.1, 0.78, 0]} receiveShadow>
        <coneGeometry args={[0.1, 0.18, 4]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Dorsal twin gun turrets (mirrored). Small pyramid bases with
         protruding barrels. */}
      {[-0.32, 0.32].map((z) => (
        <group key={z} position={[0.55, 0.42, z]}>
          <mesh castShadow receiveShadow>
            <coneGeometry args={[0.12, 0.18, 4]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.3, 10]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
        </group>
      ))}

      {/* Wings — swept tetrahedra extending port/starboard (mirrored). */}
      {[-0.85, 0.85].map((z) => (
        <mesh
          key={z}
          position={[-0.15, 0, z]}
          rotation={[z > 0 ? -0.4 : 0.4, z > 0 ? -0.3 : 0.3, 0]}
          castShadow
          receiveShadow
        >
          <tetrahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Sensor masts — small spires on the wing tips (mirrored). Receive only. */}
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} position={[-0.1, 0.15, z]} receiveShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Twin engine pods (mirrored). Each pod has a stubby nacelle housing
         + emissive cylinder inside. */}
      {[-0.25, 0.25].map((z) => (
        <group key={z} position={[-1.3, 0, z]}>
          {/* Nacelle housing — slightly larger non-emissive shell. */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.13, 0.11, 0.34, 12]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          {/* Emissive core. */}
          <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.28, 12]} />
            <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

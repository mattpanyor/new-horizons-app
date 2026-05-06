"use client";

import { PLAYER_SHIP } from "@/lib/combat/playerShip";

// Streamlined hero ship: stretched ellipsoid hull with sharp cone tips fore (+X)
// and aft (-X). Reads as "ours" against the angular enemies. Bow always points +X.
export default function PlayerVessel() {
  const hull = PLAYER_SHIP.color;
  const accent = PLAYER_SHIP.accentColor;
  const engine = PLAYER_SHIP.engineColor;

  return (
    <group>
      {/* Hull — ellipsoid (sphere with non-uniform scale). Length along bow axis. */}
      <mesh scale={[1.6, 0.36, 0.6]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshStandardMaterial color={hull} metalness={0.55} roughness={0.4} />
      </mesh>

      {/* Bow tip — long sharp cone, smooth (32 radial segments). */}
      <mesh position={[1.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.18, 0.9, 32]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.5} />
      </mesh>

      {/* Stern tip — shorter blunt cone. */}
      <mesh position={[-1.75, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.22, 0.5, 32]} />
        <meshStandardMaterial color={accent} metalness={0.6} roughness={0.5} />
      </mesh>

      {/* Engine glow — two small emissive cylinders flanking the stern. */}
      <mesh position={[-1.55, 0, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={engine}
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[-1.55, 0, -0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={engine}
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Dorsal sensor cluster — short thin spire + small sphere on top, distinguishes player frigate from enemy frigate. */}
      <mesh position={[0.3, 0.28, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.32, 12]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.3, 0.46, 0]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={hull} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

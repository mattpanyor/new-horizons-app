"use client";

import { PLAYER_SHIP } from "@/lib/combat/playerShip";

// Streamlined hero ship: stretched ellipsoid hull with sharp cone tips fore (+X)
// and aft (-X). Reads as "ours" against the angular enemies. Bow always points +X.
//
// All structural meshes cast and receive shadows so the ship self-shadows
// (cone tips shadow the hull behind them, antenna shadows the bridge area,
// etc.). Engine emissives don't cast shadows (would look weird from a
// glowing source) but do receive them.
export default function PlayerVessel() {
  const hull = PLAYER_SHIP.color;
  const accent = PLAYER_SHIP.accentColor;
  const engine = PLAYER_SHIP.engineColor;

  const HULL_METAL = 0.85;
  const HULL_ROUGH = 0.3;
  const ACCENT_METAL = 0.8;
  const ACCENT_ROUGH = 0.35;

  return (
    <group>
      {/* Hull — ellipsoid (sphere with non-uniform scale). Length along bow axis. */}
      <mesh scale={[1.6, 0.36, 0.6]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 16]} />
        <meshStandardMaterial color={hull} metalness={HULL_METAL} roughness={HULL_ROUGH} />
      </mesh>

      {/* Bow tip — long sharp cone, smooth (32 radial segments). */}
      <mesh position={[1.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.18, 0.9, 32]} />
        <meshStandardMaterial color={accent} metalness={ACCENT_METAL} roughness={ACCENT_ROUGH} />
      </mesh>

      {/* Stern tip — shorter blunt cone. */}
      <mesh position={[-1.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.22, 0.5, 32]} />
        <meshStandardMaterial color={accent} metalness={ACCENT_METAL} roughness={ACCENT_ROUGH} />
      </mesh>

      {/* Engine glow — two small emissive cylinders flanking the stern. */}
      <mesh position={[-1.55, 0, 0.18]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={engine}
          emissiveIntensity={1.2}
        />
      </mesh>
      <mesh position={[-1.55, 0, -0.18]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={engine}
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Dorsal sensor cluster — short thin spire + small sphere on top. */}
      <mesh position={[0.3, 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.32, 12]} />
        <meshStandardMaterial color={accent} metalness={ACCENT_METAL} roughness={ACCENT_ROUGH} />
      </mesh>
      <mesh position={[0.3, 0.46, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={hull} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

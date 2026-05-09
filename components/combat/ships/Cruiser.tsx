"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Heavy cruiser. Wide central hull with mirrored flanking pods, long pyramid
// prow, multi-step command tower, multiple gun turret pairs, side-mounted
// stabilizer fins, four-engine cluster.
export default function Cruiser({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  const M = { metalness: 0.85, roughness: 0.3, flatShading: true } as const;
  const Macc = { metalness: 0.8, roughness: 0.35, flatShading: true } as const;

  return (
    <group>
      {/* Central hull — broad octahedron, centerline. */}
      <mesh scale={[1.85, 0.6, 0.85]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Flanking hull pods (mirrored). */}
      {[-1.0, 1.0].map((z) => (
        <mesh key={z} position={[-0.1, 0, z]} scale={[1.05, 0.35, 0.4]} castShadow receiveShadow>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={hull} {...M} />
        </mesh>
      ))}

      {/* Long pyramidal prow. */}
      <mesh position={[2.45, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.4, 1.2, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Command tower — 3-step pyramid stack with antenna spire,
         centerline. */}
      <mesh position={[-0.05, 0.7, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.32, 0.3, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[-0.05, 0.95, 0]} receiveShadow>
        <coneGeometry args={[0.2, 0.24, 4]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      <mesh position={[-0.05, 1.18, 0]} receiveShadow>
        <coneGeometry args={[0.1, 0.2, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[-0.05, 1.42, 0]} receiveShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Forward turret pair (mirrored). */}
      {[-0.32, 0.32].map((z) => (
        <group key={z} position={[1.0, 0.5, z]}>
          <mesh castShadow receiveShadow>
            <coneGeometry args={[0.13, 0.2, 4]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.024, 0.024, 0.3, 10]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
        </group>
      ))}

      {/* Mid-ship turret pair (mirrored). */}
      {[-0.45, 0.45].map((z) => (
        <group key={z} position={[0.1, 0.55, z]}>
          <mesh castShadow receiveShadow>
            <coneGeometry args={[0.13, 0.2, 4]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.024, 0.024, 0.3, 10]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
        </group>
      ))}

      {/* Aft turret pair (mirrored). */}
      {[-0.32, 0.32].map((z) => (
        <group key={z} position={[-0.85, 0.5, z]}>
          <mesh castShadow receiveShadow>
            <coneGeometry args={[0.12, 0.18, 4]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.26, 10]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
        </group>
      ))}

      {/* Stabilizer fins on the flanking pods (mirrored). */}
      {[-1.2, 1.2].map((z) => (
        <mesh
          key={z}
          position={[-0.3, 0.25, z]}
          rotation={[z > 0 ? -0.4 : 0.4, 0, 0]}
          castShadow
          receiveShadow
        >
          <tetrahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Side-pod sensor masts (mirrored). Receive only. */}
      {[-1.05, 1.05].map((z) => (
        <mesh key={z} position={[0.1, 0.3, z]} receiveShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.34, 8]} />
          <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Engine cluster — four cylinders in 2×2 grid (mirrored). */}
      {[
        [-1.95, 0.22, 0.42],
        [-1.95, 0.22, -0.42],
        [-1.95, -0.22, 0.42],
        [-1.95, -0.22, -0.42],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.13, 0.36, 12]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.28, 12]} />
            <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

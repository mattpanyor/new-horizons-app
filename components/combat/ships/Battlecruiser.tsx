"use client";

import { getShipShades } from "./shipColor";

interface ShipProps {
  color: string;
}

// Capital ship — the largest enemy class. Triple-stacked hull, prominent
// spinal mount, multi-tier command tower, multiple gun turret pairs along
// the spine, side-mounted hangar pods, six-engine cluster.
export default function Battlecruiser({ color }: ShipProps) {
  const { hull, accent, engine } = getShipShades(color);
  const M = { metalness: 0.85, roughness: 0.3, flatShading: true } as const;
  const Macc = { metalness: 0.8, roughness: 0.35, flatShading: true } as const;

  return (
    <group>
      {/* Triple-stacked hull octahedra along bow axis. */}
      <mesh position={[1.05, 0, 0]} scale={[1.4, 0.55, 0.85]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      <mesh position={[-0.2, 0, 0]} scale={[1.7, 0.7, 1.05]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      <mesh position={[-1.5, 0, 0]} scale={[1.3, 0.65, 0.9]} castShadow receiveShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>

      {/* Spinal mount — long pyramid forward of all hull sections. */}
      <mesh position={[3.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <coneGeometry args={[0.45, 1.6, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Spinal mount under-rail (gives the prow extra structure). */}
      <mesh position={[2.5, -0.18, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.7, 10]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>

      {/* Command tower — 4-tier pyramid pile + antenna, centerline. */}
      <mesh position={[-0.15, 0.85, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.36, 0.34, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[-0.15, 1.15, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.24, 0.28, 4]} />
        <meshStandardMaterial color={hull} {...M} />
      </mesh>
      <mesh position={[-0.15, 1.4, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.14, 0.24, 4]} />
        <meshStandardMaterial color={accent} {...Macc} />
      </mesh>
      <mesh position={[-0.15, 1.62, 0]} castShadow receiveShadow>
        <octahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial color={hull} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.15, 1.78, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.28, 8]} />
        <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Gun-battery turret pairs along the dorsal spine (mirrored).
         Five pairs spaced from bow to stern. */}
      {[
        { x: 1.6, z: 0.4 },
        { x: 0.85, z: 0.5 },
        { x: 0.0, z: 0.55 },
        { x: -0.85, z: 0.5 },
        { x: -1.65, z: 0.42 },
      ].flatMap(({ x, z }) =>
        [-z, z].map((zPos) => (
          <group key={`${x}-${zPos}`} position={[x, 0.55, zPos]}>
            <mesh castShadow receiveShadow>
              <coneGeometry args={[0.14, 0.22, 4]} />
              <meshStandardMaterial color={accent} {...Macc} />
            </mesh>
            <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.3, 10]} />
              <meshStandardMaterial color={accent} {...Macc} />
            </mesh>
          </group>
        )),
      )}

      {/* Side hangar pods (mirrored). Stretched octahedra hugging the
         mid-ship hull. */}
      {[-1.15, 1.15].map((z) => (
        <mesh key={z} position={[-0.2, 0, z]} scale={[1.0, 0.32, 0.32]} castShadow receiveShadow>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={hull} {...M} />
        </mesh>
      ))}

      {/* Stabilizer wings flanking mid-ship (mirrored). */}
      {[-1.5, 1.5].map((z) => (
        <mesh
          key={z}
          position={[-0.4, 0, z]}
          rotation={[z > 0 ? -0.35 : 0.35, 0, 0]}
          castShadow
          receiveShadow
        >
          <tetrahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={accent} {...Macc} />
        </mesh>
      ))}

      {/* Sensor masts on the side pods (mirrored). */}
      {[-1.2, 1.2].map((z) => (
        <mesh key={z} position={[0.5, 0.25, z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.36, 8]} />
          <meshStandardMaterial color={accent} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Engine cluster — six cylinders in a 3×2 grid at the stern
         (mirrored across vertical-and-port axes). */}
      {[
        [-2.45, 0.32, 0.5],
        [-2.45, 0.32, 0.0],
        [-2.45, 0.32, -0.5],
        [-2.45, -0.32, 0.5],
        [-2.45, -0.32, 0.0],
        [-2.45, -0.32, -0.5],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.14, 0.42, 12]} />
            <meshStandardMaterial color={accent} {...Macc} />
          </mesh>
          <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.32, 12]} />
            <meshStandardMaterial color={accent} emissive={engine} emissiveIntensity={1.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

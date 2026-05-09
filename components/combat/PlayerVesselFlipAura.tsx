"use client";

import * as THREE from "three";

// Purple aura + portal ring around the player vessel while Aegis's Flip
// ability is charging. Renders inside the PlayerVessel group so it follows
// the ship's transform automatically. Both meshes use additive blending and
// disabled depth-write so they glow against the dark backdrop without
// occluding the ship beneath them.
//
// Lore: Flip is a short-range teleport — the ship side-rolls over its bow
// axis and re-emerges upright at a new location. Mechanically (in this
// visualizer) the ship is stationary; the aura is the visual cue that the
// teleport is "spinning up" and persists into the GM phase so the enemy can
// reposition relative to the impending displacement.
export default function PlayerVesselFlipAura() {
  return (
    <group>
      {/* Outer aura — translucent purple bubble around the ship. */}
      <mesh>
        <sphereGeometry args={[2.4, 28, 18]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.09}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Horizontal portal ring — large torus around mid-ship in the XZ
         plane. Visible from above (where the camera typically starts) and
         readable from most orbit angles. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.05, 14, 64]} />
        <meshBasicMaterial
          color="#c084fc"
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Cross ring around the bow axis — gives the portal volumetric
         presence so it doesn't disappear when the camera goes top-down (the
         horizontal ring becomes edge-on at that angle). */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.2, 0.04, 12, 56]} />
        <meshBasicMaterial
          color="#c084fc"
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

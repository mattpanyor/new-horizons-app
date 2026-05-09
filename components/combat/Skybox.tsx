"use client";

import { useState } from "react";
import * as THREE from "three";
import { CAMERA_MAX_DISTANCE } from "@/lib/combat/ranges";
import { buildStarfield } from "@/lib/combat/buildSkybox";

interface SkyboxProps {
  // If a parent already built the texture (e.g., to share with the env map),
  // it can pass it in here. Otherwise we build our own once.
  texture?: THREE.Texture | null;
}

export default function Skybox({ texture: externalTexture }: SkyboxProps) {
  const radius = CAMERA_MAX_DISTANCE * 4;
  const [internalTexture] = useState<THREE.Texture | null>(() =>
    externalTexture ? null : buildStarfield(),
  );
  const texture = externalTexture ?? internalTexture;

  if (!texture) return null;
  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

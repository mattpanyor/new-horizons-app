"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CombatFace } from "@/types/game";
import { FACE_BY_ID } from "@/lib/combat/faces";
import { VISUAL } from "@/lib/combat/visual";
import { CAMERA_MAX_DISTANCE } from "@/lib/combat/ranges";

interface FaceFilterOverlayProps {
  activeFace: CombatFace | null;
}

// When a face is active, darken the BACKGROUND on the opposite half-space.
// Inactive-half ships are filtered out by Scene; this overlay just gives the
// dark side a subtle visual cue. Uses normal depth-testing so active-half
// ships render in front of the curtain (not over them).
export default function FaceFilterOverlay({ activeFace }: FaceFilterOverlayProps) {
  const sphereRadius = CAMERA_MAX_DISTANCE * 1.5;

  // Plane: keep pixels where (normal · point + constant) > 0.
  // Active face axis points toward the BRIGHT side (the face we're "looking at").
  // We want the dark sphere on the opposite side, so plane normal = -faceAxis.
  const clippingPlanes = useMemo(() => {
    if (!activeFace) return [];
    const ax = FACE_BY_ID[activeFace].axis;
    return [new THREE.Plane(new THREE.Vector3(-ax[0], -ax[1], -ax[2]), 0)];
  }, [activeFace]);

  if (!activeFace) return null;

  return (
    <mesh>
      <sphereGeometry args={[sphereRadius, 24, 12]} />
      <meshBasicMaterial
        color="#000000"
        transparent
        opacity={VISUAL.faceFilterDarkenOpacity}
        side={THREE.BackSide}
        depthWrite={false}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

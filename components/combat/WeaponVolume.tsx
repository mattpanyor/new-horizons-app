"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RANGE_BY_ID, RANGES } from "@/lib/combat/ranges";
import { VISUAL } from "@/lib/combat/visual";
import type { WeaponDef } from "@/lib/combat/playerShip";

interface WeaponVolumeProps {
  weapon: WeaponDef;
  axis: { x: number; y: number; z: number };
  color: string;
}

// Builds the volume mesh for a weapon. Per-vertex RGB encodes the user's
// chosen color multiplied by the effectiveness at that distance, producing a
// fade from saturated (high effectiveness) to near-black (low effectiveness)
// along the volume's length. Standard normal-blending picks this up.
function buildGeometry(weapon: WeaponDef, hexColor: string): THREE.BufferGeometry {
  const length = RANGE_BY_ID[weapon.maxRange].radius;
  const radialSegs = 28;
  // One ring per world-unit so the per-band step transitions land within a
  // single segment — keeps the boundary "step" visually tight (no smooth
  // interpolation across multiple rings).
  const lengthSegs = Math.max(24, Math.ceil(length));

  const halfAngle = (weapon.coneHalfAngleDeg ?? 0) * (Math.PI / 180);
  const tipRadius =
    weapon.shape === "cylinder"
      ? weapon.cylinderRadius ?? 0.3
      : Math.tan(halfAngle) * length;
  const radiusAt = (t: number): number =>
    weapon.shape === "cylinder" ? tipRadius : t * tipRadius;

  // Effectiveness as a STEP function over band radii — constant within each
  // band, hard transition at the band boundary. Each fragment snaps to the
  // band whose upper bound it falls within.
  const effAt = (distance: number): number => {
    for (let i = 0; i < RANGES.length; i++) {
      if (distance <= RANGES[i].radius) return weapon.effectiveness[RANGES[i].id];
    }
    return weapon.effectiveness[RANGES[RANGES.length - 1].id];
  };

  const userCol = new THREE.Color(hexColor);

  const verts: number[] = [];
  const colors: number[] = [];   // RGB per vertex (itemSize=3)
  const indices: number[] = [];

  for (let li = 0; li <= lengthSegs; li++) {
    const t = li / lengthSegs;
    const x = t * length;
    const r = radiusAt(t);
    const eff = effAt(x);
    // Direct mapping (no squaring) — the band step itself drives the visible
    // contrast, so the brightness should track effectiveness 1:1. Min clamp
    // keeps weak bands at least faintly visible.
    const brightness = Math.max(0.05, eff);
    const cr = userCol.r * brightness;
    const cg = userCol.g * brightness;
    const cb = userCol.b * brightness;
    for (let ri = 0; ri < radialSegs; ri++) {
      const ang = (ri / radialSegs) * Math.PI * 2;
      verts.push(x, r * Math.cos(ang), r * Math.sin(ang));
      colors.push(cr, cg, cb);
    }
  }

  for (let li = 0; li < lengthSegs; li++) {
    for (let ri = 0; ri < radialSegs; ri++) {
      const ri2 = (ri + 1) % radialSegs;
      const a = li * radialSegs + ri;
      const b = li * radialSegs + ri2;
      const c = (li + 1) * radialSegs + ri2;
      const d = (li + 1) * radialSegs + ri;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (weapon.shape === "cylinder") {
    const tipCenterIdx = verts.length / 3;
    verts.push(length, 0, 0);
    const tipEff = effAt(length);
    const tipBrightness = Math.max(0.05, tipEff);
    colors.push(
      userCol.r * tipBrightness,
      userCol.g * tipBrightness,
      userCol.b * tipBrightness,
    );
    const ringStart = lengthSegs * radialSegs;
    for (let ri = 0; ri < radialSegs; ri++) {
      const ri2 = (ri + 1) % radialSegs;
      indices.push(tipCenterIdx, ringStart + ri2, ringStart + ri);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(verts), 3),
  );
  geom.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  );
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export default function WeaponVolume({ weapon, axis, color }: WeaponVolumeProps) {
  const geometry = useMemo(() => buildGeometry(weapon, color), [weapon, color]);

  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    const target = new THREE.Vector3(axis.x, axis.y, axis.z).normalize();
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), target);
    return q;
  }, [axis.x, axis.y, axis.z]);

  return (
    <mesh geometry={geometry} quaternion={quat}>
      <meshBasicMaterial
        // White base color + vertexColors=true → vertex.rgb passes through
        // unchanged, so the per-vertex brightness encoding determines the
        // visible color directly.
        color="#ffffff"
        transparent
        opacity={VISUAL.weaponVolumeBaseOpacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        vertexColors
      />
    </mesh>
  );
}

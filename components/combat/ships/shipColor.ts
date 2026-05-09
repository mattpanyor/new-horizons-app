import * as THREE from "three";

// Tone helpers for enemy ship materials. Faction color is the hull; accent is
// a darker variant for trim, engines, secondary structures.
export function shadeColor(hex: string, lightnessDelta: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const next = THREE.MathUtils.clamp(hsl.l + lightnessDelta, 0, 1);
  c.setHSL(hsl.h, hsl.s, next);
  return `#${c.getHexString()}`;
}

export function getShipShades(hullColor: string): {
  hull: string;
  accent: string;
  engine: string;
} {
  return {
    hull: hullColor,
    accent: shadeColor(hullColor, -0.25),
    engine: shadeColor(hullColor, +0.15),
  };
}

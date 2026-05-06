"use client";

import { useState } from "react";
import * as THREE from "three";
import { CAMERA_MAX_DISTANCE } from "@/lib/combat/ranges";

// A large inward-facing sphere with a procedurally generated star-field canvas
// texture. Randomness is intentional, generation runs once via the lazy
// initializer of useState (which is not subject to render-purity constraints).
function buildStarfield(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#02030a");
  grad.addColorStop(0.5, "#070a18");
  grad.addColorStop(1, "#02030a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const starCount = 1400;
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * canvas.width;
    const y =
      (Math.random() ** 1.4) *
        (canvas.height / 2) *
        (Math.random() < 0.5 ? 1 : -1) +
      canvas.height / 2;
    const r = Math.random();
    const size = r < 0.85 ? 0.6 : r < 0.97 ? 1.2 : 2.0;
    const alpha = 0.4 + Math.random() * 0.55;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const colors = ["#ffd6a8", "#a8c8ff", "#ffe6d8", "#d8e0ff"];
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = "screen";
  const blob = (cx: number, cy: number, rx: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  blob(canvas.width * 0.25, canvas.height * 0.4, 320, "rgba(80, 60, 130, 0.35)");
  blob(canvas.width * 0.75, canvas.height * 0.55, 380, "rgba(40, 80, 120, 0.32)");
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Skybox() {
  const radius = CAMERA_MAX_DISTANCE * 4;
  const [texture] = useState<THREE.Texture | null>(() => buildStarfield());

  if (!texture) return null;
  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 24]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

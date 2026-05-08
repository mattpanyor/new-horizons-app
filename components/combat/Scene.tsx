"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  CAMERA_INITIAL_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
} from "@/lib/combat/ranges";
import { buildStarfield } from "@/lib/combat/buildSkybox";
import type {
  CombatEnemyShip,
  CombatFace,
  CombatPlacedHighlight,
  CombatRangeBand,
} from "@/types/game";
import { RANGE_BY_ID, RANGE_DOT_COUNT_MULTIPLIER } from "@/lib/combat/ranges";
import { FACE_BY_ID } from "@/lib/combat/faces";
import { shipWorldPosition } from "./EnemyShip";
import { getWeaponById, type WeaponDef } from "@/lib/combat/playerShip";
import PlayerVessel from "./PlayerVessel";
import Skybox from "./Skybox";
import RangeShell from "./RangeShell";
import FaceFilterOverlay from "./FaceFilterOverlay";
import WeaponVolume from "./WeaponVolume";
import WeaponAimController from "./WeaponAimController";
import EnemyShip from "./EnemyShip";
import AnimatedEnemyShip from "./AnimatedEnemyShip";
import StagingGhost from "./StagingGhost";
import EnemyDragController from "./EnemyDragController";
import { VISUAL } from "@/lib/combat/visual";

interface SceneProps {
  // Face filter — darken the other 5 arcs when a face is active or hovered.
  // Hover takes priority over active for instant preview feedback.
  activeFace: CombatFace | null;
  hoveredFace: CombatFace | null;
  // Range marker — show a dotted shell at this radius when active or hovered.
  activeRange: CombatRangeBand | null;
  hoveredRange: CombatRangeBand | null;
  // Weapon aiming — when set, the cursor controls the volume axis. Click to
  // commit. The placed-state weapon (if any) is in `localPlaced`.
  aimingWeapon: WeaponDef | null;
  viewerColor: string;
  onPlaceWeapon: (axis: { x: number; y: number; z: number }) => void;
  // The local user's own placed highlight (rendered immediately, not via poll).
  localPlaced: CombatPlacedHighlight | null;
  // Other users' placed highlights from the polled state.
  syncedPlaced: CombatPlacedHighlight[];
  // Enemy ships to render (from the polled state in player phase, or from the
  // staged buffer in gm phase).
  enemies: CombatEnemyShip[];
  // GM hook: called when a ship is left-clicked (enters edit mode).
  onEnemyClick?: (id: string) => void;
  // GM hook: called on right-click on a ship (without drag) to open the
  // context menu. Receives screen-space pixel coordinates.
  onEnemyContextMenu?: (id: string, screenX: number, screenY: number) => void;

  // Phase 7+ — GM edit mode. When set, the named ship is in drag-edit mode:
  //   - drag controller raycasts cursor onto the ship's range-shell radius
  //   - red ghost + arc line are drawn from `editingOriginal` to `enemies[id]`
  editingShipId?: string | null;
  editingOriginal?: CombatEnemyShip | null;
  onEnemyDrag?: (id: string, azimuthDeg: number, elevationDeg: number) => void;

  // Phase 8+ — End-turn animation. When `animStartMs !== null`, ships
  // interpolate from their `prevEnemies` entry to their current position over
  // `VISUAL.endTurnAnimMs`. When null, ships snap to current.
  prevEnemies?: CombatEnemyShip[];
  animStartMs?: number | null;

  children?: React.ReactNode;
}

// 3D scene root: R3F Canvas + lights + camera + skybox + player vessel.
// The camera starts looking down at the XY plane from +Y (top-down view), so
// the bow direction (+X) reads as "north / up on screen".
//   right-click + drag → orbit
//   scroll              → zoom (clamped)
//   left-click          → reserved for placing weapons / clicking ships
export default function Scene({
  activeFace,
  hoveredFace,
  activeRange,
  hoveredRange,
  aimingWeapon,
  viewerColor,
  onPlaceWeapon,
  localPlaced,
  syncedPlaced,
  enemies,
  onEnemyClick,
  onEnemyContextMenu,
  editingShipId,
  editingOriginal,
  onEnemyDrag,
  prevEnemies,
  animStartMs,
  children,
}: SceneProps) {
  const editingShip = editingShipId
    ? enemies.find((e) => e.id === editingShipId) ?? null
    : null;

  // Hover wins over active for instant preview when the user moves the mouse
  // over a different button while one is already toggled.
  const shownFace = hoveredFace ?? activeFace;
  const shownRange = hoveredRange ?? activeRange;

  // Build the starfield texture once on mount. Shared between the visible
  // skybox sphere and the PMREM-filtered environment map (image-based
  // lighting on metallic ship surfaces). Disposed on unmount so the 4096×2048
  // CanvasTexture doesn't accumulate in GPU memory across remounts.
  const [skyboxTexture] = useState<THREE.Texture | null>(() => buildStarfield());
  useEffect(() => {
    return () => {
      if (skyboxTexture) skyboxTexture.dispose();
    };
  }, [skyboxTexture]);

  // Hemisphere check — when a face is active, ships on the opposite half are
  // marked as `dim` so they render in a darkened palette. We don't hide them;
  // the player still wants to know they're there, just visually demoted while
  // focusing on the active face.
  const isShipDim = (e: CombatEnemyShip): boolean => {
    if (!shownFace) return false;
    const ax = FACE_BY_ID[shownFace].axis;
    const [px, py, pz] = shipWorldPosition(e.range, e.azimuthDeg, e.elevationDeg);
    return ax[0] * px + ax[1] * py + ax[2] * pz < 0;
  };
  return (
    <Canvas
      shadows
      camera={{
        position: [0, CAMERA_INITIAL_DISTANCE, 0.001],  // tiny offset avoids gimbal lock
        fov: 50,
        near: 0.1,
        far: CAMERA_MAX_DISTANCE * 8,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      onCreated={({ gl }) => {
        // Per-material clipping planes (used by FaceFilterOverlay's
        // half-space darken effect). Renderer property, not a constructor arg.
        gl.localClippingEnabled = true;
        // Soft shadow filtering — much nicer than the default hard PCF.
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* Lights — keyed cool/warm pair plus a soft hemispherical fill and a
         warm rim from behind. The cool key casts shadows; the others fill
         and rim without shadow cost. Shadow camera frustum is sized to the
         medium/far range area where most enemies will sit. */}
      <ambientLight intensity={0.22} />
      <hemisphereLight color="#a8c8ff" groundColor="#1a1830" intensity={0.4} />
      <directionalLight
        position={[18, 24, 12]}
        intensity={1.15}
        color="#cfe8ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <directionalLight position={[-15, -6, -10]} intensity={0.35} color="#5a4a78" />
      {/* Warm rim from behind the camera's typical starting view — picks out
         the back edges of ships against the dark side of space. */}
      <directionalLight position={[-8, 4, -22]} intensity={0.45} color="#ffb878" />

      <Skybox texture={skyboxTexture} />
      {skyboxTexture && (
        <Environment map={skyboxTexture as THREE.Texture} background={false} />
      )}
      <PlayerVessel />

      {/* Enemy ships. Ships on the inactive half-space (when a face filter is
         active) render `dim` — present but visually demoted. While editing,
         click/contextmenu on OTHER ships are suppressed (focus trap).
         AnimatedEnemyShip is only mounted DURING the End-Turn animation
         window (animStartMs !== null). Outside of it, the static EnemyShip
         renders declaratively so no per-frame useFrame overhead is paid at
         scene rest. */}
      {enemies.map((e) => {
        const isLocked = editingShipId !== null && e.id !== editingShipId;
        const isEditing = editingShipId === e.id;
        const dim = isShipDim(e);
        const previous = prevEnemies?.find((p) => p.id === e.id) ?? null;
        const click = isLocked
          ? undefined
          : onEnemyClick
            ? () => onEnemyClick(e.id)
            : undefined;
        const ctx = isLocked
          ? undefined
          : onEnemyContextMenu
            ? (sx: number, sy: number) => onEnemyContextMenu(e.id, sx, sy)
            : undefined;
        // The editing ship intentionally drops onClick so left-clicks pass
        // through to the drag-shell sphere; everyone else gets the click hook.
        // Same goes for the static path: the editing ship is always static,
        // and it never wants click anyway.
        if (isEditing || animStartMs == null) {
          return (
            <EnemyShip
              key={e.id}
              enemy={e}
              dim={dim}
              onClick={isEditing ? undefined : click}
              onContextMenu={ctx}
            />
          );
        }
        return (
          <AnimatedEnemyShip
            key={e.id}
            current={e}
            previous={previous}
            animStartMs={animStartMs}
            animDurationMs={VISUAL.endTurnAnimMs}
            dim={dim}
            onClick={click}
            onContextMenu={ctx}
          />
        );
      })}

      {/* Drag controller — renders whenever a ship is in edit mode (including
         freshly-added ships, which have no `editingOriginal` snapshot yet). */}
      {editingShip && onEnemyDrag && (
        <EnemyDragController
          staged={editingShip}
          onDrag={(az, el) => onEnemyDrag(editingShip.id, az, el)}
        />
      )}
      {/* Staging ghost + arc + distance line — only when an original exists
         to compare against (i.e., the ship was already on the field). New
         adds skip the ghost since there's nothing to revert to. */}
      {editingShip && editingOriginal && (
        <StagingGhost original={editingOriginal} staged={editingShip} />
      )}

      {/* Range shell. Sources, deduped:
          - the local user's hover/active range toggle (player tools)
          - the editing ship's current range (auto-shown to the GM during edit) */}
      {(() => {
        const ranges = new Set<typeof shownRange>();
        if (shownRange) ranges.add(shownRange);
        if (editingShip) ranges.add(editingShip.range);
        return Array.from(ranges).map((r) =>
          r ? (
            <RangeShell
              key={r}
              radius={RANGE_BY_ID[r].radius}
              dotCount={VISUAL.rangeShellDotCount * RANGE_DOT_COUNT_MULTIPLIER[r]}
            />
          ) : null,
        );
      })()}
      <FaceFilterOverlay activeFace={shownFace} />

      {/* Synced (polled) weapon highlights from other users. */}
      {syncedPlaced.map((h, i) => {
        const w = getWeaponById(h.weaponId);
        if (!w) return null;
        return <WeaponVolume key={i} weapon={w} axis={h.axis} color={h.color} />;
      })}

      {/* Local user's own placed weapon (immediate render, not waiting for poll). */}
      {localPlaced && !aimingWeapon && (() => {
        const w = getWeaponById(localPlaced.weaponId);
        if (!w) return null;
        return <WeaponVolume weapon={w} axis={localPlaced.axis} color={localPlaced.color} />;
      })()}

      {/* Aim mode — cursor-controlled preview, NOT yet synced. */}
      {aimingWeapon && (
        <WeaponAimController
          weapon={aimingWeapon}
          color={viewerColor}
          onPlace={onPlaceWeapon}
        />
      )}

      {children}

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
        mouseButtons={{
          // Right-click drag = orbit. Left-click reserved for scene clicks.
          LEFT: undefined as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        // Slight inertia for a smoother feel.
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}

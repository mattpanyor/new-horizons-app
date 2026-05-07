"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { GameBoardProps } from "./gameComponents";
import type {
  CombatEnemyShip,
  CombatFace,
  CombatPlacedHighlight,
  CombatRangeBand,
  SpaceCombatConfig,
  SpaceCombatState,
} from "@/types/game";
import { getWeaponById } from "@/lib/combat/playerShip";
import { VISUAL } from "@/lib/combat/visual";
import { SIZE_CLASS_BY_ID } from "@/lib/combat/sizeClasses";
import PlayerPanel from "@/components/combat/panels/PlayerPanel";
import StatusOverlay from "@/components/combat/panels/StatusOverlay";
import GMPanel from "@/components/combat/panels/GMPanel";
import AddShipModal from "@/components/combat/panels/AddShipModal";
import EndTurnButton from "@/components/combat/panels/EndTurnButton";
import EnemyContextMenu from "@/components/combat/panels/EnemyContextMenu";
import AssemblySplash from "@/components/combat/AssemblySplash";
import HUDBezel from "@/components/combat/HUDBezel";
import { useCombatStaging } from "@/hooks/useCombatStaging";

const Scene = dynamic(() => import("@/components/combat/Scene"), { ssr: false });

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface ViewState {
  activeFace: CombatFace | null;
  hoveredFace: CombatFace | null;
  activeRange: CombatRangeBand | null;
  hoveredRange: CombatRangeBand | null;
}

type WeaponLocalState =
  | { kind: "inactive" }
  | { kind: "aiming"; weaponId: string }
  | { kind: "placed"; placement: CombatPlacedHighlight };

const GM_ACCESS_LEVEL = 127;

export default function SpaceCombatBoard({ session, username, viewer }: GameBoardProps) {
  const config = session.config as SpaceCombatConfig;
  const state = session.state as SpaceCombatState;

  const emptyView: ViewState = {
    activeFace: null,
    hoveredFace: null,
    activeRange: null,
    hoveredRange: null,
  };
  const [view, setView] = useState<ViewState>(emptyView);
  const [weapon, setWeapon] = useState<WeaponLocalState>({ kind: "inactive" });

  // GM state.
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    enemyId: string;
    x: number;
    y: number;
  } | null>(null);

  // Client-side staging buffer for GM edits in gm phase. Initial seed = current
  // polled enemies.
  const staging = useCombatStaging(state.enemies ?? []);

  // Phase change → reset everything local AND resync staging from polled state.
  const [prevPhase, setPrevPhase] = useState(state.phase);
  if (prevPhase !== state.phase) {
    setPrevPhase(state.phase);
    setView(emptyView);
    setWeapon({ kind: "inactive" });
    setSelectedEnemyId(null);
    setAddModalOpen(false);
    setContextMenu(null);
    staging.resyncOriginal(state.enemies ?? []);
  }

  // Resync staging when the server-side enemies list changes via player-phase
  // direct edits (PATCH/DELETE). We use moveCount as the change signal since
  // immediate edits bump it on every write. Also drives the End-Turn animation:
  // when moveCount jumps and we're now in player phase, kick off interpolation
  // of polled enemies from `prevEnemies` → `enemies` over endTurnAnimMs.
  const [prevMoveCount, setPrevMoveCount] = useState(state.moveCount);
  const [animStartMs, setAnimStartMs] = useState<number | null>(null);
  if (prevMoveCount !== state.moveCount) {
    setPrevMoveCount(state.moveCount);
    if (state.phase === "player") {
      staging.resyncOriginal(state.enemies ?? []);
      // Trigger animation only if we have a previous snapshot to lerp from.
      if (state.prevEnemies && state.prevEnemies.length > 0) {
        setAnimStartMs(performance.now());
      }
    }
  }
  // Clear animStart after the animation window closes so subsequent renders
  // snap to canonical (avoids stuttering on later moveCount bumps).
  useEffect(() => {
    if (animStartMs === null) return;
    const remaining = VISUAL.endTurnAnimMs - (performance.now() - animStartMs);
    const timer = window.setTimeout(
      () => setAnimStartMs(null),
      Math.max(0, remaining + 50),
    );
    return () => window.clearTimeout(timer);
  }, [animStartMs]);

  const isCommander = username === config.commanderUsername;
  const isGM = viewer.accessLevel >= GM_ACCESS_LEVEL;
  const inPlayerPhase = state.phase === "player";
  const inGmPhase = state.phase === "gm";
  const playerToolsEnabled = inPlayerPhase && !isGM;
  const viewerColor = viewer.color ?? VISUAL.defaultUserColor;

  // ─── Loading splash gating ─────────────────────────────────────────────
  // Show splash while the 3D scene is initializing for the first time, AND
  // for non-GM users until the GM has ended their first turn (moveCount ≥ 1).
  // After that, the splash never reappears for that user until a page refresh.
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    // Minimum on-screen time so the splash isn't a sub-second flash on fast
    // page loads. Long enough to cover R3F Canvas mount + skybox texture.
    const t = window.setTimeout(() => setSceneReady(true), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const splashVisible =
    !sceneReady ||
    (!isGM && inGmPhase && (state.moveCount ?? 0) === 0);

  // HUD frame + panels render only after the splash decides to dismiss; their
  // mount triggers the bezel-glitch and panel-slide-in animations.
  const hudShouldShow = !splashVisible;

  // Edit-mode focus trap: while a ship is selected, all GM controls outside
  // the editing section + the currently-edited ship's right-click menu are
  // disabled.
  const editLocked = selectedEnemyId !== null;

  // Single-active-per-group toggles.
  const toggleFace = (face: CombatFace) =>
    setView((v) => ({ ...v, activeFace: v.activeFace === face ? null : face }));
  const toggleRange = (range: CombatRangeBand) =>
    setView((v) => ({ ...v, activeRange: v.activeRange === range ? null : range }));
  const setHoveredFace = (face: CombatFace | null) =>
    setView((v) => ({ ...v, hoveredFace: face }));
  const setHoveredRange = (range: CombatRangeBand | null) =>
    setView((v) => ({ ...v, hoveredRange: range }));

  const postClearHighlight = useCallback(() => {
    void fetch("/api/combat/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weaponId: null, axis: null }),
    });
  }, []);

  const postPlaceHighlight = useCallback(
    (weaponId: string, axis: { x: number; y: number; z: number }) => {
      void fetch("/api/combat/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId, axis }),
      });
    },
    [],
  );

  const toggleWeapon = (weaponId: string) => {
    if (!getWeaponById(weaponId)) return;
    if (weapon.kind === "inactive") {
      setWeapon({ kind: "aiming", weaponId });
      return;
    }
    const currentId =
      weapon.kind === "aiming" ? weapon.weaponId : weapon.placement.weaponId;
    const wasPlaced = weapon.kind === "placed";
    if (currentId === weaponId) {
      setWeapon({ kind: "inactive" });
      if (wasPlaced) postClearHighlight();
    } else {
      setWeapon({ kind: "aiming", weaponId });
      if (wasPlaced) postClearHighlight();
    }
  };

  const handlePlaceWeapon = (axis: { x: number; y: number; z: number }) => {
    if (weapon.kind !== "aiming") return;
    const weaponId = weapon.weaponId;
    const placement: CombatPlacedHighlight = { weaponId, axis, color: viewerColor };
    setWeapon({ kind: "placed", placement });
    postPlaceHighlight(weaponId, axis);
  };

  // ─── GM interactions ───────────────────────────────────────────────

  const handleEnemyClick = (id: string) => {
    if (!isGM) return;
    if (editLocked) return; // focus trap — only the editing ship is interactive
    setSelectedEnemyId(id);
    setContextMenu(null);
  };

  const handleEnemyContextMenu = (id: string, sx: number, sy: number) => {
    if (!isGM) return;
    if (!inGmPhase) return; // right-click context menu is GM-phase only
    if (editLocked && id !== selectedEnemyId) return; // focus trap
    setContextMenu({ enemyId: id, x: sx, y: sy });
  };

  // GM Phase ADD: stage the new ship locally and auto-enter edit mode.
  const handleAddConfirm = (payload: {
    range: CombatRangeBand;
    sizeClass: CombatEnemyShip["sizeClass"];
    factionId: string | null;
    label?: string;
  }) => {
    setAddModalOpen(false);
    const newShip: CombatEnemyShip = {
      id: crypto.randomUUID(),
      sizeClass: payload.sizeClass,
      label: payload.label || SIZE_CLASS_BY_ID[payload.sizeClass].displayName,
      factionId: payload.factionId,
      range: payload.range,
      azimuthDeg: 0,
      elevationDeg: 0,
      facing: "bow",
    };
    staging.addStaged(newShip);
    setSelectedEnemyId(newShip.id);
  };

  // Done in panel — commit local staged edits to the buffer (already applied
  // to staged via editStaged calls) and exit edit mode.
  const handleSaveEdit = (changes: { label: string; factionId: string | null }) => {
    if (!selectedEnemyId) return;
    if (inGmPhase) {
      // Stage label/faction edits client-side; End Turn commits the full list.
      staging.editStaged(selectedEnemyId, changes);
    } else {
      // Player phase: PATCH directly (no End Turn from GM in this phase).
      void fetch(`/api/combat/enemy/${selectedEnemyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
    }
    setSelectedEnemyId(null);
  };

  // Esc / Cancel — discard pending edits for this ship by reverting staged to original.
  const handleCancelEdit = () => {
    if (selectedEnemyId && inGmPhase) {
      staging.revertStaged(selectedEnemyId);
    }
    setSelectedEnemyId(null);
  };

  // Delete — always immediate, both phases. Bypasses staging.
  const handleDelete = async () => {
    if (!selectedEnemyId) return;
    const id = selectedEnemyId;
    setSelectedEnemyId(null);
    staging.removeFromStaging(id);
    await fetch(`/api/combat/enemy/${id}`, { method: "DELETE" });
  };

  // GM drag — updates staged azimuth/elevation as cursor moves.
  const handleEnemyDrag = (id: string, azimuthDeg: number, elevationDeg: number) => {
    staging.editStaged(id, { azimuthDeg, elevationDeg });
  };

  // Right-click context menu actions (range / facing / delete).
  const handleContextChangeRange = (range: CombatRangeBand) => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    if (inGmPhase) {
      staging.editStaged(id, { range });
    } else {
      void fetch(`/api/combat/enemy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
    }
  };
  const handleContextChangeFacing = (facing: CombatFace) => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    if (inGmPhase) {
      staging.editStaged(id, { facing });
    } else {
      void fetch(`/api/combat/enemy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facing }),
      });
    }
  };
  const handleContextDelete = async () => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    staging.removeFromStaging(id);
    if (selectedEnemyId === id) setSelectedEnemyId(null);
    await fetch(`/api/combat/enemy/${id}`, { method: "DELETE" });
  };

  // End Turn — gm-phase POSTs the full staged list; player-phase POSTs without body.
  const handleEndTurn = async () => {
    if (inGmPhase) {
      await fetch("/api/combat/end-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enemies: staging.stagedEnemies }),
      });
    } else {
      await fetch("/api/combat/end-turn", { method: "POST" });
    }
  };

  // Esc — priority cascade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      if (weapon.kind === "aiming") {
        setWeapon({ kind: "inactive" });
        return;
      }
      if (selectedEnemyId !== null) {
        handleCancelEdit();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weapon.kind, selectedEnemyId, contextMenu]);

  const activeWeaponId =
    weapon.kind === "aiming"
      ? weapon.weaponId
      : weapon.kind === "placed"
        ? weapon.placement.weaponId
        : null;

  const syncedPlaced: CombatPlacedHighlight[] = Object.entries(
    state.weaponHighlights ?? {},
  )
    .filter(([u, h]) => u !== username && h)
    .map(([, h]) => h as CombatPlacedHighlight);

  const localPlaced = weapon.kind === "placed" ? weapon.placement : null;

  const statusFace = view.hoveredFace ?? view.activeFace;
  const statusRange = view.hoveredRange ?? view.activeRange;
  const statusWeapon =
    weapon.kind === "aiming"
      ? { weaponId: weapon.weaponId, phase: "aiming" as const }
      : weapon.kind === "placed"
        ? { weaponId: weapon.placement.weaponId, phase: "locked" as const }
        : null;

  const aimingWeaponDef =
    weapon.kind === "aiming" ? getWeaponById(weapon.weaponId) ?? null : null;

  // Which enemy list to render? In gm phase, render staged (so the GM sees
  // their pending changes live). In player phase, render the polled list.
  const renderEnemies = inGmPhase ? staging.stagedEnemies : state.enemies ?? [];
  const editingShip: CombatEnemyShip | null = selectedEnemyId
    ? renderEnemies.find((e) => e.id === selectedEnemyId) ?? null
    : null;
  const editingOriginal: CombatEnemyShip | null =
    selectedEnemyId && inGmPhase
      ? staging.originalEnemies.find((e) => e.id === selectedEnemyId) ?? null
      : null;
  const contextEnemy = contextMenu
    ? renderEnemies.find((e) => e.id === contextMenu.enemyId) ?? null
    : null;

  // End Turn enable rules (incl. edit-mode focus trap).
  let endTurnEnabled = false;
  let endTurnReason = "";
  if (editLocked) {
    endTurnReason = "Finish editing first (Done or Esc).";
  } else if (inPlayerPhase) {
    endTurnEnabled = isCommander;
    if (!isCommander) endTurnReason = "Only the commander can end the player turn.";
  } else if (inGmPhase) {
    endTurnEnabled = isGM;
    if (!isGM) endTurnReason = "Only the GM can end the GM turn.";
  }

  return (
    <>
      <div className="fixed left-0 right-0 bottom-0 top-16 overflow-hidden bg-black z-0">
        <Scene
          activeFace={view.activeFace}
          hoveredFace={view.hoveredFace}
          activeRange={view.activeRange}
          hoveredRange={view.hoveredRange}
          aimingWeapon={aimingWeaponDef}
          viewerColor={viewerColor}
          onPlaceWeapon={handlePlaceWeapon}
          localPlaced={localPlaced}
          syncedPlaced={syncedPlaced}
          enemies={renderEnemies}
          onEnemyClick={isGM ? handleEnemyClick : undefined}
          onEnemyContextMenu={isGM ? handleEnemyContextMenu : undefined}
          editingShipId={selectedEnemyId}
          editingOriginal={editingOriginal}
          onEnemyDrag={inGmPhase ? handleEnemyDrag : undefined}
          prevEnemies={state.prevEnemies}
          animStartMs={inPlayerPhase ? animStartMs : null}
        />
      </div>

      <div className="fixed top-20 left-3 pointer-events-none flex flex-col gap-1 z-10">
        {config.label && (
          <p className="text-[11px] tracking-[0.3em] uppercase text-white/70" style={cinzel}>
            {config.label}
          </p>
        )}
        <p className="text-[9px] tracking-[0.25em] uppercase text-white/35" style={cinzel}>
          Phase: {state.phase} · Commander: {config.commanderUsername || "—"}
          {isCommander && " · You command"}
          {isGM && " · GM"}
        </p>
      </div>

      <StatusOverlay face={statusFace} range={statusRange} weapon={statusWeapon} />

      {/* HUD frame — top + bottom thin lines tracing the chamfered notch.
         Mounts after splash dismisses; glitch-fades in on its own. */}
      {hudShouldShow && <HUDBezel />}

      {/* Empty-state hint while no enemies are present (helps the first turn). */}
      {hudShouldShow && renderEnemies.length === 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
          <p className="text-[10px] tracking-[0.4em] uppercase text-white/30" style={cinzel}>
            {isGM
              ? "Scene is empty — Add Ship to begin"
              : "Awaiting GM to populate the encounter"}
          </p>
        </div>
      )}

      {hudShouldShow && !isGM && (
        <PlayerPanel
          activeFace={view.activeFace}
          hoveredFace={view.hoveredFace}
          onToggleFace={toggleFace}
          onHoverFace={setHoveredFace}
          activeRange={view.activeRange}
          hoveredRange={view.hoveredRange}
          onToggleRange={toggleRange}
          onHoverRange={setHoveredRange}
          activeWeaponId={activeWeaponId}
          onToggleWeapon={toggleWeapon}
          enabled={playerToolsEnabled}
        />
      )}

      <GMPanel
        visible={hudShouldShow && isGM}
        inGmPhase={inGmPhase && !editLocked}
        onAdd={() => setAddModalOpen(true)}
        selectedEnemy={editingShip}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onCancelEdit={handleCancelEdit}
      />

      <AddShipModal
        open={addModalOpen && !editLocked}
        onClose={() => setAddModalOpen(false)}
        onConfirm={handleAddConfirm}
      />

      {contextMenu && contextEnemy && (
        <EnemyContextMenu
          enemy={contextEnemy}
          screenX={contextMenu.x}
          screenY={contextMenu.y}
          onChangeRange={handleContextChangeRange}
          onChangeFacing={handleContextChangeFacing}
          onDelete={handleContextDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {hudShouldShow && (
        <EndTurnButton
          enabled={endTurnEnabled}
          disabledReason={endTurnReason}
          onClick={handleEndTurn}
        />
      )}

      {/* Loading splash — sits on top of everything during the gated window. */}
      <AssemblySplash
        visible={splashVisible}
        title="Initializing Combat Systems"
        subtitle={
          !sceneReady
            ? "Synchronizing tactical view"
            : !isGM && inGmPhase && (state.moveCount ?? 0) === 0
              ? "Awaiting tactical telemetry feed"
              : undefined
        }
      />
    </>
  );
}

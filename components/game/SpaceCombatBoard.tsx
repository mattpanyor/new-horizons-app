"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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
import SceneErrorBoundary from "@/components/combat/SceneErrorBoundary";
import { useCombatStaging } from "@/hooks/useCombatStaging";
import { useDerivedReset } from "@/hooks/useDerivedReset";

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

// Flip-button display states (kept local to this file — the panel doesn't
// need to know about server-side cooldown internals).
type PlayerPanelFlipState =
  | { kind: "ready" }
  | { kind: "charging" }
  | { kind: "cooldown"; turnsLeft: number };

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
  useDerivedReset(state.phase, () => {
    setView(emptyView);
    setWeapon({ kind: "inactive" });
    setSelectedEnemyId(null);
    setAddModalOpen(false);
    setContextMenu(null);
    staging.resyncOriginal(state.enemies ?? []);
  });

  // Resync staging when the server-side enemies list changes via player-phase
  // direct edits (PATCH/DELETE). We use moveCount as the change signal since
  // immediate edits bump it on every write.
  //
  // The End-Turn animation must ONLY fire when the bump represents the
  // gm→player transition — not every PATCH/DELETE that happens during the
  // player phase (e.g. GM toggling shields, renaming a label). We detect the
  // transition by tracking the phase observed at the previous render: if it
  // was "gm" and the current is "player", the bump is the End Turn commit.
  const [animStartMs, setAnimStartMs] = useState<number | null>(null);
  const lastSeenPhaseRef = useRef(state.phase);
  useDerivedReset(state.moveCount, () => {
    if (state.phase !== "player") return;
    staging.resyncOriginal(state.enemies ?? []);
    const wasInGmPhase = lastSeenPhaseRef.current === "gm";
    if (
      wasInGmPhase &&
      state.prevEnemies &&
      state.prevEnemies.length > 0
    ) {
      setAnimStartMs(performance.now());
    }
  });
  // Update the phase tracker AFTER the derived-reset hooks have run (so they
  // can read the prior phase) but during render, before JSX returns.
  lastSeenPhaseRef.current = state.phase;
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

  // ─── Error toast (auto-dismissing) ─────────────────────────────────────
  // POSTs that fail (network blip, rejected by server) raise a short message
  // here so the user knows their action didn't sync. Local state revert is
  // handled at each call site below.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  // `detail` comes from the server's `error` field via postCombat; appended
  // so the toast surfaces the actual reason (e.g. "Lattice cannot be raised
  // while Flip is charging") instead of a generic local context.
  const showError = useCallback((msg: string, detail?: string | null) => {
    setErrorMsg(detail ? `${msg}: ${detail}` : msg);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setErrorMsg(null), 4000);
  }, []);
  useEffect(() => () => {
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
  }, []);

  // Wraps fetch with consistent failure handling. Returns null on success,
  // otherwise a short error message — typically the server's `error` field
  // from a 4xx/5xx JSON response, falling back to HTTP status / exception.
  // Call sites combine this with their own context message ("Failed to X: ...").
  const postCombat = useCallback(
    async (url: string, init?: RequestInit): Promise<string | null> => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body.error === "string" && body.error.trim()) {
              detail = body.error;
            }
          } catch {
            /* response had no JSON body — keep HTTP-status fallback */
          }
          console.warn(`[combat] ${url} failed: ${detail}`);
          return detail;
        }
        return null;
      } catch (e) {
        console.warn(`[combat] ${url} fetch error:`, e);
        return "Network error";
      }
    },
    [],
  );

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

  // Latest server moveCount. Read by the highlight POSTs as
  // `expectedMoveCount` so a write racing against End Turn is rejected with
  // 409 instead of leaking a stale highlight into the next turn.
  const moveCountRef = useRef(state.moveCount);
  moveCountRef.current = state.moveCount;

  // In-flight guard for the place POST. React's render batching can queue
  // two click events before the state update lands, both passing the
  // weapon.kind === "aiming" guard. The ref makes the second call a no-op.
  const placeInFlightRef = useRef(false);

  const postClearHighlight = useCallback(async () => {
    const err = await postCombat("/api/combat/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weaponId: null,
        axis: null,
        expectedMoveCount: moveCountRef.current,
      }),
    });
    if (err) showError("Failed to clear weapon highlight", err);
  }, [postCombat, showError]);

  const postPlaceHighlight = useCallback(
    async (weaponId: string, axis: { x: number; y: number; z: number }) => {
      if (placeInFlightRef.current) return;
      placeInFlightRef.current = true;
      try {
        const err = await postCombat("/api/combat/highlight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weaponId,
            axis,
            expectedMoveCount: moveCountRef.current,
          }),
        });
        if (err) {
          showError("Failed to place weapon highlight", err);
          // Revert local placed state to inactive — the visible cone in the
          // user's own view would otherwise stay up while no other client
          // ever sees it (no server record).
          setWeapon({ kind: "inactive" });
        }
      } finally {
        placeInFlightRef.current = false;
      }
    },
    [postCombat, showError],
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

  // ─── Aegis abilities (Flip + Lattice) ───────────────────────────────

  // In-flight guard for Flip — same reasoning as weapon-place: a fast
  // double-click otherwise queues two charging POSTs before state syncs.
  const flipInFlightRef = useRef(false);

  const handleInvokeFlip = useCallback(async () => {
    if (flipInFlightRef.current) return;
    flipInFlightRef.current = true;
    try {
      const err = await postCombat("/api/combat/flip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedMoveCount: moveCountRef.current }),
      });
      if (err) showError("Failed to invoke Flip", err);
    } finally {
      flipInFlightRef.current = false;
    }
  }, [postCombat, showError]);

  // Latest lattice state — read by the toggle handler so it knows whether
  // it's an arm or disarm request.
  const latticeRef = useRef<boolean>(!!state.latticeActive);
  latticeRef.current = !!state.latticeActive;
  const latticeInFlightRef = useRef(false);

  const handleToggleLattice = useCallback(async () => {
    if (latticeInFlightRef.current) return;
    latticeInFlightRef.current = true;
    try {
      const wantActive = !latticeRef.current;
      // If activating Lattice while Graviton Lance is in use, clear the
      // local weapon state — its button is about to disable on the panel.
      if (wantActive) {
        const currentWeaponId =
          weapon.kind === "aiming"
            ? weapon.weaponId
            : weapon.kind === "placed"
              ? weapon.placement.weaponId
              : null;
        if (currentWeaponId === "graviton-lance") {
          setWeapon({ kind: "inactive" });
          if (weapon.kind === "placed") {
            await postClearHighlight();
          }
        }
      }
      const err = await postCombat("/api/combat/lattice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: wantActive,
          expectedMoveCount: moveCountRef.current,
        }),
      });
      if (err) showError("Failed to toggle Lattice", err);
    } finally {
      latticeInFlightRef.current = false;
    }
  }, [postCombat, postClearHighlight, showError, weapon]);

  const handleDisarmLattice = useCallback(async () => {
    const err = await postCombat("/api/combat/lattice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active: false,
        expectedMoveCount: moveCountRef.current,
      }),
    });
    if (err) showError("Failed to disarm Lattice", err);
  }, [postCombat, showError]);

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

  // Done in panel — commit panel-draft edits (label / faction / shields). In
  // GM phase the changes go to the staging buffer (committed at End Turn);
  // in player phase they PATCH directly.
  const handleSaveEdit = async (changes: {
    label: string;
    factionId: string | null;
    shieldsUp: boolean;
  }) => {
    if (!selectedEnemyId) return;
    const id = selectedEnemyId;
    setSelectedEnemyId(null);
    if (inGmPhase) {
      staging.editStaged(id, changes);
      return;
    }
    const err = await postCombat(`/api/combat/enemy/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (err) showError("Failed to save edit", err);
  };

  // Esc / Cancel — discard pending edits for this ship by reverting staged to original.
  const handleCancelEdit = () => {
    if (selectedEnemyId && inGmPhase) {
      staging.revertStaged(selectedEnemyId);
    }
    setSelectedEnemyId(null);
  };

  // Delete — always immediate, both phases. Bypasses staging. If the network
  // call fails, the next 2 s poll will restore the enemy from server state.
  const handleDelete = async () => {
    if (!selectedEnemyId) return;
    const id = selectedEnemyId;
    setSelectedEnemyId(null);
    staging.removeFromStaging(id);
    const err = await postCombat(`/api/combat/enemy/${id}`, { method: "DELETE" });
    if (err) showError("Failed to delete", err);
  };

  // GM drag — updates staged azimuth/elevation as cursor moves.
  const handleEnemyDrag = (id: string, azimuthDeg: number, elevationDeg: number) => {
    staging.editStaged(id, { azimuthDeg, elevationDeg });
  };

  // Right-click context menu actions (range / facing / delete).
  const handleContextChangeRange = async (range: CombatRangeBand) => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    if (inGmPhase) {
      staging.editStaged(id, { range });
      return;
    }
    const err = await postCombat(`/api/combat/enemy/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ range }),
    });
    if (err) showError("Failed to change range", err);
  };
  const handleContextChangeFacing = async (facing: CombatFace) => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    if (inGmPhase) {
      staging.editStaged(id, { facing });
      return;
    }
    const err = await postCombat(`/api/combat/enemy/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facing }),
    });
    if (err) showError("Failed to change facing", err);
  };
  const handleContextDelete = async () => {
    if (!contextMenu) return;
    const id = contextMenu.enemyId;
    staging.removeFromStaging(id);
    if (selectedEnemyId === id) setSelectedEnemyId(null);
    const err = await postCombat(`/api/combat/enemy/${id}`, { method: "DELETE" });
    if (err) showError("Failed to delete", err);
  };

  // End Turn — gm-phase POSTs the full staged list; player-phase POSTs no body.
  // Failures here are the most user-visible: the GM thinks the turn ended but
  // the server didn't get it. Surface a clear error so they can retry.
  const handleEndTurn = async () => {
    const err = inGmPhase
      ? await postCombat("/api/combat/end-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enemies: staging.stagedEnemies }),
      })
      : await postCombat("/api/combat/end-turn", { method: "POST" });
    if (err) showError("End Turn failed", err);
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

  // Flip state for the player panel + visual aura. Server holds canonical
  // state; clients translate it into the panel's three-way display.
  const flipPanelState: PlayerPanelFlipState =
    state.flip?.status === "charging"
      ? { kind: "charging" }
      : state.flip?.status === "cooldown"
        ? { kind: "cooldown", turnsLeft: state.flip.cooldownLeft }
        : { kind: "ready" };
  const flipCharging = state.flip?.status === "charging";
  const latticeActive = !!state.latticeActive;
  const roundNumber = state.roundNumber ?? 1;

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
        <SceneErrorBoundary>
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
            skyboxSeed={session.id}
            flipCharging={flipCharging}
            latticeActive={latticeActive}
          />
        </SceneErrorBoundary>
      </div>

      {/* Top-left flavor text — quiet sci-fi chrome + round counter. */}
      {hudShouldShow && (
        <div className="fixed top-20 left-4 pointer-events-none z-10 flex flex-col gap-0.5">
          <p
            className="text-xs tracking-[0.55em] uppercase text-white/40"
            style={cinzel}
          >
            Aegis Systems Initialized
          </p>
          <p
            className="text-[10px] tracking-[0.4em] uppercase text-white/25"
            style={cinzel}
          >
            Round {roundNumber}
          </p>
        </div>
      )}

      {/* Turn indicator — big text inside the top bezel notch.
         GM phase is presented to players as "ENEMY TURN" (the GM is the
         narrative adversary). Glow tint distinguishes the two: blue when it
         belongs to the players, red when the enemy is acting.
         Font size and letter-spacing scale with viewport via clamp() so the
         label fits comfortably from mobile to ultrawide without clipping. */}
      {hudShouldShow && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center"
          style={{
            top: 78,
            maxWidth: "calc(100vw - 1rem)",
          }}
        >
          <p
            className="font-bold uppercase whitespace-nowrap"
            style={{
              ...cinzel,
              fontSize: "clamp(0.95rem, 2.4vw, 1.75rem)",
              letterSpacing: "clamp(2px, 0.5vw, 9px)",
              color: inGmPhase ? "#ff8a8a" : "#a8c8ff",
              textShadow: inGmPhase
                ? "0 0 14px rgba(239,68,68,0.55), 0 0 4px rgba(239,68,68,0.4)"
                : "0 0 14px rgba(120,180,255,0.55), 0 0 4px rgba(120,180,255,0.4)",
            }}
          >
            {inGmPhase ? "Enemy Turn" : "Player Turn"}
          </p>
        </div>
      )}

      <StatusOverlay face={statusFace} range={statusRange} weapon={statusWeapon} />

      {/* "Graviton Flip Commencing" status — pulsing purple text in the
         bottom-right while the commander has Flip armed during their turn.
         Hidden during gm phase (the flip is past the cancel point and the
         on-ship aura carries the message instead). Reuses the same proven
         `combat-status-pulse` class as the top-of-screen status overlay. */}
      {hudShouldShow && inPlayerPhase && state.flip?.status === "charging" && (
        <div className="fixed bottom-6 right-6 pointer-events-none z-10 combat-status-pulse">
          <p
            className="text-sm font-bold uppercase whitespace-nowrap"
            style={{
              ...cinzel,
              color: "#c084fc",
              letterSpacing: "0.45em",
              textShadow: "0 0 10px rgba(168,85,247,0.55)",
            }}
          >
            Graviton Flip Commencing
          </p>
        </div>
      )}

      {/* "Graviton Lattice Active" status — pulsing violet text mirrored on
         the bottom-left whenever the lattice shield is up (any phase, since
         it persists across turns until disarmed). Cooler violet than Flip's
         pink-purple so the two abilities read as distinct. */}
      {hudShouldShow && state.latticeActive && (
        <div className="fixed bottom-6 left-6 pointer-events-none z-10 combat-status-pulse">
          <p
            className="text-sm font-bold uppercase whitespace-nowrap"
            style={{
              ...cinzel,
              color: "#a78bfa",
              letterSpacing: "0.45em",
              textShadow: "0 0 10px rgba(139,92,246,0.55)",
            }}
          >
            Graviton Lattice Engaged
          </p>
        </div>
      )}

      {/* Auto-dismissing error toast for failed network calls. */}
      {errorMsg && (
        <div className="fixed top-24 right-1/2 translate-x-1/2 z-30 pointer-events-none">
          <div
            className="px-4 py-2 rounded border border-red-400/50 bg-red-950/85 backdrop-blur-md text-[10px] tracking-[0.25em] uppercase text-red-200/95"
            style={cinzel}
          >
            {errorMsg}
          </div>
        </div>
      )}

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
          isCommander={isCommander}
          flipState={flipPanelState}
          onInvokeFlip={handleInvokeFlip}
          latticeActive={latticeActive}
          onToggleLattice={handleToggleLattice}
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
        latticeActive={latticeActive}
        onDisarmLattice={handleDisarmLattice}
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

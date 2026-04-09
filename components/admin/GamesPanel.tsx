"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession, GameType, Board, CellState, StormQueensFollyConfig } from "@/types/game";
import { GAME_REGISTRY, GAME_TYPES } from "@/lib/games/registry";
import { getDefaultBoard } from "@/lib/games/stormQueensFolly";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface SimpleUser {
  id: number;
  username: string;
  character: string | null;
}

interface KankaChar {
  id: number;
  entityId: number;
  name: string;
  imageUrl: string | null;
  title: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  configured: "text-yellow-400/70 border-yellow-400/30",
  launched: "text-green-400/70 border-green-400/30",
  finished: "text-white/30 border-white/15",
};

const RATE_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Normal",
  3: "Hard",
};

// ─── Mini board editor ───

function BoardEditor({
  board,
  onChange,
}: {
  board: Board;
  onChange: (board: Board) => void;
}) {
  const cycle = (r: number, c: number) => {
    const order: CellState[] = [null, "player", "opponent"];
    const cur = board[r][c];
    const idx = order.indexOf(cur);
    const next = order[(idx + 1) % 3];
    const newBoard = board.map((row) => [...row]);
    newBoard[r][c] = next;
    onChange(newBoard);
  };

  const cellColor = (cell: CellState) => {
    if (cell === "player") return "bg-amber-500/40 border-amber-400/60";
    if (cell === "opponent") return "bg-purple-500/40 border-purple-400/60";
    return "bg-white/5 border-white/15";
  };

  return (
    <div className="grid grid-cols-3 gap-1 w-24">
      {board.map((row, r) =>
        row.map((cell, c) => (
          <button
            key={`${r}-${c}`}
            type="button"
            onClick={() => cycle(r, c)}
            className={`w-7 h-7 rounded border cursor-pointer transition-colors ${cellColor(cell)}`}
            title={cell ?? "empty"}
          />
        ))
      )}
    </div>
  );
}

// ─── Main panel ───

export default function GamesPanel() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [entities, setEntities] = useState<KankaChar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New game form
  const [creating, setCreating] = useState(false);
  const [formGameType, setFormGameType] = useState<GameType>(GAME_TYPES[0]);
  const [formRate, setFormRate] = useState<1 | 2 | 3>(2);
  const [formPlayer, setFormPlayer] = useState("");
  const [formEntity, setFormEntity] = useState<number | null>(null);
  const [formBoard, setFormBoard] = useState<Board>(getDefaultBoard());
  const [formWireCount, setFormWireCount] = useState(4);
  const [formDifficulty, setFormDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [formTimeLimit, setFormTimeLimit] = useState(90);
  const [formRoundCount, setFormRoundCount] = useState<1 | 3 | 5>(3);
  const [submitting, setSubmitting] = useState(false);

  // Player dropdown
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const playerDropdownRef = useRef<HTMLDivElement>(null);

  // Entity dropdown
  const [entitySearch, setEntitySearch] = useState("");
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const entityDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!playerDropdownOpen && !entityDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (playerDropdownOpen && playerDropdownRef.current && !playerDropdownRef.current.contains(e.target as Node)) {
        setPlayerDropdownOpen(false);
      }
      if (entityDropdownOpen && entityDropdownRef.current && !entityDropdownRef.current.contains(e.target as Node)) {
        setEntityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [playerDropdownOpen, entityDropdownOpen]);

  const selectedPlayer = users.find((u) => u.username === formPlayer) ?? null;
  const selectedEntity = entities.find((e) => e.entityId === formEntity) ?? null;
  const filteredPlayers = playerSearch
    ? users.filter((u) => (u.character ?? u.username).toLowerCase().includes(playerSearch.toLowerCase()))
    : users;
  const filteredEntities = entitySearch
    ? entities.filter((e) => e.name.toLowerCase().includes(entitySearch.toLowerCase()))
    : entities;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/games");
      if (!res.ok) {
        setError("Failed to load games");
        return;
      }
      const data = await res.json();
      setSessions(data.sessions);
      setUsers(data.users);
      setEntities(data.entities);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formPlayer) {
      setError("Select a player");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        formGameType === "storm-queens-folly"
          ? {
              gameType: formGameType,
              challengeRate: formRate,
              designatedPlayer: formPlayer,
              opponentEntityId: formEntity,
              initialBoard: formBoard,
            }
          : formGameType === "rune-poker"
          ? {
              gameType: formGameType,
              challengeRate: formRate,
              roundCount: formRoundCount,
              designatedPlayer: formPlayer,
              opponentEntityId: formEntity,
            }
          : {
              gameType: formGameType,
              designatedPlayer: formPlayer,
              opponentEntityId: formEntity,
              wireCount: formWireCount,
              difficulty: formDifficulty,
              timeLimit: formTimeLimit,
            }
      ),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to create game");
      return;
    }
    setCreating(false);
    setFormBoard(getDefaultBoard());
    await fetchData();
  };

  const handleAction = async (id: number, action: "launch" | "stop" | "relaunch") => {
    setError(null);
    const res = await fetch("/api/admin/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `Failed to ${action}`);
      return;
    }
    await fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this game session?")) return;
    setError(null);
    const res = await fetch("/api/admin/games", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to delete");
      return;
    }
    await fetchData();
  };

  if (loading) {
    return (
      <p className="text-white/30 text-xs tracking-[0.2em] uppercase" style={cinzel}>
        Loading...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-4 py-2 rounded border border-red-400/30 bg-red-900/20 text-red-300/80 text-xs" style={cinzel}>
          {error}
        </div>
      )}

      {/* Create button */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-400/20 text-indigo-400/50 hover:text-indigo-400/80 hover:border-indigo-400/40 hover:bg-indigo-400/5 transition-all cursor-pointer text-[9px] tracking-[0.15em] uppercase"
          style={cinzel}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Game
        </button>
      )}

      {/* Create form */}
      {creating && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-4 max-w-lg">
          <p className="text-[9px] tracking-[0.3em] uppercase text-white/30" style={cinzel}>
            New Game — {GAME_REGISTRY[formGameType].label}
          </p>

          {/* Game type (shown only if multiple types available) */}
          {GAME_TYPES.length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                Game Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {GAME_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFormGameType(t);
                      if (t === "storm-queens-folly") setFormBoard(getDefaultBoard());
                    }}
                    className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                      formGameType === t
                        ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                        : "border-white/10 text-white/30 hover:border-white/20"
                    }`}
                    style={cinzel}
                  >
                    {GAME_REGISTRY[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Challenge rate (SQF + Rune Poker) */}
          {(formGameType === "storm-queens-folly" || formGameType === "rune-poker") && (
            <div className="flex flex-col gap-1">
              <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                Challenge Rate
              </label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormRate(r)}
                    className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                      formRate === r
                        ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                        : "border-white/10 text-white/30 hover:border-white/20"
                    }`}
                    style={cinzel}
                  >
                    {RATE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EC: Wire count + time limit */}
          {formGameType === "engineering-challenge" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                  Wire Pairs
                </label>
                <div className="flex gap-2">
                  {([3, 4, 5, 6] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormWireCount(n)}
                      className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                        formWireCount === n
                          ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                          : "border-white/10 text-white/30 hover:border-white/20"
                      }`}
                      style={cinzel}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                  Difficulty
                </label>
                <div className="flex gap-2">
                  {(["easy", "normal", "hard"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormDifficulty(d)}
                      className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                        formDifficulty === d
                          ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                          : "border-white/10 text-white/30 hover:border-white/20"
                      }`}
                      style={cinzel}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                  Time Limit
                </label>
                <div className="flex gap-2">
                  {([60, 90, 120, 0] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormTimeLimit(t)}
                      className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                        formTimeLimit === t
                          ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                          : "border-white/10 text-white/30 hover:border-white/20"
                      }`}
                      style={cinzel}
                    >
                      {t === 0 ? "None" : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rune Poker: Round count */}
          {formGameType === "rune-poker" && (
            <div className="flex flex-col gap-1">
              <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                Round Count
              </label>
              <div className="flex gap-2">
                {([1, 3, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormRoundCount(n)}
                    className={`px-3 py-1.5 rounded border text-[9px] tracking-[0.1em] uppercase cursor-pointer transition-all ${
                      formRoundCount === n
                        ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300/80"
                        : "border-white/10 text-white/30 hover:border-white/20"
                    }`}
                    style={cinzel}
                  >
                    {n === 1 ? "Single" : `Best of ${n}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Designated player */}
          <div className="flex flex-col gap-1">
            <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Designated Player
            </label>
            <div className="relative" ref={playerDropdownRef}>
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Search players..."
                value={playerDropdownOpen ? playerSearch : (selectedPlayer ? (selectedPlayer.character ?? selectedPlayer.username) : "")}
                onChange={(e) => { setPlayerSearch(e.target.value); setPlayerDropdownOpen(true); }}
                onFocus={() => setPlayerDropdownOpen(true)}
              />
              {selectedPlayer && !playerDropdownOpen && (
                <button
                  onClick={() => { setFormPlayer(""); setPlayerSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
              {playerDropdownOpen && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-xl">
                  {filteredPlayers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-white/30">No players found</div>
                  ) : (
                    filteredPlayers.map((u) => (
                      <button
                        key={u.username}
                        onClick={() => {
                          setFormPlayer(u.username);
                          setPlayerDropdownOpen(false);
                          setPlayerSearch("");
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <div className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-white/70 truncate">{u.character ?? u.username}</div>
                          {u.character && <div className="text-[9px] text-white/30">{u.username}</div>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Opponent entity */}
          <div className="flex flex-col gap-1">
            <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
              Opponent (Kanka Character)
            </label>
            <div className="relative" ref={entityDropdownRef}>
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Search characters..."
                value={entityDropdownOpen ? entitySearch : (selectedEntity ? `${selectedEntity.name}${selectedEntity.title ? ` — ${selectedEntity.title}` : ""}` : "")}
                onChange={(e) => { setEntitySearch(e.target.value); setEntityDropdownOpen(true); }}
                onFocus={() => setEntityDropdownOpen(true)}
              />
              {selectedEntity && !entityDropdownOpen && (
                <button
                  onClick={() => { setFormEntity(null); setEntitySearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
              {entityDropdownOpen && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded border border-white/10 bg-gray-950/95 backdrop-blur-md shadow-xl">
                  <button
                    onClick={() => { setFormEntity(null); setEntityDropdownOpen(false); setEntitySearch(""); }}
                    className="w-full text-left px-3 py-2 text-xs text-white/30 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    None
                  </button>
                  {filteredEntities.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-white/30">No characters found</div>
                  ) : (
                    filteredEntities.map((e) => (
                      <button
                        key={e.entityId}
                        onClick={() => {
                          setFormEntity(e.entityId);
                          setEntityDropdownOpen(false);
                          setEntitySearch("");
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <div className="shrink-0 w-6 h-6 rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                          {e.imageUrl ? (
                            <img src={e.imageUrl} alt="" className="w-full h-full object-cover object-top" />
                          ) : (
                            <span className="text-[8px] text-white/20">C</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-white/70 truncate">{e.name}</div>
                          {e.title && <div className="text-[9px] text-white/30">{e.title}</div>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SQF: Board setup */}
          {formGameType === "storm-queens-folly" && (
            <div className="flex flex-col gap-1">
              <label className="text-[8px] tracking-[0.2em] uppercase text-white/30" style={cinzel}>
                Starting Board (click to cycle: empty → gold → purple)
              </label>
              <BoardEditor board={formBoard} onChange={setFormBoard} />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => { setCreating(false); setError(null); }}
              className="px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase text-white/30 hover:text-white/60 cursor-pointer"
              style={cinzel}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-4 py-1.5 rounded border border-indigo-400/30 text-[9px] tracking-[0.15em] uppercase text-indigo-300/70 hover:text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-400/10 disabled:opacity-30 cursor-pointer transition-all"
              style={cinzel}
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 && !creating ? (
        <p className="text-white/20 text-xs tracking-[0.2em] uppercase" style={cinzel}>
          No game sessions
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const player = users.find((u) => u.username === s.designatedPlayer);
            const entity = entities.find((e) => e.entityId === s.config.opponentEntityId);
            return (
              <div
                key={s.id}
                className="flex items-center gap-4 px-4 py-3 rounded-lg border border-white/8 bg-white/[0.02]"
              >
                {/* Status badge */}
                <span
                  className={`text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[s.status]}`}
                  style={cinzel}
                >
                  {s.status}
                </span>

                {/* Info */}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[10px] text-white/50 tracking-[0.1em] uppercase" style={cinzel}>
                    {GAME_REGISTRY[s.gameType as GameType]?.label ?? s.gameType}
                  </span>
                  <span className="text-[8px] text-white/25 mt-0.5">
                    Player: {player?.character ?? s.designatedPlayer}
                    {entity ? ` vs ${entity.name}` : ""}
                    {" · "}
                    {"challengeRate" in s.config && RATE_LABELS[(s.config as StormQueensFollyConfig).challengeRate]}
                    {"wireCount" in s.config && `${(s.config as { wireCount: number }).wireCount} wires`}
                    {"roundCount" in s.config && ` · Best of ${(s.config as { roundCount: number }).roundCount}`}
                    {s.winner && ` · Winner: ${s.winner}`}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {s.status === "configured" && (
                    <>
                      <button
                        onClick={() => handleAction(s.id, "launch")}
                        className="px-3 py-1 rounded border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all"
                        style={cinzel}
                      >
                        Launch
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-3 py-1 rounded border border-red-400/20 text-red-400/40 hover:text-red-400/80 hover:border-red-400/40 text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all"
                        style={cinzel}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {s.status === "launched" && (
                    <button
                      onClick={() => handleAction(s.id, "stop")}
                      className="px-3 py-1 rounded border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all"
                      style={cinzel}
                    >
                      Stop
                    </button>
                  )}
                  {s.status === "finished" && (
                    <>
                      <button
                        onClick={() => handleAction(s.id, "relaunch")}
                        className="px-3 py-1 rounded border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400/50 hover:bg-green-400/10 text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all"
                        style={cinzel}
                      >
                        Relaunch
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-3 py-1 rounded border border-white/10 text-white/30 hover:text-white/60 text-[8px] tracking-[0.1em] uppercase cursor-pointer transition-all"
                        style={cinzel}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

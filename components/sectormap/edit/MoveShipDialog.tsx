"use client";

// Cross-table ship/fleet move dialog. Replaces the marker-only mover.
// Source can be either:
//   - { bodyId }   → a celestial_bodies row (ship "in" a system)
//   - { markerId } → a markers row (ship on a connection, or a free marker)
// Destination is either:
//   - "system"     → ship becomes a body in that system
//   - "connection" → ship becomes a marker on that connection
//
// The server endpoint (PUT /api/admin/map/sectors/[slug]/move-ship) does
// the cross-table translation in one call, then router.refresh() pulls the
// new state. The dialog itself is a thin two-step picker.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditMode } from "./EditModeProvider";

export type MoveShipSource = { bodyId: number } | { markerId: number };

interface Props {
  source: MoveShipSource;
  onClose: () => void;
}

type Mode = "system" | "connection";

export function MoveShipDialog({ source, onClose }: Props) {
  const router = useRouter();
  const { baseSector, effectiveSector } = useEditMode();
  const [mode, setMode] = useState<Mode>("system");
  const [systemId, setSystemId] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live sector data for the pickers
  const systems = useMemo(() => effectiveSector.systems, [effectiveSector.systems]);
  const connections = useMemo(
    () => (effectiveSector.connections ?? []).filter((c) => c.id !== undefined),
    [effectiveSector.connections]
  );

  const confirm = async () => {
    setError(null);
    let destination: Record<string, unknown>;
    if (mode === "system") {
      const sid = Number(systemId);
      const sys = systems.find((s) => s.id === sid);
      if (!sys) { setError("Pick a system"); return; }
      destination = { systemId: sid };
    } else {
      const cid = Number(connectionId);
      const conn = connections.find((c) => c.id === cid);
      if (!conn) { setError("Pick a connection"); return; }
      destination = { connectionId: cid };
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/map/sectors/${baseSector.slug}/move-ship`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, destination }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Move failed (HTTP ${res.status})`);
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 border border-amber-500/30 rounded-lg p-5 w-[440px] max-w-[90vw] space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        <h3
          className="text-amber-300 text-sm uppercase tracking-widest"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Move Ship / Fleet
        </h3>

        {/* Mode toggle */}
        <div className="flex items-center rounded scifi-card text-xs select-none overflow-hidden border border-white/10">
          <button
            onClick={() => setMode("system")}
            className={`flex-1 px-3 py-1.5 transition-colors ${
              mode === "system" ? "bg-amber-500/30 text-amber-100" : "text-slate-400 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            To System
          </button>
          <button
            onClick={() => setMode("connection")}
            className={`flex-1 px-3 py-1.5 transition-colors ${
              mode === "connection" ? "bg-amber-500/30 text-amber-100" : "text-slate-400 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            To Connection
          </button>
        </div>

        {/* Target picker */}
        {mode === "system" ? (
          <div>
            <label
              className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Destination System
            </label>
            <select className={inputClass} value={systemId} onChange={(e) => setSystemId(e.target.value)}>
              <option value="">— pick a system —</option>
              {systems.map((s) => (
                <option key={s.slug} value={s.id}>
                  {s.name ?? s.slug}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              The ship becomes a celestial body in this system at default orbit (0°, 0.5 distance).
            </p>
          </div>
        ) : (
          <div>
            <label
              className="text-[11px] text-slate-400 tracking-wider uppercase block mb-1"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Destination Connection
            </label>
            <select className={inputClass} value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
              <option value="">— pick a connection —</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.from} → {c.to}{c.label ? ` (${c.label})` : ""}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              The ship becomes a marker on this connection at position 0.5 (midpoint).
              Tweak position in the side panel after.
            </p>
          </div>
        )}

        {error && (
          <div className="px-2 py-1.5 bg-rose-900/50 border border-rose-500/40 rounded text-rose-200 text-[11px]">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white border border-white/10 hover:border-white/30 disabled:opacity-40 transition"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={
              submitting ||
              (mode === "system" && !systemId) ||
              (mode === "connection" && !connectionId)
            }
            className="px-3 py-1.5 rounded text-xs bg-amber-500/30 text-amber-100 border border-amber-500/50 hover:bg-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {submitting ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}

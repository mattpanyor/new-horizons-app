"use client";

// Right-rail side panel visible only in sector-edit mode. Tabs: Selection,
// Connections (orphan management), Add Connection.

import { useState } from "react";
import { useEditMode } from "./EditModeProvider";
import { SelectionPanel } from "./SelectionPanel";
import { ConnectionsByLayerPanel } from "./ConnectionsByLayerPanel";
import { AddConnectionDialog } from "./AddConnectionDialog";

type Tab = "selection" | "connections";

export function SidePanel() {
  const { mode } = useEditMode();
  const [tab, setTab] = useState<Tab>("selection");
  const [addOpen, setAddOpen] = useState(false);

  if (mode !== "sector-edit") return null;

  return (
    <>
      <aside
        className="absolute top-3 right-3 bottom-3 w-[320px] scifi-card rounded-lg flex flex-col z-20 overflow-hidden"
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        {/* Tabs */}
        <div className="flex border-b border-white/10 shrink-0">
          <TabButton active={tab === "selection"} onClick={() => setTab("selection")}>
            Selection
          </TabButton>
          <TabButton active={tab === "connections"} onClick={() => setTab("connections")}>
            Connections
          </TabButton>
        </div>

        {/* Toolbar */}
        <div className="px-3 py-2 border-b border-white/10 shrink-0">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full px-3 py-1.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/40 hover:bg-amber-500/25 text-xs transition"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            + Add Connection
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {tab === "selection" && <SelectionPanel />}
          {tab === "connections" && <ConnectionsByLayerPanel onPicked={() => setTab("selection")} />}
        </div>
      </aside>

      {addOpen && <AddConnectionDialog onClose={() => setAddOpen(false)} />}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs uppercase tracking-widest transition ${
        active
          ? "bg-amber-500/15 text-amber-100"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
      style={{ fontFamily: "var(--font-cinzel), serif" }}
    >
      {children}
    </button>
  );
}

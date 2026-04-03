"use client";

import { useState } from "react";
import type { ShipAbility, ShipItem } from "@/types/ship";
import ShipAbilitiesModal from "./ShipAbilitiesModal";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const LIIX_LOGO = "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/liix_logo.jpeg";

const btnClass =
  "flex items-center gap-2.5 px-4 py-2 rounded-lg border border-white/10 md:border-white/20 text-white/40 md:text-white/60 hover:text-white/70 md:hover:text-white/90 hover:border-white/25 md:hover:border-white/40 hover:bg-white/5 md:hover:bg-white/10 transition-all cursor-pointer";
const btnStyle = { ...cinzel, backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" };

type ModalId = "cargo" | "isolation" | "abilities" | null;

const ITEM_ICONS: Record<string, React.ReactNode> = {
  "Lathanium Missiles": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 2 L14 8 L12 20 L10 8 Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 10 L12 20 L16 10" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),
  "Vereen Core": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-full h-full">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="12" r="1" fill="currentColor" fillOpacity="0.4" />
      <path d="M12 5 L12 2" />
      <path d="M12 22 L12 19" />
      <path d="M5 12 L2 12" />
      <path d="M22 12 L19 12" />
      <circle cx="12" cy="12" r="10" strokeDasharray="2 3" strokeOpacity="0.4" />
    </svg>
  ),
};

function ItemTile({ item }: { item: ShipItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded border border-white/8 bg-white/[0.02]">
      <div className="w-8 h-8 shrink-0 text-indigo-400/60">
        {ITEM_ICONS[item.name] ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </div>
      <span
        className="text-[9px] sm:text-[10px] tracking-[0.15em] uppercase text-white/45"
        style={cinzel}
      >
        {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
      </span>
    </div>
  );
}

interface ShipAbilitiesButtonProps {
  abilities: ShipAbility[];
  cargo: ShipItem[];
  isolation: ShipItem[];
  shipName: string;
  shipClass: string;
}

export default function ShipAbilitiesButton({ abilities, cargo, isolation, shipName, shipClass }: ShipAbilitiesButtonProps) {
  const [openModal, setOpenModal] = useState<ModalId>(null);

  return (
    <>
      <div className="fixed bottom-6 left-3 sm:left-6 md:left-10 z-40 flex flex-col gap-3">
        <button onClick={() => setOpenModal("cargo")} className={btnClass} style={btnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a4 4 0 0 0-8 0v2" />
          </svg>
          <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
            Cargo
          </span>
        </button>

        <button onClick={() => setOpenModal("isolation")} className={btnClass} style={btnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="3" x2="12" y2="1" />
            <line x1="12" y1="23" x2="12" y2="21" />
            <line x1="3" y1="12" x2="1" y2="12" />
            <line x1="23" y1="12" x2="21" y2="12" />
          </svg>
          <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
            Isolation
          </span>
        </button>

        <button onClick={() => setOpenModal("abilities")} className={btnClass} style={btnStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase">
            Abilities
          </span>
        </button>
      </div>

      {/* Abilities modal */}
      <ShipAbilitiesModal
        abilities={abilities}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "abilities"}
        onClose={() => setOpenModal(null)}
      />

      {/* Cargo modal */}
      <ShipAbilitiesModal
        abilities={[]}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "cargo"}
        onClose={() => setOpenModal(null)}
        terminalLabel={`${shipClass} — ${shipName} — Cargo Hold`}
        statusLabel="Cargo Manifest"
        headerLabel="Cargo Hold"
      >
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {cargo.length > 0 ? (
            cargo.map((item) => <ItemTile key={item.name} item={item} />)
          ) : (
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase text-center" style={cinzel}>
              No cargo loaded
            </p>
          )}
        </div>
      </ShipAbilitiesModal>

      {/* Isolation modal */}
      <ShipAbilitiesModal
        abilities={[]}
        shipName={shipName}
        shipClass={shipClass}
        open={openModal === "isolation"}
        onClose={() => setOpenModal(null)}
        backgroundLogo={LIIX_LOGO}
        terminalLabel={`${shipClass} — ${shipName} — Isolation Protocol`}
        statusLabel="L.I.I.X. Clearance"
        headerLabel="Xeno-specimen Storage"
      >
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {isolation.length > 0 ? (
            isolation.map((item) => <ItemTile key={item.name} item={item} />)
          ) : (
            <p className="text-white/30 text-xs tracking-[0.2em] uppercase text-center" style={cinzel}>
              No specimens stored
            </p>
          )}
        </div>
      </ShipAbilitiesModal>
    </>
  );
}

"use client";

import { useEffect } from "react";
import type { ShipItem } from "@/types/ship";
import { CARGO_TYPES, ISOLATION_TYPES } from "@/types/ship";
import { ITEM_TYPE_ICONS } from "./itemTypeIcons";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const TYPE_LABELS: Record<string, string> = Object.fromEntries([
  ...CARGO_TYPES.map((t) => [t.slug, t.label]),
  ...ISOLATION_TYPES.map((t) => [t.slug, t.label]),
]);

interface ItemDetailModalProps {
  item: ShipItem | null;
  onClose: () => void;
}

function PlaceholderImage() {
  return (
    <div className="w-full aspect-[16/10] rounded border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center gap-2">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/10">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <span className="text-[7px] tracking-[0.2em] uppercase text-white/10" style={cinzel}>
        No image available
      </span>
    </div>
  );
}

export default function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [item, onClose]);

  if (!item) return null;

  const categoryLabel = item.category === "cargo" ? "Cargo" : "Isolation";
  const typeLabel = TYPE_LABELS[item.itemType] ?? item.itemType;
  const Icon = ITEM_TYPE_ICONS[item.itemType];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(8, 12, 28, 0.98), rgba(4, 6, 18, 0.98))",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.5rem",
          boxShadow: "0 0 30px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          animation: "detailFadeIn 0.25s ease-out",
        }}
      >
        <style>{`@keyframes detailFadeIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

        {/* Top edge line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-indigo-400/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-indigo-400/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-indigo-400/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-indigo-400/70" />

        {/* Corner diamonds */}
        <div className="absolute top-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 -translate-y-1/2"
          style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
        <div className="absolute top-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 -translate-y-1/2"
          style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
        <div className="absolute bottom-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 translate-y-1/2"
          style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
        <div className="absolute bottom-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 translate-y-1/2"
          style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />

        {/* Side whiskers */}
        <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />
        <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />

        <div className="p-6 flex flex-col gap-4">
          {/* Image area */}
          {item.imageUrl ? (
            <div className="w-full aspect-[16/10] rounded overflow-hidden border border-white/5">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <PlaceholderImage />
          )}

          {/* Icon + name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 text-indigo-400/70">
              {Icon && <Icon />}
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold text-white/90 tracking-wide" style={cinzel}>
                {item.name}
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[8px] tracking-[0.2em] uppercase text-indigo-400/40" style={cinzel}>
                  {categoryLabel}
                </span>
                <span className="text-[8px] tracking-[0.15em] uppercase text-white/30" style={cinzel}>
                  {typeLabel}
                </span>
                <span className="text-[8px] tracking-[0.15em] uppercase text-white/25" style={cinzel}>
                  Qty: {item.quantity}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative w-full">
            <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
              <div className="w-2 h-px bg-indigo-400/40" />
              <div className="w-[3px] h-[3px] rotate-45 bg-indigo-400/50" />
              <div className="w-2 h-px bg-indigo-400/40" />
            </div>
          </div>

          {/* Description */}
          {item.description ? (
            <p className="text-white/60 text-sm leading-relaxed">
              {item.description}
            </p>
          ) : (
            <p className="text-white/20 text-sm italic">
              No description available.
            </p>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

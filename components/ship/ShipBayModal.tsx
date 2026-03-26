"use client";

import { useEffect, useRef } from "react";
import type { ShipBay } from "@/types/ship";

interface ShipBayModalProps {
  bay: ShipBay | null;
  layerName: string;
  layerColor: string;
  onClose: () => void;
}

export default function ShipBayModal({
  bay,
  layerName,
  layerColor,
  onClose,
}: ShipBayModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bay) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [bay, onClose]);

  if (!bay) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative max-w-2xl w-full overflow-hidden rounded-lg"
        style={{
          background: "rgba(10, 10, 30, 0.95)",
          border: `1px solid ${layerColor}55`,
          boxShadow: `0 0 40px ${layerColor}20, 0 0 80px ${layerColor}10, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${layerColor}, transparent)`,
          }}
        />

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Layer badge */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: layerColor }}
            />
            <span
              className="text-[10px] tracking-[0.3em] uppercase"
              style={{
                color: layerColor,
                fontFamily: "var(--font-cinzel), serif",
              }}
            >
              {layerName}
            </span>
          </div>

          {/* Title */}
          <h2
            className="text-xl text-white font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {bay.name}
          </h2>

          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed">
            {bay.description}
          </p>
        </div>

        {/* Accent line above image */}
        <div
          className="h-[1px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${layerColor}30, transparent)`,
          }}
        />

        {/* Image — full width, natural aspect ratio */}
        {bay.image && (
          <img
            src={bay.image}
            alt={bay.name}
            className="w-full h-auto block"
          />
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white/80 hover:border-white/30 transition-all cursor-pointer"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { ShipAbility } from "@/types/ship";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

const EXPLORATORIUM_LOGO = "https://mjeinpe7brjt91p8.public.blob.vercel-storage.com/factions/exploratorium_logo.png";

// Simple hex icon path for ability tiles
const HEX_PATH = "M50 2 L93 27 L93 73 L50 98 L7 73 L7 27 Z";

const ABILITY_ICONS: Record<string, React.ReactNode> = {
  "Graviton Lattice": (
    <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Ship silhouette */}
      <path d="M50 25 L42 45 L38 48 L38 65 L42 68 L50 72 L58 68 L62 65 L62 48 L58 45 Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
      <line x1="50" y1="25" x2="50" y2="72" strokeWidth="0.8" strokeOpacity="0.3" />
      {/* Lattice grid — diamond pattern wrapping the ship */}
      <path d="M50 18 L72 35 L72 65 L50 82 L28 65 L28 35 Z" strokeWidth="1.2" strokeOpacity="0.5" strokeDasharray="3 2" />
      <path d="M50 12 L80 32 L80 68 L50 88 L20 68 L20 32 Z" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="2 3" />
      {/* Cross lattice lines */}
      <line x1="28" y1="35" x2="72" y2="65" strokeWidth="0.6" strokeOpacity="0.15" />
      <line x1="72" y1="35" x2="28" y2="65" strokeWidth="0.6" strokeOpacity="0.15" />
      <line x1="50" y1="18" x2="50" y2="82" strokeWidth="0.6" strokeOpacity="0.15" />
      <line x1="28" y1="50" x2="72" y2="50" strokeWidth="0.6" strokeOpacity="0.15" />
      {/* Lattice nodes */}
      <circle cx="50" cy="18" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
      <circle cx="72" cy="35" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
      <circle cx="72" cy="65" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
      <circle cx="50" cy="82" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
      <circle cx="28" cy="65" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
      <circle cx="28" cy="35" r="2" fill="currentColor" fillOpacity="0.2" strokeWidth="0.8" />
    </g>
  ),
  "Automaton Core": (
    <g stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
      <circle cx="50" cy="50" r="18" />
      <circle cx="50" cy="50" r="8" fill="currentColor" fillOpacity="0.2" />
      <path d="M50 22 L50 10" />
      <path d="M50 78 L50 90" />
      <path d="M22 50 L10 50" />
      <path d="M78 50 L90 50" />
      <path d="M30 30 L22 22" strokeOpacity="0.5" />
      <path d="M70 70 L78 78" strokeOpacity="0.5" />
      <path d="M70 30 L78 22" strokeOpacity="0.5" />
      <path d="M30 70 L22 78" strokeOpacity="0.5" />
    </g>
  ),
  "Phase Anchor": (
    <g stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M50 80 L50 45" />
      <path d="M50 45 L30 25" />
      <path d="M50 45 L70 25" />
      <path d="M35 55 A25 25 0 0 1 65 55" strokeOpacity="0.4" />
      <path d="M25 65 A35 35 0 0 1 75 65" strokeOpacity="0.25" />
      <circle cx="50" cy="45" r="4" fill="currentColor" fillOpacity="0.3" />
    </g>
  ),
  "Chrono-gravitic Array": (
    <g stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="22" y="42" width="56" height="16" rx="3" />
      <line x1="78" y1="46" x2="90" y2="42" />
      <line x1="78" y1="54" x2="90" y2="58" />
      <line x1="22" y1="50" x2="14" y2="50" />
      <circle cx="38" cy="50" r="4" strokeOpacity="0.5" />
      <circle cx="58" cy="50" r="4" strokeOpacity="0.5" />
    </g>
  ),
  "Graviton Lance": (
    <g stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="50" x2="82" y2="50" />
      <line x1="82" y1="50" x2="92" y2="44" />
      <line x1="82" y1="50" x2="92" y2="56" />
      <path d="M18 40 L18 60" strokeOpacity="0.4" />
      <path d="M30 44 L30 56" strokeOpacity="0.3" />
      <circle cx="50" cy="50" r="6" fill="currentColor" fillOpacity="0.15" />
    </g>
  ),
  "Pulsar Swarm": (
    <g stroke="currentColor" fill="none" strokeLinecap="round">
      {/* Central pulsar */}
      <circle cx="50" cy="50" r="5" fill="currentColor" fillOpacity="0.25" strokeWidth="1.5" />
      {/* Pulse rings */}
      <circle cx="50" cy="50" r="12" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="20" strokeWidth="0.7" strokeOpacity="0.2" strokeDasharray="2 4" />
      {/* Swarm drones */}
      <circle cx="30" cy="35" r="3" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
      <circle cx="70" cy="38" r="3" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
      <circle cx="35" cy="68" r="3" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
      <circle cx="68" cy="65" r="3" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
      <circle cx="50" cy="26" r="2.5" fill="currentColor" fillOpacity="0.15" strokeWidth="1.2" />
      <circle cx="26" cy="52" r="2.5" fill="currentColor" fillOpacity="0.15" strokeWidth="1.2" />
      <circle cx="74" cy="52" r="2.5" fill="currentColor" fillOpacity="0.15" strokeWidth="1.2" />
      <circle cx="50" cy="76" r="2.5" fill="currentColor" fillOpacity="0.15" strokeWidth="1.2" />
      {/* Tiny outer swarm particles */}
      <circle cx="22" cy="42" r="1.5" fill="currentColor" fillOpacity="0.12" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="78" cy="44" r="1.5" fill="currentColor" fillOpacity="0.12" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="40" cy="80" r="1.5" fill="currentColor" fillOpacity="0.12" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="62" cy="22" r="1.5" fill="currentColor" fillOpacity="0.12" strokeWidth="0.8" strokeOpacity="0.4" />
    </g>
  ),
};

interface ShipAbilitiesModalProps {
  abilities: ShipAbility[];
  shipName: string;
  shipClass: string;
  open: boolean;
  onClose: () => void;
  backgroundLogo?: string;
  terminalLabel?: string;
  statusLabel?: string;
  headerLabel?: string;
  children?: React.ReactNode;
}

type Phase = "resize" | "header" | "icons" | "done";

export default function ShipAbilitiesModal({
  abilities,
  shipName,
  shipClass,
  open,
  onClose,
  backgroundLogo = EXPLORATORIUM_LOGO,
  terminalLabel,
  statusLabel = "Exploratorium Clearance",
  headerLabel = "Ship Systems Overview",
  children,
}: ShipAbilitiesModalProps) {
  const [phase, setPhase] = useState<Phase>("resize");
  const [resizeProgress, setResizeProgress] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [visibleIcons, setVisibleIcons] = useState(0);
  const [selectedAbility, setSelectedAbility] = useState<ShipAbility | null>(null);
  const [closing, setClosing] = useState(false);

  // Reset state when the modal opens. Render-time pattern instead of an effect
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // so React applies all six state updates in a single re-render.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setPhase("resize");
      setResizeProgress(0);
      setHeaderVisible(false);
      setVisibleIcons(0);
      setSelectedAbility(null);
      setClosing(false);
    }
  }

  // Phase 1: Resize animation
  useEffect(() => {
    if (!open || phase !== "resize") return;
    const start = performance.now();
    const duration = 1400;
    let raf: number;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setResizeProgress(eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase("header");
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, phase]);

  // Phase 2: Header fade in
  useEffect(() => {
    if (phase !== "header") return;
    const t = setTimeout(() => {
      setHeaderVisible(true);
      const t2 = setTimeout(() => setPhase("icons"), 600);
      return () => clearTimeout(t2);
    }, 100);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase 3: Icons appear one by one. The previous "done" phase was unread
  // anywhere — once visibleIcons reaches the abilities count, the effect just
  // stops scheduling new ticks.
  useEffect(() => {
    if (phase !== "icons") return;
    if (visibleIcons >= abilities.length) return;
    const t = setTimeout(() => setVisibleIcons((v) => v + 1), 120);
    return () => clearTimeout(t);
  }, [phase, visibleIcons, abilities.length]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedAbility) setSelectedAbility(null);
        else handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, selectedAbility, handleClose]);

  if (!open) return null;

  const scaleX = 0.05 + resizeProgress * 0.95;
  const scaleY = 0.05 + resizeProgress * 0.95;
  const opacity = Math.min(1, resizeProgress * 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: closing ? 0 : 1 }}
        onClick={() => {
          if (selectedAbility) setSelectedAbility(null);
          else handleClose();
        }}
      />

      {/* Desktop window wrapper — cursor is positioned relative to this */}
      <div className="relative w-full max-w-4xl">

      {/* Mouse cursor — tracks bottom-right corner of scaling modal */}
      {phase === "resize" && (
        <div
          className="absolute pointer-events-none z-[60] text-indigo-400/90"
          style={{
            left: `${scaleX * 100}%`,
            top: `${scaleY * 100}%`,
            transform: "translate(-4px, -4px)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M3 3 L3 19 L8 14 L13 21 L16 19.5 L11 13 L18 13 Z" />
          </svg>
        </div>
      )}

      <div
        className="w-full transition-opacity duration-300"
        style={{
          aspectRatio: "16 / 10",
          background: "linear-gradient(145deg, rgba(8, 12, 28, 0.98), rgba(4, 6, 18, 0.98))",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "0.5rem",
          boxShadow: "0 0 40px rgba(99, 102, 241, 0.12), 0 0 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
          opacity: closing ? 0 : opacity,
          overflow: "hidden",
        }}
      >
        {/* === Background layers === */}

        {/* Subtle grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.04 }}>
          <defs>
            <pattern id="desktop-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(129,140,248,1)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#desktop-grid)" />
        </svg>

        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(129,140,248,0.015) 2px, rgba(129,140,248,0.015) 4px)",
          }}
        />

        {/* Exploratorium shield — centered watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={backgroundLogo}
            alt=""
            className="select-none"
            style={{
              width: "45%",
              maxWidth: "320px",
              opacity: 0.1,
              filter: "grayscale(0.5) brightness(1.5)",
              maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 70%)",
            }}
          />
        </div>

        {/* HUD corner brackets */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t border-l border-indigo-500/30" />
        <div className="absolute top-2 right-2 w-6 h-6 border-t border-r border-indigo-500/30" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b border-l border-indigo-500/30" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b border-r border-indigo-500/30" />

        {/* Top edge HUD line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />
        {/* Bottom edge HUD line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Top bar — title bar style */}
        <div className="absolute top-0 inset-x-0 h-8 flex items-center px-4 border-b border-indigo-500/15"
          style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.08), transparent)" }}>
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/20" />
          </div>
          <span
            className="flex-1 text-center text-[8px] tracking-[0.4em] uppercase text-indigo-300/30"
            style={cinzel}
          >
            {terminalLabel ?? `${shipClass} — ${shipName} — Systems Terminal`}
          </span>
        </div>

        {/* Bottom status bar */}
        <div className="absolute bottom-0 inset-x-0 h-6 flex items-center justify-between px-4 border-t border-indigo-500/15"
          style={{ background: "linear-gradient(0deg, rgba(99,102,241,0.06), transparent)" }}>
          <span className="text-[7px] tracking-[0.3em] uppercase text-indigo-400/25" style={cinzel}>
            {statusLabel}
          </span>
          <span className="text-[7px] tracking-[0.2em] text-indigo-400/20 tabular-nums" style={cinzel}>
            {abilities.length} Systems Online
          </span>
        </div>

        {/* Side accent lines */}
        <div className="absolute left-0 top-8 bottom-6 w-px bg-gradient-to-b from-transparent via-indigo-500/15 to-transparent" />
        <div className="absolute right-0 top-8 bottom-6 w-px bg-gradient-to-b from-transparent via-indigo-500/15 to-transparent" />

        {/* (cursor rendered as sibling below) */}

        {/* === Content area (between title bar and status bar) === */}
        <div className={`absolute inset-x-0 top-8 bottom-6 flex flex-col ${children ? "items-start justify-start px-4 pt-2" : "items-center justify-center"}`}>

          {/* Header text — fades in after resize */}
          <div
            className="text-center mb-4 transition-all duration-500"
            style={{
              opacity: headerVisible ? 1 : 0,
              transform: headerVisible ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <p
              className="text-[9px] tracking-[0.5em] uppercase text-white/15 mb-1"
              style={cinzel}
            >
              {headerLabel}
            </p>
            <div className="w-24 h-px mx-auto bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
          </div>

          {/* Content — either custom children or ability hex icons */}
          {children ? (
            <div
              className="flex-1 flex items-start justify-start px-4 pt-2 transition-all duration-500"
              style={{
                opacity: headerVisible ? 1 : 0,
                transform: headerVisible ? "translateY(0)" : "translateY(8px)",
              }}
            >
              {children}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-20 gap-y-8 sm:gap-x-28 sm:gap-y-10">
              {abilities.map((ability, i) => {
                const visible = i < visibleIcons;
                return (
                  <button
                    key={ability.name}
                    onClick={() => visible && setSelectedAbility(ability)}
                    className="relative flex flex-col items-center gap-2 cursor-pointer group"
                    style={{
                      opacity: visible ? 1 : 0,
                      transform: visible ? "scale(1) translateY(0)" : "scale(0.5) translateY(10px)",
                      transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                    }}
                  >
                    {/* 3 tight concentric hex borders fading out */}
                    <div className="absolute z-[5] pointer-events-none" style={{ left: "50%", top: "38%", transform: "translate(-50%, -50%)" }}>
                      <svg viewBox="0 0 100 100" className="w-[calc(100%+10px)] h-[calc(100%+10px)] sm:w-[calc(100%+12px)] sm:h-[calc(100%+12px)]" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "90px", height: "90px" }}>
                        <path d="M50 -2 L96 24 L96 76 L50 102 L4 76 L4 24 Z" fill="none" stroke="rgba(129,140,248,0.18)" strokeWidth="0.7" />
                        <path d="M50 -5 L99 22 L99 78 L50 105 L1 78 L1 22 Z" fill="none" stroke="rgba(129,140,248,0.09)" strokeWidth="0.5" />
                        <path d="M50 -8 L102 20 L102 80 L50 108 L-2 80 L-2 20 Z" fill="none" stroke="rgba(129,140,248,0.04)" strokeWidth="0.4" />
                      </svg>
                    </div>

                    {/* Hex chip */}
                    <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20">
                      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(129,140,248,0.2)]">
                        <path
                          d={HEX_PATH}
                          fill="rgba(129, 140, 248, 0.06)"
                          stroke="rgba(129, 140, 248, 0.35)"
                          strokeWidth="1.5"
                          className="group-hover:fill-[rgba(129,140,248,0.15)] group-hover:stroke-[rgba(129,140,248,0.5)] transition-all"
                        />
                        <g className="text-indigo-400/70">
                          {ABILITY_ICONS[ability.name] ?? (
                            <text x="50" y="55" textAnchor="middle" fill="currentColor" fontSize="28" fillOpacity="0.5">
                              {ability.name[0]}
                            </text>
                          )}
                        </g>
                      </svg>
                    </div>

                    {/* Label */}
                    <span
                      className="relative z-10 text-[8px] sm:text-[9px] tracking-[0.12em] uppercase text-white/40 group-hover:text-white/65 text-center leading-tight transition-colors"
                      style={cinzel}
                    >
                      {ability.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-1 right-1.5 z-10 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      </div>{/* end wrapper */}

      {/* Ability detail sub-modal */}
      {!children && selectedAbility && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-4"
          onClick={() => setSelectedAbility(null)}
        >
          <div
            className="relative max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(10, 10, 30, 0.92)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "0.5rem",
              boxShadow: "0 0 30px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              animation: "abilityFadeIn 0.25s ease-out",
            }}
          >
            <style>{`@keyframes abilityFadeIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

            {/* Top gradient edge line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
            {/* Bottom gradient edge line */}
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

            {/* Corner L-brackets */}
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

            <div className="p-6 flex flex-col items-center text-center gap-4">
              {/* Icon */}
              <div className="w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path
                    d={HEX_PATH}
                    fill="rgba(129, 140, 248, 0.1)"
                    stroke="rgba(129, 140, 248, 0.4)"
                    strokeWidth="1.5"
                  />
                  <g className="text-indigo-400">
                    {ABILITY_ICONS[selectedAbility.name] ?? (
                      <text x="50" y="55" textAnchor="middle" fill="currentColor" fontSize="28" fillOpacity="0.6">
                        {selectedAbility.name[0]}
                      </text>
                    )}
                  </g>
                </svg>
              </div>

              {/* Name */}
              <h2
                className="text-xl font-semibold text-white/90 tracking-wide"
                style={cinzel}
              >
                {selectedAbility.name}
              </h2>

              {/* Divider with center tick */}
              <div className="relative w-full">
                <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                  <div className="w-2 h-px bg-indigo-400/40" />
                  <div className="w-[3px] h-[3px] rotate-45 bg-indigo-400/50" />
                  <div className="w-2 h-px bg-indigo-400/40" />
                </div>
              </div>

              {/* Description */}
              <p className="text-white/60 text-sm leading-relaxed">
                {selectedAbility.description}
              </p>
            </div>

            {/* Close */}
            <button
              onClick={() => setSelectedAbility(null)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

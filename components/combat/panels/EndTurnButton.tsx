"use client";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

interface EndTurnButtonProps {
  enabled: boolean;
  // Only used when disabled — hint at why (different per phase + role).
  disabledReason?: string;
  onClick: () => void;
}

// Bottom-center End Turn button. Always rendered while combat is active;
// enabled state depends on phase + role + edit-mode focus trap (Phase 7+).
export default function EndTurnButton({ enabled, disabledReason, onClick }: EndTurnButtonProps) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
      title={!enabled && disabledReason ? disabledReason : undefined}
    >
      <button
        type="button"
        disabled={!enabled}
        onClick={onClick}
        className={`px-6 py-2.5 rounded-lg border text-[10px] tracking-[0.4em] uppercase transition-all ${
          enabled
            ? "border-amber-300/40 text-amber-200/80 hover:text-amber-200 hover:border-amber-300/70 hover:bg-amber-300/10 cursor-pointer"
            : "border-white/8 text-white/20 cursor-not-allowed"
        }`}
        style={cinzel}
      >
        End Turn
      </button>
    </div>
  );
}

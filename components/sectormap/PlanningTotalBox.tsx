"use client";

import { PLANNING_COLOR, totalDistance, formatTravelTime, type Waypoint } from "@/lib/planningMode";

interface PlanningTotalBoxProps {
  waypoints: Waypoint[];
  onExit: () => void;
}

/** Red-400 — communicates "destructive / exit action" clearly against the sky-blue planning theme */
const EXIT_COLOR = "#f87171";

/**
 * Always-visible planning mode status bar — positioned bottom-center to avoid
 * conflicting with the "← Sector" back button (top-left) when zoomed into a system.
 *
 * Layout: [ROUTE PLANNER label] | [stats or hint] | [EXIT button]
 *
 * NOTE: outer wrapper is pointer-events-none; inner card re-enables pointer-events
 * so the exit button is clickable without the wrapper eating map interactions.
 */
export function PlanningTotalBox({ waypoints, onExit }: PlanningTotalBoxProps) {
  const c = PLANNING_COLOR; // "#7dd3fc"
  const hasRoute = waypoints.length >= 2;
  const dist = totalDistance(waypoints);

  return (
    // role="status" + aria-live announces mode entry and route changes to screen readers (WCAG 4.1.3)
    <div
      className="absolute bottom-4 left-0 right-0 flex justify-center z-10 select-none pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Planning mode status"
    >
      <div
        className="pointer-events-auto relative flex items-center gap-0"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${c}30`,
          borderRadius: 10,
          boxShadow: `0 0 20px ${c}12, 0 4px 24px rgba(0,0,0,0.5)`,
          fontFamily: "var(--font-cinzel), serif",
          overflow: "hidden",
        }}
      >
        {/* Top edge glow line */}
        <div
          className="absolute top-0 left-6 right-6 h-px pointer-events-none"
          style={{ background: c, opacity: 0.2 }}
        />
        {/* Decorative corner dots */}
        <div className="absolute top-1.5 left-1.5 rounded-full pointer-events-none" style={{ width: 3, height: 3, background: c, opacity: 0.4 }} />
        <div className="absolute top-1.5 right-1.5 rounded-full pointer-events-none" style={{ width: 3, height: 3, background: c, opacity: 0.4 }} />

        {/* ── Label ── */}
        <div
          className="pointer-events-none flex items-center px-5"
          style={{ alignSelf: "stretch", borderRight: `1px solid ${c}20` }}
        >
          <span
            style={{
              color: c,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            Route Planner
          </span>
        </div>

        {/* ── Content: route stats or hint ── */}
        {hasRoute ? (
          <div
            className="flex items-baseline gap-3 px-5 pointer-events-none"
            style={{ padding: "10px 20px" }}
          >
            {/* Travel time — primary, large */}
            <span
              style={{
                color: c,
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1,
                textShadow: `0 0 16px ${c}55`,
              }}
            >
              {formatTravelTime(dist)}
            </span>
            {/* Distance — secondary, muted */}
            <span
              style={{
                color: c,
                fontSize: 13,
                fontWeight: 500,
                opacity: 0.4,
                fontFamily: "var(--font-geist-sans), sans-serif",
              }}
            >
              &Sigma;&nbsp;{dist}u
            </span>
          </div>
        ) : (
          <div
            className="pointer-events-none"
            style={{
              color: c,
              fontSize: 11,
              opacity: 0.35,
              fontFamily: "var(--font-geist-sans), sans-serif",
              padding: "14px 20px",
            }}
          >
            <span className="hidden md:inline">Click</span>
            <span className="inline md:hidden">Tap</span>
            {" "}to place waypoints
          </div>
        )}

        {/* ── EXIT button — prominent, clearly destructive ── */}
        {/*
         * min-height 44px satisfies WCAG 2.5.5 (44×44 touch target).
         * Padding set via style to guarantee the height without Tailwind arbitrary values.
         * cursor-pointer per ui-ux-pro-max touch guidelines.
         */}
        <button
          onClick={onExit}
          aria-label="Exit planning mode (or press Escape)"
          title="Exit planning mode (Esc)"
          className="flex items-center gap-2 cursor-pointer transition-all duration-150
            focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-offset-[-2px]"
          style={{
            color: EXIT_COLOR,
            background: `${EXIT_COLOR}1a`,
            borderLeft: `1px solid ${EXIT_COLOR}45`,
            borderRight: "none",
            borderTop: "none",
            borderBottom: "none",
            fontFamily: "var(--font-cinzel), serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            minHeight: 44,
            padding: "0 20px",
            outlineColor: `${EXIT_COLOR}99`,
            textTransform: "uppercase",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.background = `${EXIT_COLOR}2e`;
            el.style.color = EXIT_COLOR;
            el.style.boxShadow = `inset 0 0 16px ${EXIT_COLOR}20`;
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.background = `${EXIT_COLOR}1a`;
            el.style.color = EXIT_COLOR;
            el.style.boxShadow = "none";
          }}
        >
          {/* × glyph — larger, sans-serif for legibility */}
          <span style={{ fontSize: 20, lineHeight: 1, fontFamily: "sans-serif", opacity: 0.85 }}>&times;</span>
          <span>Exit</span>
        </button>

        {/* Screen-reader hint for Escape key discoverability */}
        <span className="sr-only">Press Escape to exit planning mode.</span>
      </div>
    </div>
  );
}

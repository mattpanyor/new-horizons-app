"use client";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

/** "standings", or `vip:<slug>` for a VIP tab. */
export type TrackerTab = string;

export interface TabSpec {
  id: TrackerTab;
  title: string;
  /** Tints the indicator and the status diamond. A VIP's follows their tier. */
  accent: string;
  /** Pulses the diamond — this register needs attention. */
  alarm?: boolean;
  /**
   * Marks a register hidden from lower access levels. Rendered grey and
   * padlocked, so a GM sharing their screen can see at a glance which tab the
   * players are not meant to be looking at.
   */
  restricted?: boolean;
}

interface Props {
  tabs: TabSpec[];
  active: TrackerTab;
  onSelect: (tab: TrackerTab) => void;
}

const RESTRICTED_ACCENT = "#94a3b8";

/** Chamfered blade: top-left and bottom-right corners cut. */
const BLADE =
  "polygon(11px 0, 100% 0, 100% calc(100% - 11px), calc(100% - 11px) 100%, 0 100%, 0 11px)";

/**
 * The page's registers as chamfered HUD blades.
 *
 * Between the two shapes this went through: the tall boxed segments carried too
 * much weight above the glass panels, and a bare underline rail carried too
 * little to read as controls. A blade has an edge and a fill, so it is
 * obviously pressable, but it is one line tall instead of three.
 *
 * The status diamond carries each register's tier colour, so a failing subject
 * is visible from the tab you are not on without spelling it out.
 */
export default function TrackerTabs({ tabs, active, onSelect }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Campaign registers"
      className="flex justify-start sm:justify-center gap-2 overflow-x-auto scifi-scroll pb-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        // A restricted register stays grey even when selected — grey is the
        // signal, so it must not be spent on the active state as well.
        const accent = tab.restricted ? RESTRICTED_ACCENT : tab.accent;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            className="group relative shrink-0 px-5 sm:px-7 py-3 outline-none transition-transform duration-300"
            style={{ clipPath: BLADE }}
          >
            {/* Edge — a filled shape one pixel larger than the face */}
            <span
              className="absolute inset-0 transition-colors duration-300"
              style={{
                clipPath: BLADE,
                background: isActive ? `${accent}66` : "rgba(255,255,255,0.09)",
              }}
              aria-hidden
            />
            {/* Face */}
            <span
              className="absolute inset-[1px] transition-colors duration-300"
              style={{
                clipPath: BLADE,
                background: isActive
                  ? `linear-gradient(to bottom, ${accent}26, rgba(2,6,23,0.85))`
                  : "rgba(2,6,23,0.6)",
              }}
              aria-hidden
            />
            {/* Lit base on the active blade */}
            <span
              className="pointer-events-none absolute bottom-0 left-0 right-[11px] h-px transition-opacity duration-300"
              style={{ background: accent, boxShadow: `0 0 9px ${accent}`, opacity: isActive ? 1 : 0 }}
              aria-hidden
            />

            <span className="relative flex items-center gap-2.5 whitespace-nowrap">
              <span
                className={`w-[5px] h-[5px] rotate-45 shrink-0 transition-all duration-500 ${
                  tab.alarm ? "combat-status-pulse" : ""
                }`}
                style={{
                  background: isActive ? accent : "transparent",
                  border: `1px solid ${accent}`,
                  opacity: isActive ? 1 : 0.5,
                  boxShadow: isActive ? `0 0 8px ${accent}` : "none",
                }}
                aria-hidden
              />

              <span
                className={`text-[10px] sm:text-[11px] tracking-[0.24em] sm:tracking-[0.28em] uppercase transition-colors duration-300 ${
                  isActive
                    ? "text-white/90"
                    : "text-white/35 group-hover:text-white/70 group-focus-visible:text-white/70"
                }`}
                style={cinzel}
              >
                {tab.title}
              </span>

              {tab.restricted && (
                <svg
                  width="9" height="9" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.2"
                  className="shrink-0 transition-opacity duration-300"
                  style={{ color: RESTRICTED_ACCENT, opacity: isActive ? 0.85 : 0.45 }}
                  aria-label="Restricted"
                >
                  <rect x="4" y="11" width="16" height="10" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

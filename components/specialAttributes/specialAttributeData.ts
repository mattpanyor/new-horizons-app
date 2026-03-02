// Special attribute metadata — shared between map icons and tooltip cards.
// Each entry defines the visual styling (colors, glow) and description label.

export interface SpecialAttributeDef {
  label: string;
  color: string;       // primary icon/text color
  glowColor: string;   // drop-shadow glow color
  /** Fill color for SVG map icon (some use "none") */
  iconFill: string;
  /** Stroke color for SVG map icon */
  iconStroke: string;
}

export const SPECIAL_ATTRIBUTES: Record<string, SpecialAttributeDef> = {
  lathanium: {
    label: "Lathanium resource available",
    color: "#93C5FD",
    glowColor: "#3B82F6",
    iconFill: "#1D4ED8",
    iconStroke: "#93C5FD",
  },
  nobility: {
    label: "Restricted to nobility only",
    color: "#FDE047",
    glowColor: "#FDE047",
    iconFill: "none",
    iconStroke: "#FDE047",
  },
  purified: {
    label: "This location was purified",
    color: "rgba(255,255,255,0.85)",
    glowColor: "#FFFFFF",
    iconFill: "none",
    iconStroke: "white",
  },
  lightbringer: {
    label: "Lightbringer presence on planet",
    color: "#FFE87A",
    glowColor: "#FFE87A",
    iconFill: "#FFE87A",
    iconStroke: "#FFE87A",
  },
  cult: {
    label: "Cultist activity detected",
    color: "#B91C1C",
    glowColor: "#B91C1C",
    iconFill: "none",
    iconStroke: "#B91C1C",
  },
  alien_int: {
    label: "Alien intelligence",
    color: "#8B5CF6",
    glowColor: "#8B5CF6",
    iconFill: "none",
    iconStroke: "#8B5CF6",
  },
};

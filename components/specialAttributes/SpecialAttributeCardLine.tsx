// HTML tooltip description line for special attributes — rendered inside body info cards.

import { SPECIAL_ATTRIBUTES } from "./specialAttributeData";

export function SpecialAttributeCardLine({ type }: { type: string | undefined }) {
  if (!type) return null;

  const attr = SPECIAL_ATTRIBUTES[type];
  if (!attr) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <SpecialAttributeCardIcon type={type} />
      <span style={{ color: attr.color, fontSize: "9px", letterSpacing: "0.05em" }}>{attr.label}</span>
    </div>
  );
}

/** Tiny inline icon for tooltip cards — HTML/SVG hybrid */
function SpecialAttributeCardIcon({ type }: { type: string }) {
  switch (type) {
    case "lathanium":
      return (
        <span style={{ display: "inline-block", width: "7px", height: "7px", background: "#1D4ED8", transform: "rotate(45deg)", boxShadow: "0 0 4px #3B82F6", flexShrink: 0 }} />
      );
    case "nobility":
      return (
        <svg width="9" height="9" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
          <polygon points="0,1 10,1 5,9" fill="none" stroke="#FDE047" strokeWidth="1.5" />
        </svg>
      );
    case "purified":
      return (
        <svg width="9" height="12" viewBox="-6 -6 12 14" style={{ flexShrink: 0 }}>
          <path d="M 0,-5 L 4,0 L 2,3 L -2,3 L -4,0 Z M 2,3 L 4,7 M -2,3 L -4,7"
            fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 2px #FFFFFF)" }} />
        </svg>
      );
    case "lightbringer":
      return (
        <svg width="9" height="9" viewBox="-6 -6 12 12" style={{ flexShrink: 0 }}>
          <polygon points="5,0 1.4,1.4 0,5 -1.4,1.4 -5,0 -1.4,-1.4 0,-5 1.4,-1.4"
            fill="#FFE87A" stroke="#FFE87A" strokeWidth="0.3"
            style={{ filter: "drop-shadow(0 0 2px #FFE87A)" }} />
        </svg>
      );
    case "cult":
      return (
        <svg width="9" height="9" viewBox="-7 -7 14 14" style={{ flexShrink: 0 }}>
          <path d="M -6,-6 L -6,6 M 6,-6 L 6,6 M -6,-6 L 6,6 M 6,-6 L -6,6"
            fill="none" stroke="#B91C1C" strokeWidth="1.5" strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 2px #B91C1C)" }} />
        </svg>
      );
    case "alien_int":
      return (
        <svg width="12" height="7" viewBox="-9 -5 18 10" style={{ flexShrink: 0 }}>
          <polygon points="-8,0 0,-4 8,0 0,4"
            fill="none" stroke="#8B5CF6" strokeWidth="1"
            style={{ filter: "drop-shadow(0 0 2px #8B5CF6)" }} />
        </svg>
      );
    default:
      return null;
  }
}

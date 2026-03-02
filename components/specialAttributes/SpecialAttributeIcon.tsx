// SVG map icon for special attributes — rendered next to bodies on the sector map.

import { SPECIAL_ATTRIBUTES } from "./specialAttributeData";

interface SpecialAttributeIconProps {
  type: string | undefined;
  posX: number;
  posY: number;
  labelR: number;
}

export function SpecialAttributeIcon({ type, posX, posY, labelR }: SpecialAttributeIconProps) {
  if (!type) return null;

  const attr = SPECIAL_ATTRIBUTES[type];
  if (!attr) return null;

  const dx = posX + labelR * 0.85;
  const dy = posY - labelR * 0.85;
  const glowStyle = { filter: `drop-shadow(0 0 6px ${attr.glowColor})` };

  switch (type) {
    case "lathanium": {
      const s = 6;
      return (
        <polygon
          points={`${dx},${dy - s} ${dx + s},${dy} ${dx},${dy + s} ${dx - s},${dy}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2"
          style={glowStyle} />
      );
    }
    case "nobility": {
      const s = 6;
      return (
        <polygon
          points={`${dx - s},${dy - s * 0.6} ${dx + s},${dy - s * 0.6} ${dx},${dy + s * 0.8}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2"
          style={glowStyle} />
      );
    }
    case "purified":
      return (
        <path
          d={`M ${dx} ${dy - 5} L ${dx + 4} ${dy} L ${dx + 2} ${dy + 3} L ${dx - 2} ${dy + 3} L ${dx - 4} ${dy} Z M ${dx + 2} ${dy + 3} L ${dx + 4} ${dy + 7} M ${dx - 2} ${dy + 3} L ${dx - 4} ${dy + 7}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2" strokeLinecap="round"
          style={glowStyle} />
      );
    case "lightbringer": {
      const o = 6, i = 2.4;
      return (
        <polygon
          points={`${dx + o},${dy} ${dx + i},${dy + i} ${dx},${dy + o} ${dx - i},${dy + i} ${dx - o},${dy} ${dx - i},${dy - i} ${dx},${dy - o} ${dx + i},${dy - i}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2"
          style={glowStyle} />
      );
    }
    case "cult":
      return (
        <path
          d={`M ${dx - 6} ${dy - 6} L ${dx - 6} ${dy + 6} M ${dx + 6} ${dy - 6} L ${dx + 6} ${dy + 6} M ${dx - 6} ${dy - 6} L ${dx + 6} ${dy + 6} M ${dx + 6} ${dy - 6} L ${dx - 6} ${dy + 6}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2" strokeLinecap="round"
          style={glowStyle} />
      );
    case "alien_int":
      return (
        <polygon
          points={`${dx - 8},${dy} ${dx},${dy - 4} ${dx + 8},${dy} ${dx},${dy + 4}`}
          fill={attr.iconFill} stroke={attr.iconStroke} strokeWidth="2"
          style={glowStyle} />
      );
    default:
      return null;
  }
}

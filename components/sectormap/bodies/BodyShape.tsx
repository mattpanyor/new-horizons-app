// SVG shape per body type: circle (planet/moon), diamond (station),
// triangle (ship), fleet formation, asteroid dot cluster + highlight ring.

import { tri, triLeft, asteroidDots } from "@/lib/sectorMapHelpers";
import { FLEET_SHIPS } from "@/lib/sectorMapHelpers";

interface BodyShapeProps {
  bodyId: string;
  bodyType: string;
  posX: number;
  posY: number;
  pinSlug: string;
  bodyColor: string;
  isBodyActive: boolean;
  isActive: boolean;
}

export function BodyShape({
  bodyId, bodyType, posX, posY, pinSlug,
  bodyColor, isBodyActive, isActive,
}: BodyShapeProps) {
  const fillId = `url(#body-${pinSlug}-${bodyId})`;
  const activeStroke = isBodyActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)";
  const glowStyle = isBodyActive ? { filter: `drop-shadow(0 0 8px ${bodyColor})` } : undefined;

  const labelR =
    bodyType === "fleet" ? 22 :
      bodyType === "asteroid-field" ? 32 :
        bodyType === "station" ? 10 : 12;
  const highlightR = labelR + 6;

  return (
    <>
      {/* Pulsing highlight ring for active body */}
      {isBodyActive && (
        <circle cx={posX} cy={posY} r={highlightR}
          fill="none" stroke={bodyColor} strokeWidth="1.5" strokeOpacity="0.6"
          style={{ filter: `drop-shadow(0 0 6px ${bodyColor})` }}>
          <animate attributeName="r" values={`${highlightR};${highlightR + 4};${highlightR}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {bodyType === "station" && (
        <polygon
          points={`${posX},${posY - 10} ${posX + 9},${posY} ${posX},${posY + 10} ${posX - 9},${posY}`}
          fill={fillId}
          stroke={isBodyActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)"}
          strokeWidth={isBodyActive ? "2" : "1"} style={glowStyle}
        />
      )}

      {bodyType === "ship" && (
        <polygon points={tri(posX, posY, 10)}
          fill={fillId} stroke={activeStroke}
          strokeWidth={isBodyActive ? "2" : "0.8"} style={glowStyle} />
      )}

      {bodyType === "fleet" && (
        <g style={glowStyle}>
          {FLEET_SHIPS.map(({ dx, dy, r }, i) => (
            <polygon key={i} points={triLeft(posX + dx, posY + dy, r)}
              fill="url(#fleetGrad)" fillOpacity={0.9}
              stroke={activeStroke}
              strokeWidth={isBodyActive ? "1.5" : "0.6"} />
          ))}
        </g>
      )}

      {bodyType === "asteroid-field" && (
        <g style={glowStyle}>
          {asteroidDots(bodyId).map((d, i) => (
            <circle key={i} cx={posX + d.x} cy={posY + d.y} r={d.r}
              fill={bodyColor} fillOpacity={0.55 + (i % 5) * 0.08} />
          ))}
        </g>
      )}

      {bodyType !== "station" && bodyType !== "ship" && bodyType !== "fleet" && bodyType !== "asteroid-field" && (
        <circle cx={posX} cy={posY} r={12}
          fill={fillId} stroke={activeStroke}
          strokeWidth={isBodyActive ? "2" : "0.5"} style={glowStyle} />
      )}
    </>
  );
}

/** Get the label offset radius for a body type */
export function bodyLabelR(bodyType: string): number {
  return bodyType === "fleet" ? 22 :
    bodyType === "asteroid-field" ? 32 :
      bodyType === "station" ? 10 : 12;
}

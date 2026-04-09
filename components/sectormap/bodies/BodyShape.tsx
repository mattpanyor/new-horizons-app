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
  sectorSlug: string;
  bodyColor: string;
  isBodyActive: boolean;
  isActive: boolean;
}

export function BodyShape({
  bodyId, bodyType, posX, posY, pinSlug, sectorSlug,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
              fill={`url(#fleetGrad-${sectorSlug})`} fillOpacity={0.9}
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

      {bodyType === "black-hole" && (
        <g style={glowStyle}>
          <defs>
            <radialGradient id={`bh-lensing-${bodyId}`}>
              <stop offset="0%" stopColor={bodyColor} stopOpacity="0" />
              <stop offset="60%" stopColor={bodyColor} stopOpacity="0" />
              <stop offset="80%" stopColor={bodyColor} stopOpacity="0.35" />
              <stop offset="90%" stopColor="white" stopOpacity="0.15" />
              <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`bh-disk-${bodyId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={bodyColor} stopOpacity="0" />
              <stop offset="20%" stopColor={bodyColor} stopOpacity="0.6" />
              <stop offset="50%" stopColor="white" stopOpacity="0.4" />
              <stop offset="80%" stopColor={bodyColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={bodyColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gravitational lensing glow */}
          <circle cx={posX} cy={posY} r={22} fill={`url(#bh-lensing-${bodyId})`}>
            <animate attributeName="opacity" values="0.8;1;0.8" dur="4s" repeatCount="indefinite" />
          </circle>

          {/* Back accretion disk */}
          <g transform={`translate(${posX},${posY}) rotate(-20)`}>
            <ellipse cx={0} cy={0} rx={35} ry={5}
              fill={`url(#bh-disk-${bodyId})`} opacity="0.5">
              <animate attributeName="opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx={0} cy={0} rx={35} ry={5}
              fill="none" stroke={bodyColor} strokeWidth={0.8} opacity="0.3" />
          </g>

          {/* Event horizon — pure void */}
          <circle cx={posX} cy={posY} r={12} fill="#000000" />

          {/* Photon ring */}
          <circle cx={posX} cy={posY} r={13} fill="none"
            stroke="white" strokeWidth={0.6} opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={posX} cy={posY} r={14} fill="none"
            stroke={bodyColor} strokeWidth={1} opacity="0.4">
            <animate attributeName="opacity" values="0.25;0.5;0.25" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Front accretion disk arc */}
          <g transform={`translate(${posX},${posY}) rotate(-20)`}>
            <clipPath id={`bh-front-${bodyId}`}>
              <rect x={-40} y={0} width={80} height={10} />
            </clipPath>
            <ellipse cx={0} cy={0} rx={30} ry={4.5}
              fill={`url(#bh-disk-${bodyId})`} opacity="0.7"
              clipPath={`url(#bh-front-${bodyId})`}>
              <animate attributeName="opacity" values="0.5;0.8;0.5" dur="3s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* Lensed light arc at top */}
          <path d={`M ${posX - 15},${posY - 4} A 15,15 0 0,1 ${posX + 15},${posY - 4}`}
            fill="none" stroke={bodyColor} strokeWidth={2} opacity="0.25">
            <animate attributeName="opacity" values="0.15;0.35;0.15" dur="3s" repeatCount="indefinite" />
          </path>
        </g>
      )}

      {bodyType !== "station" && bodyType !== "ship" && bodyType !== "fleet" && bodyType !== "asteroid-field" && bodyType !== "black-hole" && (
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
      bodyType === "black-hole" ? 18 :
        bodyType === "station" ? 10 : 12;
}

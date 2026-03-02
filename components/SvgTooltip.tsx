"use client";

import type { ReactNode } from "react";

/** Viewport bounds in SVG coordinate space */
export interface SvgViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SvgTooltipProps {
  /** Anchor point in local (parent group) coordinate space */
  anchorX: number;
  anchorY: number;
  /** Card dimensions in local coordinate space */
  cardW: number;
  cardH: number;
  /** Accent color for connector, caret, and border */
  color: string;
  /** Distance from anchor center to card edge (avoids overlapping the anchor shape) */
  clearance: number;
  /** Current SVG viewBox for boundary detection */
  viewBox: SvgViewBox;
  /** Parent group offset in SVG space (e.g. pin.x, pin.y) */
  parentOffsetX: number;
  parentOffsetY: number;
  /** Scale factor of parent group (local coords * scale = SVG coords) */
  scale: number;
  /** Hover handlers for anti-flicker */
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Card content (rendered inside foreignObject) */
  children: ReactNode;
}

/**
 * Reusable SVG tooltip with viewport-aware positioning, connector line,
 * directional caret, and anti-flicker hit zones.
 *
 * Renders inside a parent `<g>` that has a transform (translate + scale).
 * All anchor/card coordinates are in the parent group's local space.
 */
export function SvgTooltip({
  anchorX,
  anchorY,
  cardW,
  cardH,
  color,
  clearance,
  viewBox: vb,
  parentOffsetX,
  parentOffsetY,
  scale,
  onMouseEnter,
  onMouseLeave,
  children,
}: SvgTooltipProps) {
  // --- Vertical flip detection ---
  // Convert anchor to SVG space to compare with viewBox top edge
  const svgAnchorY = parentOffsetY + anchorY * scale;
  const cardHSvg = cardH * scale;
  const flipped = (svgAnchorY - cardHSvg - clearance * scale) < vb.y;

  const cardY = flipped
    ? anchorY + clearance
    : anchorY - cardH - clearance;

  // --- Horizontal clamping ---
  const localVbLeft = (vb.x - parentOffsetX) / scale;
  const localVbRight = (vb.x + vb.w - parentOffsetX) / scale;
  const rawCardX = anchorX - cardW / 2;
  const cardX = Math.max(localVbLeft + 4, Math.min(rawCardX, localVbRight - cardW - 4));

  // --- Connector line endpoints ---
  const stemEndX = cardX + cardW / 2;
  const stemEndY = flipped ? cardY : cardY + cardH;

  // --- Caret geometry ---
  const caretTipY = flipped ? cardY - 6 : cardY + cardH + 6;
  const caretBaseY = flipped ? cardY : cardY + cardH;
  const caretCx = cardX + cardW / 2;

  // --- Accent border side ---
  const accentBorder = flipped
    ? { borderTop: `2px solid ${color}80` }
    : { borderBottom: `2px solid ${color}80` };

  return (
    <>
      {/* Connector line from anchor to card edge */}
      <line
        x1={anchorX} y1={anchorY}
        x2={stemEndX} y2={stemEndY}
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.35}
        strokeDasharray="4 4"
        pointerEvents="none"
      />

      {/* Caret pointing toward the anchor */}
      <polygon
        points={`${caretCx - 5},${caretBaseY} ${caretCx + 5},${caretBaseY} ${caretCx},${caretTipY}`}
        fill={color}
        fillOpacity={0.45}
        pointerEvents="none"
      />

      {/* Card content via foreignObject */}
      <foreignObject
        x={cardX} y={cardY}
        width={cardW} height={cardH}
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          background: "rgba(10,10,30,0.92)",
          border: `1px solid ${color}40`,
          borderRadius: "6px",
          padding: "8px 10px",
          fontFamily: "var(--font-cinzel), serif",
          width: `${cardW}px`,
          boxSizing: "border-box",
          boxShadow: `0 0 20px ${color}30`,
          ...accentBorder,
        }}>
          {children}
        </div>
      </foreignObject>

      {/* Single hit group wrapping all rects — mouse moving between children
           won't fire leave/enter on the parent, preventing edge flicker */}
      <g onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {/* Bridge rect: covers gap between anchor and card, full card width */}
        <rect
          x={cardX}
          y={flipped ? anchorY : cardY + cardH}
          width={cardW}
          height={flipped ? Math.max(0, cardY - anchorY) : Math.max(0, anchorY - (cardY + cardH))}
          fill="transparent"
          pointerEvents="all"
        />
        {/* Card overlay rect: matches foreignObject bounds exactly */}
        <rect
          x={cardX} y={cardY}
          width={cardW} height={cardH}
          fill="transparent"
          pointerEvents="all"
        />
      </g>
    </>
  );
}

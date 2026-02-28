---
title: "fix: Planet hover detection unreliable in SectorMap"
type: fix
date: 2026-02-28
---

# fix: Planet hover detection unreliable in SectorMap

## Enhancement Summary

**Deepened on:** 2026-02-28
**Sections enhanced:** 3 (Root Cause, Changes, Implementation)
**Research sources:** MDN SVG pointer-events, W3C SVG 2 spec, Smashing Magazine SVG interaction guide, Context7 React docs, GitNexus codebase analysis, claude-mem session history

### Key Improvements
1. Bridge rect pattern to eliminate gap between body and info card
2. Dynamic foreignObject height to fix mouse event clipping
3. Increased hit area with pointer-events attribute for reliable detection

### New Considerations Discovered
- SVG foreignObject mouse events are strictly clipped to declared width/height — `overflow: visible` only affects rendering, NOT hit-testing
- `pointer-events: auto` on SVG elements with `fill="transparent"` requires explicit setting since transparent fill is "painted" but may not receive events in all browsers

## Overview

Planet hover detection in the SectorMap is intermittently failing. Users report that hovering over planets sometimes doesn't trigger the info card, and the info card can vanish when trying to interact with it.

## Problem Statement

When a star system is active (zoomed in), celestial bodies have hover/click interactions that show an info card. These interactions are unreliable due to several SVG coordinate space and event propagation issues.

## Root Cause Analysis

### Issue 1: Hit area in scaled coordinate space
The body `<g>` group is inside a `scale(0.28)` transform (line 622). The hit circle at `r={56}` has an effective SVG-space radius of `56 * 0.28 = ~15.7px`. At lower zoom levels or on touch devices, this is too small.

**File:** `components/SectorMap.tsx:622,676-678`

#### Research Insights

Per the [MDN SVG pointer-events docs](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pointer-events), the default `pointer-events: auto` means only "painted and visible" areas receive events. A `fill="transparent"` circle IS painted (transparent is a color), but some browsers treat it inconsistently. Setting `pointer-events="all"` on the hit circle guarantees events fire regardless of fill/stroke visibility.

The [SVG 2 spec](https://svgwg.org/svg2-draft/interact.html) also defines `bounding-box` value where the rectangular bounds receive events — useful for group-level hit testing.

### Issue 2: foreignObject gap problem
The info card (`foreignObject`) is positioned at `y={pos.y - 130}` — 130 units above the body in the scaled space. When the mouse moves from body to card, it crosses empty SVG space. The body's `onMouseLeave` fires immediately, starting the 700ms hide timer. If the user moves slowly or the pointer path misses the `foreignObject`, the card disappears.

**File:** `components/SectorMap.tsx:778-780,672,395-397`

#### Research Insights

The standard pattern for bridging hover gaps in SVG is an invisible `<rect>` spanning from the trigger element to the tooltip/card. This rect catches mouse events in the gap zone, preventing `onMouseLeave` from firing on the body before the cursor reaches the card. [Smashing Magazine's SVG interaction guide](https://www.smashingmagazine.com/2018/05/svg-interaction-pointer-events-property/) documents this pattern.

### Issue 3: foreignObject dimension overflow
The `foreignObject` has fixed dimensions `width={200} height={130}` with `overflow: visible`. When card content is tall (lathanium + nobility + Kanka link), the visible content overflows the declared bounds. Some browsers don't dispatch mouse events outside the declared `foreignObject` dimensions.

**File:** `components/SectorMap.tsx:778-781`

#### Research Insights

Per the [W3C SVG 2 spec](https://svgwg.org/svg2-draft/interact.html): "For `foreignObject` elements, hit-testing is performed on the rectangular area (the object bounding box)." This confirms that mouse events ONLY fire within the declared width/height, regardless of `overflow: visible`. The fix must ensure the foreignObject dimensions fully contain all rendered content.

## Changes

### Phase 1: Increase effective hit area

- [x] **Increase hit circle radius**: Bump from `r={56}` to `r={80}` — effective ~22px in SVG space at `scale(0.28)`
- [x] **Set `pointerEvents="all"`** on the hit circle to ensure events fire on transparent fill

```tsx
// components/SectorMap.tsx — inside body <g>, around line 676
{isActive && (
  <circle cx={pos.x} cy={pos.y} r={80} fill="transparent" pointerEvents="all" />
)}
```

### Phase 2: Fix foreignObject sizing

- [x] **Dynamically calculate foreignObject height** based on content flags:
  - Base: 90px (name + type line)
  - +24px if `body.lathanium`
  - +24px if `body.nobility`
  - +36px if `body.kankaUrl`
  - +10px padding

```tsx
// components/SectorMap.tsx — inside body rendering, around line 778
const cardH = 90
  + (body.lathanium ? 24 : 0)
  + (body.nobility ? 24 : 0)
  + (body.kankaUrl ? 36 : 0)
  + 10;

<foreignObject
  x={pos.x - 110} y={pos.y - cardH - 10}
  width={220} height={cardH}
  ...
>
```

### Phase 3: Bridge the gap between body and card

- [x] **Add invisible bridge rect** connecting body hit area to the info card area, with hover handlers that cancel/schedule hide

```tsx
// components/SectorMap.tsx — inside isBodyActive block, before foreignObject
{isBodyActive && (
  <rect
    x={pos.x - 110}
    y={pos.y - cardH - 10}
    width={220}
    height={cardH + 10 + 80}  // card height + gap + body radius
    fill="transparent"
    pointerEvents="all"
    onMouseEnter={cancelHide}
    onMouseLeave={scheduleHide}
  />
)}
```

- [x] **Bump scheduleHide timeout** from 700ms to 900ms

### Phase 4: Verify

- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [x] Manual test: hover over each body type (planet, station, ship, fleet, asteroid field)
- [x] Manual test: move mouse from body to info card without card disappearing
- [x] Manual test: card with lathanium + nobility + Kanka link fully interactive

## Acceptance Criteria

- [x] Planet hover reliably triggers info card on first attempt
- [x] Info card stays visible when moving mouse from body to card
- [x] Info card fully clickable (Kanka link works) even with all optional sections shown
- [x] No regression in click-to-focus or auto-select behavior
- [x] TypeScript compiles cleanly

## References

- Previous fix: Bumped hit area from r=36 to r=56 (session observation #2167)
- `components/SectorMap.tsx` — sole file affected
- [MDN: SVG pointer-events](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/pointer-events)
- [W3C SVG 2: Interactivity](https://svgwg.org/svg2-draft/interact.html)
- [Smashing Magazine: SVG Interaction](https://www.smashingmagazine.com/2018/05/svg-interaction-pointer-events-property/)

---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, performance, mousemove]
dependencies: []
---

# Throttle handleBodyProximity with requestAnimationFrame

## Problem Statement

`handleBodyProximity` fires on every `mousemove` event over the system group. At 60fps+ pointer movement, this means `getScreenCTM()`, `matrixTransform()`, and distance calculations run potentially hundreds of times per second. Should be gated to one execution per animation frame.

## Findings

- Performance oracle flagged unthrottled mousemove handler
- Already using rAF pattern for pan handler (`handleMouseMove`) — should match
- `getScreenCTM()` and `matrixTransform()` involve DOM layout queries

## Proposed Solutions

### Option A: rAF gate with ref (Recommended)
- Use `useRef` for rAF ID, gate `handleBodyProximity` to fire once per frame
- Pros: Consistent with existing pan handler pattern, minimal overhead
- Cons: Slight added complexity
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] `handleBodyProximity` is throttled via `requestAnimationFrame`
- [ ] rAF ID is cleaned up properly
- [ ] Hover still feels responsive (no perceptible lag)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | Performance oracle finding |

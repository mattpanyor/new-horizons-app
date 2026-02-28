---
status: pending
priority: p3
issue_id: "005"
tags: [code-review, performance, touch]
dependencies: []
---

# Add rAF gating to pinch-zoom handler

## Problem Statement

The `handleTouchMove` pinch-zoom handler runs unthrottled on every touch event. Touch events can fire at 120Hz+ on modern devices, causing excessive repaints.

## Findings

- Performance oracle flagged this as a secondary optimization
- Pan handler already uses rAF gating — pinch-zoom should match

## Proposed Solutions

### Option A: Add rAF gate matching pan handler pattern
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] Pinch-zoom handler is gated with requestAnimationFrame
- [ ] Zoom still feels smooth on touch devices

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | Performance oracle finding |

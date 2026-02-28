---
status: pending
priority: p2
issue_id: "001"
tags: [code-review, typescript, safety]
dependencies: []
---

# Guard getScreenCTM() non-null assertion

## Problem Statement

`nearestBody()` in `SectorMap.tsx:413` uses `getScreenCTM()!.inverse()` with a non-null assertion. `getScreenCTM()` can return `null` if the SVG element is not rendered or detached from the DOM. This would throw at runtime.

## Findings

- TypeScript reviewer flagged `!` assertion as unsafe
- `getScreenCTM()` returns `null` when element has `display:none` or is not in the document
- Could happen during rapid navigation or component unmount races

## Proposed Solutions

### Option A: Early return on null (Recommended)
- Add null check: `const ctm = g.getScreenCTM(); if (!ctm) return null;`
- Pros: Simple, safe, minimal change
- Cons: None
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] `getScreenCTM()` result is null-checked before calling `.inverse()`
- [ ] No `!` non-null assertion on `getScreenCTM()` call
- [ ] TypeScript compiles cleanly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | TypeScript reviewer finding |

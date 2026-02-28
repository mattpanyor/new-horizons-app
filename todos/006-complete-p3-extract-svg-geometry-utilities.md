---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, architecture, duplication]
dependencies: []
---

# Extract shared SVG geometry utilities

## Problem Statement

`GalacticMap.tsx` and `SectorMap.tsx` both define `toRad()` and similar SVG geometry helpers independently. This is duplicated logic that could be shared.

## Findings

- Pattern recognition specialist identified duplication
- Architecture strategist suggested `lib/svgPaths.ts` extraction
- Lower priority — only two consumers currently

## Proposed Solutions

### Option A: Create lib/svgGeometry.ts
- Extract `toRad`, `annularSectorPath`, and other shared SVG utilities
- Pros: DRY, single source of truth
- Cons: Extra file for small utilities
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Shared SVG geometry functions extracted to lib file
- [ ] Both components import from shared module
- [ ] No behavior changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | Pattern recognition + Architecture finding |

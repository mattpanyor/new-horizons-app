---
status: pending
priority: p3
issue_id: "004"
tags: [code-review, react, performance]
dependencies: []
---

# Stabilize callback identities using refs

## Problem Statement

`handleBodyProximity` and `handleBodyClick` depend on `activeBodyId` in their `useCallback` dependency arrays, causing new function references on every hover change. This triggers unnecessary re-renders of child elements receiving these as props.

## Findings

- TypeScript reviewer and pattern recognition specialist both flagged this
- Pattern: store mutable state in refs, read from ref inside stable callback
- Lower priority since SVG elements don't memo-compare props like React components

## Proposed Solutions

### Option A: useRef for activeBodyId in callbacks
- Store `activeBodyId` in a ref, read ref.current inside callbacks
- Pros: Stable callback identity, fewer re-renders
- Cons: Slightly less readable
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] Callback references don't change on every hover state change
- [ ] Hover behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | TypeScript + Pattern recognition finding |

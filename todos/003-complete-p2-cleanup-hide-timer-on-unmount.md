---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, architecture, memory-leak]
dependencies: []
---

# Clean up hideTimer on component unmount

## Problem Statement

`hideTimer` (the 900ms setTimeout for hiding the info card) is stored in a ref but never cleared on component unmount. If the component unmounts while a timer is pending, the callback fires on stale state.

## Findings

- Architecture strategist flagged missing cleanup
- `scheduleHide` sets `hideTimer.current = setTimeout(...)` but no `useEffect` cleanup
- Could cause React "setState on unmounted component" warnings

## Proposed Solutions

### Option A: Add useEffect cleanup (Recommended)
- Add `useEffect(() => () => clearTimeout(hideTimer.current), [])`
- Pros: Standard React cleanup pattern, one line
- Cons: None
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] `hideTimer` is cleared on component unmount via useEffect cleanup
- [ ] No memory leak or stale timer warnings

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-28 | Created from code review | Architecture strategist finding |

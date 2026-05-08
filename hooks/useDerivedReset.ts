"use client";

import { useState } from "react";

// Run a side-effect callback whenever `value` changes between renders. Uses
// the React-documented "previous prop in state" pattern — we hold the prior
// value in component state, compare during render, fire the callback if
// different, then update the stored prev.
//
// Equivalent to a `useEffect(() => onChange(value, prev), [value])`, but
// without the cascading-render warning the `react-hooks/set-state-in-effect`
// rule raises when the callback itself performs setState (which is the
// common case here — phase changes reset local toggles, etc.). Running
// during render lets React batch the prev-update with whatever setState the
// callback issues into a single re-render.
//
// CAUTION: onChange must not produce a new `value` for this hook — that
// would loop. Use it for consuming external/derived values (props, polled
// state) and triggering local state resets in response.
export function useDerivedReset<T>(
  value: T,
  onChange: (next: T, prev: T) => void,
): void {
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    onChange(value, prev);
  }
}

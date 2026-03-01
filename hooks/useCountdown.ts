import { useState, useEffect, useRef } from "react";

export function useCountdown(seconds: number, onComplete: () => void) {
  const [count, setCount] = useState(seconds);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setCount((n) => {
        if (n <= 1) {
          clearInterval(id);
          onCompleteRef.current();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const progress = seconds > 0 ? ((seconds - count) / seconds) * 100 : 100;

  return { count, progress };
}

import { useState, useEffect, useRef } from "react";

export function useCountdown(seconds: number, onComplete: () => void) {
  const [count, setCount] = useState(seconds);
  const onCompleteRef = useRef(onComplete);
  const firedRef = useRef(false);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setCount((n) => {
        if (n <= 1) {
          clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  useEffect(() => {
    if (count === 0 && seconds > 0 && !firedRef.current) {
      firedRef.current = true;
      onCompleteRef.current();
    }
  }, [count, seconds]);

  const progress = seconds > 0 ? ((seconds - count) / seconds) * 100 : 100;

  return { count, progress };
}

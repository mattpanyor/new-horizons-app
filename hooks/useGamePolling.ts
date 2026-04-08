"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveGameResponse, NoActiveGameResponse } from "@/types/game";

type GamePollResult = ActiveGameResponse | NoActiveGameResponse;

export function useGamePolling() {
  const [data, setData] = useState<GamePollResult | null>(null);
  const [loading, setLoading] = useState(true);
  const lastJsonRef = useRef<string>("");

  useEffect(() => {
    let first = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/games/active");
        if (res.ok) {
          const result: GamePollResult = await res.json();
          const json = JSON.stringify(result);
          if (json !== lastJsonRef.current) {
            lastJsonRef.current = json;
            setData(result);
          }
        }
      } catch {
        /* offline — keep last known state */
      }
      if (first) {
        first = false;
        setLoading(false);
      }
    };

    poll();
    let id: ReturnType<typeof setInterval> | null = setInterval(poll, 2000);

    const onVisibility = () => {
      if (document.hidden) {
        if (id) { clearInterval(id); id = null; }
      } else {
        if (id) clearInterval(id);
        poll();
        id = setInterval(poll, 2000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { data, loading };
}

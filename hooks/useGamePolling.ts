"use client";

import useSWR from "swr";
import type { ActiveGameResponse, NoActiveGameResponse } from "@/types/game";

type GamePollResult = ActiveGameResponse | NoActiveGameResponse;

const ACTIVE_GAME_KEY = "/api/games/active";

const fetcher = async (url: string): Promise<GamePollResult> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
};

export function useGamePolling() {
  const { data, isLoading, mutate } = useSWR<GamePollResult>(
    ACTIVE_GAME_KEY,
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 500,
      keepPreviousData: true,
    }
  );

  // Write the authoritative state from a mutation response back into the SWR
  // cache so the UI reflects the move immediately. `revalidate: false` skips
  // the redundant GET — polling will reconcile on the next tick anyway.
  const applyServerState = (nextState: unknown, winner: string | null) => {
    mutate(
      (current) => {
        if (!current || !current.active) return current;
        return {
          ...current,
          session: {
            ...current.session,
            state: nextState as ActiveGameResponse["session"]["state"],
            winner,
          },
        };
      },
      { revalidate: false }
    );
  };

  return { data: data ?? null, loading: isLoading, applyServerState };
}

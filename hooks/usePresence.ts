"use client";

import { useEffect, useRef, useState } from "react";

export interface UserPresence {
  username: string;
  position: string;
}

function getUsername(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )nh_user=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function usePresence(position: string): {
  users: UserPresence[];
  currentUser: string | null;
} {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const lastUsersJsonRef = useRef<string>("");
  const prevPositionRef = useRef<string | null>(null);

  // Report own position whenever it changes
  useEffect(() => {
    if (prevPositionRef.current === position) return;
    prevPositionRef.current = position;
    const username = getUsername();
    if (!username) return;
    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, position }),
    }).catch(() => {});
  }, [position]);

  // Poll all users every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/presence");
        if (res.ok) {
          const data: UserPresence[] = await res.json();
          const json = JSON.stringify(data);
          if (json !== lastUsersJsonRef.current) {
            lastUsersJsonRef.current = json;
            setUsers(data);
          }
        }
      } catch { /* offline — keep last known state */ }
    };
    poll();
    let id: ReturnType<typeof setInterval> | null = setInterval(poll, 5000);

    const onVisibility = () => {
      if (document.hidden) {
        if (id) { clearInterval(id); id = null; }
      } else {
        if (id) clearInterval(id);
        poll();
        id = setInterval(poll, 5000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { users, currentUser: getUsername() };
}

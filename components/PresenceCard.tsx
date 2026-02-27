"use client";

import { useEffect, useRef, useState } from "react";

interface UserPresence {
  username: string;
  position: string;
}

function getUsername(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )nh_user=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function PresenceCard({ position }: { position: string }) {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [open, setOpen] = useState(true);
  const usernameRef = useRef<string | null>(null);

  // Resolve username once on mount
  useEffect(() => {
    usernameRef.current = getUsername();
  }, []);

  // Report own position whenever it changes
  useEffect(() => {
    const username = usernameRef.current ?? getUsername();
    if (!username) return;
    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, position }),
    });
  }, [position]);

  // Poll all users every 5 seconds
  useEffect(() => {
    const poll = async () => {
      const res = await fetch("/api/presence");
      if (res.ok) setUsers(await res.json());
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  if (users.length === 0) return null;

  const currentUser = usernameRef.current ?? getUsername();

  // Collapsed pill — just show count + reopen button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] scifi-card px-3 py-1.5 flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
        aria-label="Show crew"
      >
        <span className="text-[9px] tracking-[0.3em] uppercase">Crew</span>
        <span className="text-[10px] text-indigo-400">{users.length}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9999] scifi-card px-3 py-2.5 min-w-[160px] max-w-[240px]">
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[9px] tracking-[0.35em] uppercase text-white/25"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Crew Online
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-white/25 hover:text-white/60 transition-colors leading-none text-xs ml-3"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-8rem)]">
        {users.map((u) => (
          <li key={u.username} className="flex flex-col gap-0.5">
            <span
              className={`text-[11px] font-semibold ${
                u.username === currentUser ? "text-indigo-300" : "text-white/70"
              }`}
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              {u.username}
              {u.username === currentUser && (
                <span className="ml-1 text-[9px] text-white/25 font-normal">you</span>
              )}
            </span>
            <span
              className="text-[9px] text-white/35 leading-tight"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              {u.position}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

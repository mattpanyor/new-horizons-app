"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import StarSystemBackground from "@/components/StarSystemBackground";
import DotGridAnimation from "@/components/DotGridAnimation";
import { HexAvatar } from "@/components/HexAvatar";

// Sitewide toggle. When NEXT_PUBLIC_AVATAR_LOGIN=true, the login page shows a
// grid of user avatars to tap instead of a username field. Inlined at build
// time, so flipping it requires a redeploy.
const AVATAR_LOGIN = process.env.NEXT_PUBLIC_AVATAR_LOGIN === "true";

interface AvatarUser {
  username: string;
  imageUrl: string | null;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AvatarUser[] | null>(null);

  useEffect(() => {
    if (!AVATAR_LOGIN) return;
    fetch("/api/auth/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) setUsers(data.users as AvatarUser[]);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/");
    } else {
      setError("Invalid username or password.");
      setPassword("");
    }
  }

  const showAvatarGrid = AVATAR_LOGIN && !username;
  const selectedUser = AVATAR_LOGIN && username
    ? users?.find((u) => u.username === username) ?? { username, imageUrl: null }
    : null;

  return (
    <>
      <StarSystemBackground />
      <DotGridAnimation exclusionZones={[{ x: 30, y: 25, width: 40, height: 50 }]} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className={`w-full ${showAvatarGrid ? "max-w-2xl" : "max-w-sm"}`}>
          {/* Title */}
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-2" style={cinzel}>
              New Horizons
            </p>
            <h1 className="text-2xl font-semibold text-white/80" style={cinzel}>
              Crew Access
            </h1>
          </div>

          {showAvatarGrid ? (
            <div className="scifi-card p-6">
              {users === null ? (
                <p className="text-xs text-slate-400 text-center" style={cinzel}>
                  Loading…
                </p>
              ) : users.length === 0 ? (
                <p className="text-xs text-slate-400 text-center" style={cinzel}>
                  No crew on record.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {users.map((u) => (
                    <button
                      key={u.username}
                      type="button"
                      onClick={() => {
                        setUsername(u.username);
                        setError(null);
                      }}
                      className="group focus:outline-none"
                    >
                      <HexAvatar imageUrl={u.imageUrl} letter={u.username[0]} interactive />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="scifi-card p-6 flex flex-col gap-4">
              {selectedUser && (
                <div className="flex flex-col items-center gap-2 mb-2">
                  <HexAvatar
                    imageUrl={selectedUser.imageUrl}
                    letter={selectedUser.username[0]}
                    interactive={false}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUsername("");
                      setPassword("");
                      setError(null);
                    }}
                    className="text-[10px] tracking-[0.3em] uppercase text-slate-400 hover:text-slate-200 transition-colors"
                    style={cinzel}
                  >
                    ← Back
                  </button>
                </div>
              )}

              {!selectedUser && (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="username"
                    className="text-[10px] tracking-[0.3em] uppercase text-slate-400"
                    style={cinzel}
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    required
                    suppressHydrationWarning
                    className="bg-slate-900/60 border border-indigo-500/30 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400/60 transition-colors"
                    style={cinzel}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[10px] tracking-[0.3em] uppercase text-slate-400"
                  style={cinzel}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={!!selectedUser}
                  suppressHydrationWarning
                  className="bg-slate-900/60 border border-indigo-500/30 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400/60 transition-colors"
                  style={cinzel}
                />
              </div>

              {error && (
                <p className="text-xs text-red-400/80 text-center" style={cinzel}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 py-2 rounded bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-500/50 text-white/90 text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
                style={cinzel}
              >
                {loading ? "Verifying…" : "Enter"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

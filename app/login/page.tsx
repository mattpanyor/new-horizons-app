"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import StarSystemBackground from "@/components/StarSystemBackground";
import DotGridAnimation from "@/components/DotGridAnimation";

// Sitewide toggle. When NEXT_PUBLIC_AVATAR_LOGIN=true, the login page shows a
// grid of user avatars to tap instead of a username field. Inlined at build
// time, so flipping it requires a redeploy.
const AVATAR_LOGIN = process.env.NEXT_PUBLIC_AVATAR_LOGIN === "true";

interface AvatarUser {
  username: string;
  imageUrl: string | null;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Pointy-top hexagon inscribed in a 1:1 square. Used for avatar tiles.
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// Tactical-frame hex avatar. Matches the project's existing decoration motif
// (corner brackets + thin accent strokes) seen on game boards and panels.
function HexAvatar({
  imageUrl,
  letter,
  interactive,
}: {
  imageUrl: string | null;
  letter: string;
  interactive: boolean;
}) {
  const stroke = interactive
    ? "border-indigo-500/30 group-hover:border-indigo-400/80"
    : "border-indigo-500/50";
  const fill = interactive
    ? "bg-indigo-500/30 group-hover:bg-indigo-400/80"
    : "bg-indigo-500/50";
  const glow = interactive
    ? "shadow-[0_0_0_rgba(99,102,241,0)] group-hover:shadow-[0_0_18px_rgba(99,102,241,0.35)]"
    : "shadow-[0_0_18px_rgba(99,102,241,0.2)]";

  return (
    <div className="relative w-full max-w-[96px] aspect-square mx-auto">
      {/* Corner brackets */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${stroke} transition-colors`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${stroke} transition-colors`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${stroke} transition-colors`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${stroke} transition-colors`} />

      {/* Side connection ports */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-2 h-px ${fill} transition-colors`} />
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-px ${fill} transition-colors`} />

      {/* Vertex caps (top & bottom of hex) */}
      <div className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rotate-45 ${fill} transition-colors`} />
      <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rotate-45 ${fill} transition-colors`} />

      {/* Hex tile */}
      <div
        className={`absolute inset-2 p-[2px] ${fill} ${glow} transition-all`}
        style={{ clipPath: HEX_CLIP }}
      >
        <div
          className="w-full h-full bg-slate-900/80 flex items-center justify-center overflow-hidden"
          style={{ clipPath: HEX_CLIP }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover object-top" />
          ) : (
            <span className="text-2xl text-slate-500 uppercase" style={cinzel}>
              {letter}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

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

"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AvatarUser[] | null>(null);
  // Hit-target buttons keyed by username, so focus can return to the blade a
  // user backed out of.
  const bladeButtons = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const selecting = AVATAR_LOGIN && !!username;

  function reset() {
    const prev = username;
    setUsername("");
    setPassword("");
    setError(null);
    // Return focus to the blade the user backed out of, once it re-renders.
    requestAnimationFrame(() => bladeButtons.current[prev]?.focus());
  }

  return (
    <>
      <StarSystemBackground />
      <DotGridAnimation exclusionZones={[{ x: 30, y: 25, width: 40, height: 50 }]} />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className={AVATAR_LOGIN ? "w-auto max-w-full" : "w-full max-w-sm"}>
          {/* Title */}
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.5em] text-white/25 uppercase mb-2" style={cinzel}>
              New Horizons
            </p>
            <h1 className="text-2xl font-semibold text-white/80" style={cinzel}>
              Crew Access
            </h1>
          </div>

          {AVATAR_LOGIN ? (
            users === null ? (
              <div className="scifi-card p-6">
                <p className="text-xs text-slate-400 text-center" style={cinzel}>
                  Loading…
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="scifi-card p-6">
                <p className="text-xs text-slate-400 text-center" style={cinzel}>
                  No crew on record.
                </p>
              </div>
            ) : (
              // A single row of portrait blades. Clicking one collapses the
              // others to nothing and expands the chosen blade into the login
              // box — its portrait dims into the box backdrop.
              <div className="flex flex-row items-center justify-center overflow-hidden py-6">
                {users.map((u, i) => {
                  const isSelected = username === u.username;
                  const isHidden = selecting && !isSelected;
                  return (
                    <div
                      key={u.username}
                      aria-hidden={isHidden || undefined}
                      inert={isHidden || undefined}
                      className={[
                        "login-blade group relative shrink-0 overflow-hidden",
                        "transition-all ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                        isSelected
                          ? "login-blade--active w-[20rem] max-w-[85vw] h-[26rem] duration-500 delay-100"
                          : isHidden
                            ? "w-0 h-64 opacity-0 duration-300"
                            : "w-24 sm:w-28 h-64 duration-300",
                      ].join(" ")}
                    >
                      {/* Blade frame */}
                      <div className="absolute inset-0 border border-indigo-500/30 group-hover:border-indigo-400/80 bg-slate-900/60 shadow-[inset_0_0_0_rgba(99,102,241,0)] group-hover:shadow-[inset_0_0_26px_rgba(99,102,241,0.4)] transition-all overflow-hidden">
                        {/* Portrait, aligned top-center — becomes the faded box backdrop when active */}
                        {u.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.imageUrl}
                            alt=""
                            width={112}
                            height={256}
                            className="login-blade__portrait w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="login-blade__portrait w-full h-full flex items-start justify-center pt-6">
                            <span className="text-4xl text-slate-500 uppercase" style={cinzel}>
                              {u.username[0]}
                            </span>
                          </div>
                        )}

                        {/* Idle scan line (staggered) + hover sheen sweep */}
                        <div
                          className="login-blade__scan"
                          style={{ animationDelay: `${(i % 5) * -1.4}s` }}
                        />
                        <div className="login-blade__sheen" />

                        {/* Backdrop scrim — fades the portrait into the box when active */}
                        <div
                          className={`absolute inset-0 z-[3] bg-gradient-to-b from-slate-950/40 via-slate-950/65 to-slate-950/95 transition-opacity duration-500 motion-reduce:transition-none ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                        />

                        {/* Resting name (hidden once this blade becomes the box) */}
                        {!isSelected && (
                          <div className="absolute inset-x-0 bottom-0 z-[4] bg-gradient-to-t from-slate-950/90 to-transparent pt-8 pb-2 px-1">
                            <p
                              className="text-[10px] tracking-[0.2em] uppercase text-white/70 group-hover:text-white text-center truncate transition-colors"
                              style={cinzel}
                            >
                              {u.username}
                            </p>
                          </div>
                        )}

                        {/* The login box, revealed inside the expanded blade */}
                        {isSelected && (
                          <form
                            onSubmit={handleSubmit}
                            className="login-form-reveal absolute inset-0 z-[5] flex flex-col justify-end gap-3 p-5"
                          >
                            <p
                              className="text-sm tracking-[0.25em] uppercase text-white/90 text-center mb-1"
                              style={cinzel}
                            >
                              {u.username}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              <label
                                htmlFor="password"
                                className="text-[10px] tracking-[0.3em] uppercase text-slate-300"
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
                                autoFocus
                                suppressHydrationWarning
                                className="bg-slate-900/70 border border-indigo-500/40 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400/70 transition-colors"
                                style={cinzel}
                              />
                            </div>

                            {error && (
                              <p
                                role="alert"
                                aria-live="polite"
                                className="text-xs text-red-400/90 text-center"
                                style={cinzel}
                              >
                                {error}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={loading}
                              className="mt-1 py-2 rounded bg-indigo-600/50 hover:bg-indigo-600/70 border border-indigo-500/60 text-white/90 text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
                              style={cinzel}
                            >
                              {loading ? "Verifying…" : "Enter"}
                            </button>
                            <button
                              type="button"
                              onClick={reset}
                              className="text-[10px] tracking-[0.3em] uppercase text-slate-400 hover:text-slate-200 transition-colors"
                              style={cinzel}
                            >
                              ← Back
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Corner brackets */}
                      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-indigo-500/40 group-hover:border-indigo-400/90 transition-colors z-[6]" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-indigo-500/40 group-hover:border-indigo-400/90 transition-colors z-[6]" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-indigo-500/40 group-hover:border-indigo-400/90 transition-colors z-[6]" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-indigo-500/40 group-hover:border-indigo-400/90 transition-colors z-[6]" />

                      {/* Selection hit-target (resting only) */}
                      {!selecting && (
                        <button
                          type="button"
                          ref={(el) => {
                            bladeButtons.current[u.username] = el;
                          }}
                          onClick={() => {
                            setError(null);
                            setUsername(u.username);
                          }}
                          className="absolute inset-0 z-[7] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80 focus-visible:ring-inset"
                          title={u.username}
                          aria-label={`Select ${u.username}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="scifi-card p-6 flex flex-col gap-4">
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

"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import DotGridAnimation from "@/components/DotGridAnimation";
import LoginCardScatter from "@/components/LoginCardScatter";
import { portraitFocus } from "@/lib/portraitFocus";

// Sitewide toggle. When NEXT_PUBLIC_AVATAR_LOGIN=true, the login page shows a
// grid of user avatars to tap instead of a username field. Inlined at build
// time, so flipping it requires a redeploy.
const AVATAR_LOGIN = process.env.NEXT_PUBLIC_AVATAR_LOGIN === "true";

interface AvatarUser {
  username: string;
  imageUrl: string | null;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function LoginScreen() {
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
      router.push("/sectors");
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
      <DotGridAnimation exclusionZones={[{ x: 30, y: 25, width: 40, height: 50 }]} />
      <LoginCardScatter variant={AVATAR_LOGIN ? "avatar" : "form"} />
      {/* py-10 rather than pure centring: the stacked phone blade list can run
          taller than the viewport, and a centred flex child would be clipped
          at the top instead of scrolling. */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div
          className={
            AVATAR_LOGIN ? "w-full max-w-sm sm:w-auto sm:max-w-full" : "w-full max-w-sm"
          }
        >
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
              // A row of portrait blades — stacked into a column of wide, short
              // ones on a phone, where a row of nine would be a hairline each.
              // Either way, clicking one collapses the others along the same
              // axis and expands the chosen blade into the login box, its
              // portrait dimming into the box backdrop. No gaps in either
              // direction — the blades butt up against each other and read as
              // one panel.
              <div className="flex flex-col sm:flex-row items-center justify-center overflow-hidden py-6">
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
                        // Phone blades keep their width and trade height; from
                        // sm up it's the other way round.
                        isSelected
                          ? "login-blade--active w-full h-[21rem] sm:w-[20rem] sm:max-w-[85vw] sm:h-[26rem] duration-500 delay-100"
                          : isHidden
                            ? "w-full h-0 opacity-0 sm:w-0 sm:h-64 duration-300"
                            : "w-full h-20 sm:w-28 sm:h-64 duration-300",
                      ].join(" ")}
                    >
                      {/* Blade frame */}
                      <div className="absolute inset-0 border border-indigo-500/30 group-hover:border-indigo-400/80 bg-slate-900/60 shadow-[inset_0_0_0_rgba(99,102,241,0)] group-hover:shadow-[inset_0_0_26px_rgba(99,102,241,0.4)] transition-all overflow-hidden">
                        {/* Portrait — becomes the faded box backdrop when active.
                            Cropped to the portrait's own eye-line rather than to
                            its top edge: a phone blade is a wide strip showing a
                            band a seventh of the picture tall, and where a face
                            sits in that seventh differs per piece of art. The
                            tall blades from sm up have no vertical overflow, so
                            the position makes no difference to them. */}
                        {u.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.imageUrl}
                            alt=""
                            width={112}
                            height={256}
                            style={{ objectPosition: portraitFocus(u.imageUrl) }}
                            className="login-blade__portrait w-full h-full object-cover"
                          />
                        ) : (
                          <div className="login-blade__portrait w-full h-full flex items-center justify-center sm:items-start sm:pt-6">
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

                        {/* Resting name — under the portrait on a tall blade;
                            on a phone strip there is no under, so it reads
                            across a scrim that runs in from the leading edge
                            and clears the face in the middle. Hidden once this
                            blade becomes the box. */}
                        {!isSelected && (
                          <div className="absolute inset-y-0 inset-x-0 z-[4] flex items-center px-4 bg-gradient-to-r from-slate-950/95 via-slate-950/40 to-transparent sm:inset-y-auto sm:bottom-0 sm:block sm:px-1 sm:pt-8 sm:pb-2 sm:bg-gradient-to-t sm:from-slate-950/90 sm:via-transparent">
                            <p
                              className="w-full text-[11px] sm:text-[10px] tracking-[0.2em] uppercase text-white/70 group-hover:text-white text-left sm:text-center truncate transition-colors"
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

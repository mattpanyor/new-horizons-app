interface Props {
  character?: string;
  role?: string;
  group: string;
}

export default function IdentityPanel({ character, role, group }: Props) {
  const isGM = !character && !role;
  const lastName = character ? character.split(" ").at(-1) : undefined;

  return (
    <div className="hidden lg:flex fixed left-6 xl:left-10 top-1/2 -translate-y-1/2 z-30 flex-col items-start gap-2 max-w-[15rem] pointer-events-none select-none">

      <p
        className="text-[9px] tracking-[0.55em] uppercase text-white/20 mb-2"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        Identity Verified
      </p>

      {isGM ? (
        <>
          <p
            className="text-xs tracking-[0.3em] uppercase text-white/30"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            Welcome,
          </p>
          <h2
            className="text-2xl font-semibold text-white/90 tracking-wide leading-snug"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {group}
          </h2>
        </>
      ) : (
        <>
          <p
            className="text-sm tracking-[0.3em] text-white/30"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            Welcome to the
          </p>

          <h2
            className="text-xl font-semibold text-white/90 leading-snug"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            {group}
          </h2>

          <p
            className="text-sm font-bold tracking-[0.7em] uppercase text-white/25"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            Archives
          </p>

          {/* Sci-fi deco frame around role + name */}
          <div className="relative inline-flex flex-col items-start gap-0.5 px-5 py-3 mt-5">

            {/* Inner fill */}
            <div className="absolute inset-0 bg-indigo-950/30" />

            {/* Gradient edge lines */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

            {/* Corner L-brackets */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-indigo-400/70" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-indigo-400/70" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-indigo-400/70" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-indigo-400/70" />

            {/* Corner diamonds */}
            <div className="absolute top-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 -translate-y-1/2"
              style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
            <div className="absolute top-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 -translate-y-1/2"
              style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
            <div className="absolute bottom-0 left-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 -translate-x-1/2 translate-y-1/2"
              style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />
            <div className="absolute bottom-0 right-0 w-[5px] h-[5px] rotate-45 bg-indigo-400 translate-x-1/2 translate-y-1/2"
              style={{ boxShadow: "0 0 6px rgba(129,140,248,0.9)" }} />

            {/* Side whiskers */}
            <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />
            <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 w-3 h-px bg-indigo-400/30" />

            {/* Top/bottom center ticks */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full flex items-center gap-1">
              <div className="w-3 h-px bg-indigo-400/30" />
              <div className="w-[4px] h-[4px] rotate-45 bg-indigo-400/50" />
              <div className="w-3 h-px bg-indigo-400/30" />
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full flex items-center gap-1">
              <div className="w-3 h-px bg-indigo-400/30" />
              <div className="w-[4px] h-[4px] rotate-45 bg-indigo-400/50" />
              <div className="w-3 h-px bg-indigo-400/30" />
            </div>

            {role && (
              <span
                className="relative text-sm text-indigo-300/60 tracking-widest"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {role}
              </span>
            )}
            {lastName && (
              <span
                className="relative text-lg font-semibold text-white/90"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                {lastName}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";

interface Props {
  username: string;
  character?: string;
  role?: string;
  group: string;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function Navbar({ username, character, role, group }: Props) {
  const displayName = character ?? username;

  return (
    <header className="h-16 w-full grid grid-cols-2 md:grid-cols-3 items-center px-5 border-b border-white/5 bg-black/40 backdrop-blur-sm shrink-0">

      {/* Left — character + role */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-white/75 leading-none truncate" style={cinzel}>
          {displayName}
        </span>
        {role && (
          <span
            className="text-[10px] tracking-[0.5em] uppercase text-white/70 leading-none truncate"
            style={{ ...cinzel, textShadow: "0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,0.8)" }}
          >
            {role}
          </span>
        )}
      </div>

      {/* Centre — faction + Archives (hidden on mobile) */}
      <div className="hidden md:flex flex-col items-center justify-center gap-1.5 min-w-0 px-2">
        <span className="text-sm font-semibold text-white/75 leading-none text-center tracking-[0.2em] truncate w-full text-center" style={cinzel}>
          {group}
        </span>
        <span
          className="text-[10px] tracking-[0.8em] uppercase text-white/70 leading-none"
          style={{ ...cinzel, textShadow: "0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,0.8)" }}
        >
          Archives
        </span>
      </div>

      {/* Right — nav */}
      <div className="flex justify-end">
        <Link
          href="/sectors"
          className="text-[11px] tracking-[0.35em] uppercase text-white/40 hover:text-white/80 transition-colors whitespace-nowrap"
          style={cinzel}
        >
          Galactic Map
        </Link>
      </div>

    </header>
  );
}

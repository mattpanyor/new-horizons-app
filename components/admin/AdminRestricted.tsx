"use client";

import Link from "next/link";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default function AdminRestricted() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center max-w-md gap-4">
        <h1
          className="text-xl text-white/70 tracking-[0.3em] uppercase"
          style={cinzel}
        >
          Restricted Area
        </h1>
        <p className="text-sm text-white/40 leading-relaxed" style={cinzel}>
          This section is reserved for the Dungeon Master and contains story content that you cannot access at the moment.
        </p>
        <Link
          href="/sectors"
          className="mt-4 px-6 py-2.5 text-xs tracking-[0.3em] uppercase rounded transition-colors"
          style={{
            ...cinzel,
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.35)",
            color: "rgba(165, 180, 252, 0.8)",
          }}
        >
          Return to Galactic Map
        </Link>
      </div>
    </main>
  );
}

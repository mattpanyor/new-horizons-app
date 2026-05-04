"use client";

import Link from "next/link";

type Position = "top-right" | "bottom-right";

interface NavIconProps {
  href: string;
  label: string;
  position?: Position;
  children: React.ReactNode;
}

const POSITION_CLASS: Record<Position, string> = {
  "top-right": "top-20 right-3 sm:right-6 md:right-10",
  "bottom-right": "bottom-6 right-3 sm:right-6 md:right-10",
};

export default function NavIcon({ href, label, position = "top-right", children }: NavIconProps) {
  return (
    <Link
      href={href}
      title={label}
      className={`fixed ${POSITION_CLASS[position]} z-40 flex flex-col items-center gap-1.5 md:gap-4 px-3 py-2.5 md:px-8 md:py-6 rounded-lg md:rounded-xl border border-white/10 md:border-white/20 text-white/40 md:text-white/60 hover:text-white/70 md:hover:text-white/90 hover:border-white/25 md:hover:border-white/40 hover:bg-white/5 md:hover:bg-white/10 transition-all [&_svg]:w-16 [&_svg]:h-16 md:[&_svg]:w-36 md:[&_svg]:h-36`}
      style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" }}
    >
      {children}
      <span
        className="text-[8px] md:text-xs tracking-[0.2em] md:tracking-[0.35em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        {label}
      </span>
    </Link>
  );
}

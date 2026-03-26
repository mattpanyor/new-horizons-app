"use client";

import Link from "next/link";

interface NavIconProps {
  href: string;
  label: string;
  children: React.ReactNode;
}

export default function NavIcon({ href, label, children }: NavIconProps) {
  return (
    <Link
      href={href}
      title={label}
      className="fixed top-20 right-3 sm:right-6 z-40 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/5 transition-all"
      style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" }}
    >
      {children}
      <span
        className="text-[8px] tracking-[0.2em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        {label}
      </span>
    </Link>
  );
}

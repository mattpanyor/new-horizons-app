"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnonymityEntry,
  AnonymityKind,
  FactionStanding,
  Vip,
} from "@/types/campaign";
import { FACTION_CATEGORIES, type FactionCategory } from "@/lib/allegiances";
import { countIntact, integrityTier } from "@/lib/campaign/integrity";
import { standingVerdict } from "@/lib/campaign/standing";
import CategoryPanel from "./CategoryPanel";
import StandingBar from "./StandingBar";
import VipPanel from "./VipPanel";
import AnonymityLog from "./AnonymityLog";
import TrackerTabs, { type TabSpec, type TrackerTab } from "./TrackerTabs";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

/** Numbered rule for a sub-section inside a tab panel. */
function SectionHeader({
  numeral,
  title,
  caption,
  meta,
}: {
  numeral: string;
  title: string;
  caption: string;
  meta?: string;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[11px] tabular-nums text-indigo-300/40">{numeral}</span>
        <h2
          className="text-[13px] sm:text-sm tracking-[0.4em] uppercase text-white/75 whitespace-nowrap"
          style={cinzel}
        >
          {title}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        {meta && (
          <span className="text-[9px] tracking-[0.22em] uppercase text-white/25 whitespace-nowrap" style={cinzel}>
            {meta}
          </span>
        )}
      </div>
      <p className="mt-2 ml-[3.1rem] text-[11px] tracking-[0.08em] text-white/50">{caption}</p>
    </header>
  );
}

/**
 * True on the screens too narrow to hold three sections side by side.
 *
 * A hook rather than a media query in globals.css because the sizing it drives
 * is inline: the component and its layout then travel together, and neither can
 * arrive without the other. Starts false so the server and the first client
 * render agree, and corrects on mount.
 *
 * 639px is one below Tailwind's `sm`, the same line the rest of the page turns
 * its layout on.
 */
function useStackedSections(): boolean {
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setStacked(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return stacked;
}

const VIP_TAB_PREFIX = "vip:";

/** Dimmer than the card palette: these lines sit under the columns, not in them. */
const WITHHELD_TONE: Record<string, string> = {
  hostile: "rgba(252,165,165,0.7)",
  friendly: "rgba(110,231,183,0.7)",
  neutral: "rgba(255,255,255,0.35)",
};

/**
 * A withheld faction, as one line.
 *
 * Hidden factions are a superadmin's own working state — the server never sends
 * them to anyone else — so they are kept out of the dealt columns entirely and
 * listed underneath instead. The standing stays editable here: a faction can be
 * rated without being shown to the table.
 */
function WithheldRow({
  standing,
  onChange,
}: {
  standing: FactionStanding;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
}) {
  const verdict = standingVerdict(standing.red, standing.green);

  return (
    <li className="flex items-center gap-3 px-1 py-2 transition-colors hover:bg-white/[0.03]">
      <span
        className="h-1.5 w-1.5 shrink-0 rotate-45"
        style={{ background: standing.color, boxShadow: `0 0 8px ${standing.color}88` }}
        aria-hidden
      />

      <span
        className="min-w-0 flex-1 truncate text-[10px] tracking-[0.16em] uppercase text-white/55"
        style={cinzel}
        title={standing.name}
      >
        {standing.name}
      </span>

      <span
        className="hidden sm:block w-24 shrink-0 text-right text-[9px] tracking-[0.16em] uppercase"
        style={{ ...cinzel, color: WITHHELD_TONE[verdict.tone] }}
      >
        {verdict.label}
      </span>

      <StandingBar
        red={standing.red}
        green={standing.green}
        onChange={(fields) => onChange(standing.slug, fields)}
      />

      <button
        type="button"
        onClick={() => onChange(standing.slug, { hidden: false })}
        className="w-14 shrink-0 text-right text-[9px] tracking-[0.18em] uppercase text-white/35 transition-colors hover:text-white/85"
        style={cinzel}
        title="Show this faction to players"
      >
        Reveal
      </button>
    </li>
  );
}

interface Props {
  initialStandings: FactionStanding[];
  initialVips: Vip[];
  initialEntries: AnonymityEntry[];
  accessLevel: number;
}

export default function CampaignTrackers({
  initialStandings,
  initialVips,
  initialEntries,
  accessLevel,
}: Props) {
  const [standings, setStandings] = useState(initialStandings);
  const [vips, setVips] = useState(initialVips);
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TrackerTab>("standings");
  // Null is the resting board: three covers, no section claiming the row.
  const [openCategory, setOpenCategory] = useState<FactionCategory | null>(null);
  const stacked = useStackedSections();

  // Standings and integrity are GM state; the anonymity log is open to all.
  // Mirrors `can()` in lib/campaign/service.ts, which is what actually enforces
  // it — this only decides whether the controls are offered.
  const canEditTrackers = accessLevel >= 127;

  // One tab per VIP the server sent. It already filtered by access level, so
  // there is nothing to hide here — a restricted subject simply is not in the
  // list for anyone who may not see it.
  const tabs: TabSpec[] = [
    { id: "standings", title: "Diplomatic Standing", accent: "#a5b4fc" },
    ...vips.map((vip): TabSpec => {
      const tier = integrityTier(countIntact(vip.cells));
      return {
        id: `${VIP_TAB_PREFIX}${vip.slug}`,
        title: vip.dossier.name,
        accent: tier.color,
        alarm: tier.alarm,
        restricted: vip.minAccessLevel > 0,
      };
    }),
  ];

  // Hidden factions are dropped from the board and listed below instead —
  // they are only ever in `standings` at all for someone who can unhide them.
  const withheld: FactionStanding[] = [];
  const shown: FactionStanding[] = [];
  for (const s of standings) (s.hidden ? withheld : shown).push(s);
  withheld.sort((a, b) => a.name.localeCompare(b.name));

  const activeVipIndex = tab.startsWith(VIP_TAB_PREFIX)
    ? vips.findIndex((v) => v.slug === tab.slice(VIP_TAB_PREFIX.length))
    : -1;
  const activeVip = activeVipIndex >= 0 ? vips[activeVipIndex] : null;

  // The row is one height, whichever section has the floor: the height the
  // fullest section needs when it is open. Opening one must not shove the page
  // around, and three covers of different heights would not read as thirds.
  //
  // A card slot is 10rem wide by 4:7, plus the overhang its crest stands in —
  // 21rem all told — and six of them fit an open panel at the desktop
  // measure. Narrower than that they wrap, and the card area scrolls rather
  // than the row growing.
  //
  // The 15rem on top is the section's own chrome, the room a card needs to be
  // picked up — hovering lifts it and pushes its crest higher still, and the
  // panel clips what it cannot hold — and the standing the covers want: a
  // shut section is mostly its cover, and a cramped one reads as a header.
  const fullest = Math.max(
    1,
    ...FACTION_CATEGORIES.map((cat) => shown.filter((s) => s.category === cat.key).length),
  );
  const bandHeight = `calc(${Math.ceil(fullest / 6)} * 21rem + 15rem)`;

  // Clicking off the board puts the sections back to thirds — the same gesture
  // as clicking the open one shut. Escape does it from the keyboard. The
  // listener only exists while a section is open, so the resting page carries
  // nothing on the document.
  const bandRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openCategory === null) return;

    const dismiss = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      // A faction's modal is portalled to the body, so by the DOM it is outside
      // the board — but clicking inside it is not "clicking off the board", and
      // the section it was opened from has to still be there behind it.
      if (target?.closest('[role="dialog"]')) return;
      if (!bandRef.current?.contains(target)) setOpenCategory(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A faction's modal is on top and takes the key first; the section it was
      // opened from stays open behind it, and a second Escape closes that.
      if (document.querySelector('[role="dialog"]')) return;
      setOpenCategory(null);
    };

    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [openCategory]);

  /* ------------------------------------------------------------- writes */

  // Every mutation replaces local state from the server's response rather than
  // guessing at it, so a rejected write leaves the board showing what is
  // actually stored.
  const patchStanding = useCallback(
    async (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => {
      setError(null);
      const res = await fetch(`/api/campaign/standings/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save that standing");
        return;
      }
      setStandings((prev) => prev.map((s) => (s.slug === slug ? data.standing : s)));
    },
    [],
  );

  const toggleCell = useCallback(async (slug: string, index: number, intact: boolean) => {
    setError(null);
    // One cell per request, by index — the server flips that bit in SQL, so two
    // GMs toggling different cells at once cannot overwrite each other.
    const res = await fetch(`/api/campaign/vips/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cell: index, intact }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not save that cell");
      return;
    }
    setVips((prev) => prev.map((v) => (v.slug === slug ? data.vip : v)));
  }, []);

  const setLocked = useCallback(async (slug: string, locked: boolean) => {
    setError(null);
    const res = await fetch(`/api/campaign/vips/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not change who can see this subject");
      return;
    }
    setVips((prev) => prev.map((v) => (v.slug === slug ? data.vip : v)));
  }, []);

  const setBlurb = useCallback(async (slug: string, blurb: string) => {
    setError(null);
    const res = await fetch(`/api/campaign/vips/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blurb }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not save the description");
      return;
    }
    setVips((prev) => prev.map((v) => (v.slug === slug ? data.vip : v)));
  }, []);

  const setTagline = useCallback(async (slug: string, tagline: string) => {
    setError(null);
    const res = await fetch(`/api/campaign/vips/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagline }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not save the tagline");
      return;
    }
    setVips((prev) => prev.map((v) => (v.slug === slug ? data.vip : v)));
  }, []);

  const addEntry = useCallback(async (vipSlug: string, kind: AnonymityKind, text: string) => {
    setError(null);
    const res = await fetch(`/api/campaign/vips/${vipSlug}/anonymity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, text }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not add that line");
      return;
    }
    setEntries((prev) => [...prev, data.entry]);
  }, []);

  const saveEntry = useCallback(async (id: number, text: string) => {
    setError(null);
    const res = await fetch(`/api/campaign/anonymity/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not save that line");
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? data.entry : e)));
  }, []);

  const deleteEntry = useCallback(async (id: number) => {
    setError(null);
    const res = await fetch(`/api/campaign/anonymity/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete that line");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /* -------------------------------------------------------------- render */

  return (
    // Wider than the rest of the app on purpose: the standing scale is a row of
    // columns and every rung it cannot fit becomes a scrollbar. The panels that
    // were drawn for the old measure keep it, below.
    <main className="relative z-10 mx-auto w-full max-w-[84rem] px-5 sm:px-8 pb-24">
      {/* ── Hero ── */}
      <section className="ct-reveal pt-10 sm:pt-14 pb-7 sm:pb-9 text-center">
        {/* The eyebrow carries the page on its own now — a size up from the one
            it was, and the heading proper, since nothing sits above it. */}
        <h1
          className="text-[13px] sm:text-[15px] tracking-[0.5em] uppercase text-white/65"
          style={{ ...cinzel, textShadow: "0 0 28px rgba(129,140,248,0.25)" }}
        >
          Campaign Data
        </h1>

        <div className="mt-4 flex items-center justify-center gap-3" aria-hidden>
          <span className="ct-rule h-px w-16 sm:w-28 bg-gradient-to-r from-transparent to-indigo-400/40 origin-right" />
          <span className="w-1.5 h-1.5 rotate-45 border border-indigo-400/50" />
          <span className="ct-rule h-px w-16 sm:w-28 bg-gradient-to-l from-transparent to-indigo-400/40 origin-left" />
        </div>


      </section>

      {error && (
        <div
          role="alert"
          className="mb-8 rounded-lg border border-red-500/30 bg-red-950/25 px-4 py-2.5 text-center text-[11px] tracking-[0.1em] text-red-200/80"
        >
          {error}
        </div>
      )}

      {/* ── Register tabs ── */}
      <div className="ct-reveal" style={{ animationDelay: "120ms" }}>
        <TrackerTabs tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      {/* Keyed on the tab so the panel replays its entrance on every switch. */}
      <section
        key={tab}
        role="tabpanel"
        className="ct-reveal mt-8"
        style={{ animationDelay: "60ms" }}
      >
        {activeVip ? (
          <div className="mx-auto max-w-6xl">
            <p className="mb-6 text-[11px] tracking-[0.08em] text-white/50">
              Integrity, and the record of who has seen through them.
              {canEditTrackers && " Click a cell to toggle it."}
            </p>

            <VipPanel
              vip={activeVip}
              editable={canEditTrackers}
              onToggleCell={(index, intact) =>
                void toggleCell(activeVip.slug, index, intact)
              }
              onSetLocked={(locked) => setLocked(activeVip.slug, locked)}
              onSetBlurb={(blurb) => setBlurb(activeVip.slug, blurb)}
              onSetTagline={(tagline) => setTagline(activeVip.slug, tagline)}
            />

            <div className="mt-10">
              <SectionHeader
                numeral={`${String(activeVipIndex + 2).padStart(2, "0")}\u00b7A`}
                title="Anonymity Log"
                caption="Open board — any crew member who can see this subject may add, correct, or strike a line."
                meta={`${entries.filter((e) => e.vipSlug === activeVip.slug).length} entries`}
              />
              <AnonymityLog
                vipSlug={activeVip.slug}
                entries={entries.filter((e) => e.vipSlug === activeVip.slug)}
                onAdd={addEntry}
                onSave={saveEntry}
                onDelete={deleteEntry}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Three sections, side by side. At rest each holds a third of
                the row behind its cover; opening one gives it the floor and
                puts the other two down to a labelled sliver. One at a time —
                clicking the open one shuts it and the thirds come back. */}
            <div
              ref={bandRef}
              className="flex items-stretch gap-3 sm:gap-4"
              // Stacked, each band takes the height it needs and the page grows;
              // in a row they share one height, sized for the fullest section.
              style={stacked ? { flexDirection: "column" } : { height: bandHeight }}
            >
              {FACTION_CATEGORIES.map((cat) => (
                <CategoryPanel
                  key={cat.key}
                  category={cat.key}
                  label={cat.label}
                  standings={shown.filter((s) => s.category === cat.key)}
                  open={openCategory === cat.key}
                  collapsed={openCategory !== null && openCategory !== cat.key}
                  stacked={stacked}
                  onToggle={() => setOpenCategory(openCategory === cat.key ? null : cat.key)}
                  editable={canEditTrackers}
                  onChange={patchStanding}
                />
              ))}
            </div>

            {canEditTrackers && withheld.length > 0 && (
              <div className="mt-14">
                <SectionHeader
                  numeral="01·W"
                  title="Withheld"
                  caption="Kept off the board — no one below your access level sees these, on the page or over MCP."
                  meta={`${withheld.length} ${withheld.length === 1 ? "faction" : "factions"}`}
                />
                <ul className="divide-y divide-white/5 border-y border-white/[0.07]">
                  {withheld.map((standing) => (
                    <WithheldRow
                      key={standing.slug}
                      standing={standing}
                      onChange={patchStanding}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

    </main>
  );
}

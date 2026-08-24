"use client";

import { useCallback, useState } from "react";
import type {
  AnonymityEntry,
  AnonymityKind,
  FactionStanding,
  Vip,
} from "@/types/campaign";
import { countIntact, integrityTier } from "@/lib/campaign/integrity";
import { standingVerdict } from "@/lib/campaign/standing";
import FactionStandingCard from "./FactionStandingCard";
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

const VIP_TAB_PREFIX = "vip:";

/** Dimmer than the card palette: these lines sit under the columns, not in them. */
const WITHHELD_TONE: Record<string, string> = {
  hostile: "rgba(252,165,165,0.7)",
  friendly: "rgba(110,231,183,0.7)",
  neutral: "rgba(255,255,255,0.35)",
};

/**
 * One standing column.
 *
 * The three read as a balance: antagonism on the left, regard on the right,
 * and whatever has not tipped either way held in the middle. A faction's side
 * is the whole point of the layout, so it is decided by the same
 * `standingVerdict` tone that colours the card — the column and the word on
 * the card can never disagree.
 */
function StandingColumn({
  title,
  accent,
  standings,
  editable,
  onChange,
}: {
  title: string;
  accent: string;
  standings: FactionStanding[];
  editable: boolean;
  onChange: (slug: string, fields: { red?: number; green?: number; hidden?: boolean }) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1">
        <span
          className="text-[9px] tracking-[0.3em] uppercase whitespace-nowrap"
          style={{ ...cinzel, color: accent }}
        >
          {title}
        </span>
        <span
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, ${accent}40, transparent)` }}
        />
      </div>

      {standings.length === 0 ? (
        <p className="px-1 text-[11px] italic text-white/40">None.</p>
      ) : (
        // Two cards to a row, so a column reads as a dealt hand and the cards
        // keep their playing-card size instead of stretching to the column.
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {standings.map((standing) => (
            <FactionStandingCard
              key={standing.slug}
              standing={standing}
              editable={editable}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

  // Which side a faction sits on. Strongest first within each column, so the
  // extremes sit at the top of the page where they are read first.
  const grouped = {
    hostile: [] as FactionStanding[],
    neutral: [] as FactionStanding[],
    friendly: [] as FactionStanding[],
  };
  // Hidden factions are dropped from the columns and listed below instead —
  // they are only ever in `standings` at all for someone who can unhide them.
  const withheld: FactionStanding[] = [];
  for (const s of standings) {
    if (s.hidden) withheld.push(s);
    else grouped[standingVerdict(s.red, s.green).tone].push(s);
  }
  withheld.sort((a, b) => a.name.localeCompare(b.name));
  grouped.hostile.sort((a, b) => b.red - a.red || a.name.localeCompare(b.name));
  grouped.friendly.sort((a, b) => b.green - a.green || a.name.localeCompare(b.name));
  grouped.neutral.sort((a, b) => b.red + b.green - (a.red + a.green) || a.name.localeCompare(b.name));

  const activeVipIndex = tab.startsWith(VIP_TAB_PREFIX)
    ? vips.findIndex((v) => v.slug === tab.slice(VIP_TAB_PREFIX.length))
    : -1;
  const activeVip = activeVipIndex >= 0 ? vips[activeVipIndex] : null;

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
    <main className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 pb-24">
      {/* ── Hero ── */}
      <section className="ct-reveal pt-12 sm:pt-16 pb-10 sm:pb-12 text-center">
        <span className="text-[9px] tracking-[0.5em] uppercase text-white/45" style={cinzel}>
          Campaign Register
        </span>

        <h1
          className="mt-4 text-3xl sm:text-5xl tracking-[0.28em] sm:tracking-[0.34em] uppercase text-white/90"
          style={{ ...cinzel, textShadow: "0 0 40px rgba(129,140,248,0.28)" }}
        >
          Trackers
        </h1>

        <div className="mt-5 flex items-center justify-center gap-3" aria-hidden>
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
          <>
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
          </>
        ) : (
          <>
            <p className="mb-6 text-[11px] tracking-[0.08em] text-white/50">
              How each power of the sector reads the party.
              {canEditTrackers && " Click a cell to set it."}
            </p>

            <div className="grid gap-8 md:gap-4 lg:gap-6 md:grid-cols-3 items-start">
              <StandingColumn
                title="Antagonism"
                accent="#fca5a5"
                standings={grouped.hostile}
                editable={canEditTrackers}
                onChange={patchStanding}
              />
              <StandingColumn
                title="Unaligned"
                accent="rgba(255,255,255,0.35)"
                standings={grouped.neutral}
                editable={canEditTrackers}
                onChange={patchStanding}
              />
              <StandingColumn
                title="Regard"
                accent="#6ee7b7"
                standings={grouped.friendly}
                editable={canEditTrackers}
                onChange={patchStanding}
              />
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

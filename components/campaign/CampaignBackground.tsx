// The campaign page's own backdrop: an Imperial network with light running
// along it, rather than another starfield.
//
// It is deliberately not the shared StarSystemBackground or the home art —
// this page is about custodians holding networks together, so the background
// is a network. Everything is inert SVG plus CSS keyframes (see the
// "Campaign background" block in globals.css); no rAF loop, no React state, and
// nothing here re-renders when the page does.
//
// Coordinates are a fixed 1600x900 field stretched with `slice`, so the mesh
// crops rather than distorts at any aspect ratio.

const W = 1600;
const H = 900;

/** Network nodes. Hand-placed to spread weight across the field. */
const NODES: { x: number; y: number; r: number }[] = [
  { x: 140, y: 170, r: 4 },
  { x: 430, y: 90, r: 3 },
  { x: 700, y: 250, r: 5 },
  { x: 980, y: 130, r: 3.5 },
  { x: 1290, y: 210, r: 4.5 },
  { x: 1480, y: 430, r: 3 },
  { x: 1180, y: 520, r: 4 },
  { x: 860, y: 620, r: 5 },
  { x: 540, y: 470, r: 3.5 },
  { x: 210, y: 560, r: 4 },
  { x: 380, y: 790, r: 3 },
  { x: 720, y: 860, r: 3.5 },
  { x: 1080, y: 800, r: 4 },
  { x: 1420, y: 720, r: 3 },
];

/**
 * Links between nodes, as quadratic curves so the mesh reads as routed
 * conduits rather than a wireframe. `d` is drawn twice — once dim as the
 * conduit, once as a travelling pulse.
 */
const LINKS: { d: string; dur: number; delay: number }[] = [
  { d: "M140 170 Q290 90 430 90", dur: 7.5, delay: 0 },
  { d: "M430 90 Q570 150 700 250", dur: 9, delay: 1.2 },
  { d: "M700 250 Q840 150 980 130", dur: 8.2, delay: 2.6 },
  { d: "M980 130 Q1150 130 1290 210", dur: 10, delay: 0.6 },
  { d: "M1290 210 Q1430 300 1480 430", dur: 7.8, delay: 3.4 },
  { d: "M1480 430 Q1350 470 1180 520", dur: 9.4, delay: 1.8 },
  { d: "M1180 520 Q1020 540 860 620", dur: 8.6, delay: 4.2 },
  { d: "M860 620 Q700 560 540 470", dur: 11, delay: 2.2 },
  { d: "M540 470 Q350 490 210 560", dur: 8, delay: 5.1 },
  { d: "M210 560 Q160 380 140 170", dur: 12, delay: 0.9 },
  { d: "M540 470 Q620 380 700 250", dur: 7.2, delay: 3.9 },
  { d: "M210 560 Q280 690 380 790", dur: 9.8, delay: 1.4 },
  { d: "M380 790 Q550 850 720 860", dur: 8.8, delay: 4.7 },
  { d: "M720 860 Q900 840 1080 800", dur: 10.4, delay: 2.9 },
  { d: "M1080 800 Q1280 780 1420 720", dur: 7.6, delay: 5.6 },
  { d: "M1420 720 Q1470 580 1480 430", dur: 9.2, delay: 0.3 },
  { d: "M860 620 Q970 710 1080 800", dur: 8.4, delay: 3.1 },
  { d: "M700 250 Q780 440 860 620", dur: 11.5, delay: 1.7 },
  { d: "M1180 520 Q1240 620 1420 720", dur: 8.9, delay: 4.4 },
  { d: "M980 130 Q920 440 860 620", dur: 13, delay: 2.4 },
];

/** Concentric survey rings, drawn off-centre so they crop asymmetrically. */
function SurveyRings() {
  return (
    <g opacity="0.5">
      <g className="cbg-spin-cw" style={{ transformOrigin: "1150px 300px" }}>
        <circle
          cx="1150" cy="300" r="340"
          fill="none" stroke="#6366f1" strokeOpacity="0.14"
          strokeWidth="1" strokeDasharray="2 16"
        />
        <circle
          cx="1150" cy="300" r="250"
          fill="none" stroke="#818cf8" strokeOpacity="0.1"
          strokeWidth="1" strokeDasharray="40 18 6 18"
        />
      </g>
      <g className="cbg-spin-ccw" style={{ transformOrigin: "330px 660px" }}>
        <circle
          cx="330" cy="660" r="280"
          fill="none" stroke="#a78bfa" strokeOpacity="0.12"
          strokeWidth="1" strokeDasharray="3 20"
        />
        <circle
          cx="330" cy="660" r="185"
          fill="none" stroke="#6366f1" strokeOpacity="0.09"
          strokeWidth="1" strokeDasharray="30 14"
        />
      </g>
    </g>
  );
}

export default function CampaignBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: "#03020c" }}>
      {/* Nebula washes. Two blooms breathing out of phase keep the field from
          reading as a flat gradient. */}
      <div
        className="cbg-bloom absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 22% 28%, rgba(67,56,202,0.34) 0%, transparent 62%)," +
            "radial-gradient(55% 50% at 82% 72%, rgba(109,40,217,0.26) 0%, transparent 60%)",
        }}
      />
      <div
        className="cbg-bloom absolute inset-0"
        style={{
          animationDelay: "-11s",
          background:
            "radial-gradient(45% 40% at 68% 18%, rgba(14,116,144,0.2) 0%, transparent 58%)," +
            "radial-gradient(50% 45% at 12% 82%, rgba(30,27,75,0.4) 0%, transparent 60%)",
        }}
      />

      {/* Star layers, reusing the app's existing twinkle. */}
      <div className="space-stars absolute inset-0" style={{ opacity: 0.35 }} />
      <div
        className="space-stars absolute inset-0"
        style={{ opacity: 0.2, backgroundSize: "380px 380px", animationDelay: "3s" }}
      />

      {/* Hex weave, held well back. */}
      <div className="ct-weave absolute inset-0" style={{ opacity: 0.35 }} />

      {/* The network itself */}
      <svg
        className="cbg-drift absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <filter id="cbg-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="cbg-pulse" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>

        <SurveyRings />

        {/* Conduits */}
        <g fill="none" stroke="#6366f1" strokeOpacity="0.16" strokeWidth="1">
          {LINKS.map((l, i) => (
            <path key={`c${i}`} d={l.d} />
          ))}
        </g>

        {/* Light running along them. pathLength normalises every curve to 100
            so one keyframe set drives all of them. */}
        <g fill="none" stroke="url(#cbg-pulse)" strokeWidth="2.5" strokeLinecap="round" filter="url(#cbg-glow)">
          {LINKS.map((l, i) => (
            <path
              key={`p${i}`}
              d={l.d}
              pathLength={100}
              className="cbg-flow"
              style={{ animationDuration: `${l.dur}s`, animationDelay: `-${l.delay}s` }}
            />
          ))}
        </g>

        {/* Nodes */}
        <g>
          {NODES.map((n, i) => (
            <g key={`n${i}`}>
              <circle
                cx={n.x} cy={n.y} r={n.r * 3.2}
                fill="#818cf8" fillOpacity="0.07"
                className="cbg-node"
                style={{ animationDuration: `${4 + (i % 5)}s`, animationDelay: `-${i * 0.7}s` }}
              />
              <circle cx={n.x} cy={n.y} r={n.r} fill="#a5b4fc" fillOpacity="0.5" />
              <rect
                x={n.x - n.r * 2.1} y={n.y - n.r * 2.1}
                width={n.r * 4.2} height={n.r * 4.2}
                fill="none" stroke="#a5b4fc" strokeOpacity="0.22" strokeWidth="0.8"
                transform={`rotate(45 ${n.x} ${n.y})`}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Survey beam crossing the field */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 overflow-hidden">
        <div
          className="cbg-sweep h-full w-full"
          style={{
            background:
              "linear-gradient(100deg, transparent 0%, rgba(129,140,248,0.05) 45%, rgba(199,210,254,0.1) 50%, rgba(129,140,248,0.05) 55%, transparent 100%)",
          }}
        />
      </div>

      {/* Vignette — pulls the edges down so page text always has ground under it */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 30%, rgba(3,2,12,0.55) 78%, rgba(3,2,12,0.88) 100%)",
        }}
      />
    </div>
  );
}

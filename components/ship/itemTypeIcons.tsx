import type { ShipItemType } from "@/types/ship";

// ─── Cargo type icons ───

function GeneralIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a4 4 0 0 0-8 0v2" />
      <line x1="12" y1="11" x2="12" y2="15" />
    </svg>
  );
}

function OrdnanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 2 L14 8 L12 20 L10 8 Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M8 10 L12 20 L16 10" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

function PreciousIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" fill="currentColor" fillOpacity="0.08" />
      <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
    </svg>
  );
}

function ContrabandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fillOpacity="0.05" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M7 15 L10 12 L14 16 L17 13" strokeOpacity="0.5" />
      <circle cx="12" cy="2" r="1" fill="currentColor" fillOpacity="0.4" />
      <line x1="12" y1="3" x2="12" y2="5" strokeOpacity="0.4" />
    </svg>
  );
}

function MissionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" fillOpacity="0.05" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" strokeOpacity="0.5" />
      <line x1="9" y1="17" x2="13" y2="17" strokeOpacity="0.4" />
      <circle cx="17" cy="17" r="4" fill="currentColor" fillOpacity="0.1" stroke="currentColor" />
      <path d="M17 15 L17 17 L19 17" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Isolation type icons ───

function BiogenicSeedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <ellipse cx="12" cy="10" rx="5" ry="7" fill="currentColor" fillOpacity="0.08" />
      <ellipse cx="12" cy="10" rx="5" ry="7" />
      <path d="M12 17 L12 22" />
      <path d="M9 20 L12 17 L15 20" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" fillOpacity="0.2" />
      <path d="M10 11 Q12 13 14 11" strokeOpacity="0.4" />
    </svg>
  );
}

function LiveSpecimenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.05" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 7 L12 3" strokeOpacity="0.4" />
      <path d="M12 21 L12 17" strokeOpacity="0.4" />
      <path d="M7 12 L3 12" strokeOpacity="0.4" />
      <path d="M21 12 L17 12" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 2" strokeOpacity="0.25" />
    </svg>
  );
}

function CadaverIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.05" />
      <circle cx="12" cy="8" r="4" />
      <line x1="10" y1="7" x2="10" y2="7.01" strokeWidth="2" />
      <line x1="14" y1="7" x2="14" y2="7.01" strokeWidth="2" />
      <path d="M10 9.5 L14 9.5" strokeOpacity="0.5" />
      <path d="M12 12 L12 18" />
      <path d="M8 14 L16 14" />
      <path d="M10 18 L12 22" strokeOpacity="0.5" />
      <path d="M14 18 L12 22" strokeOpacity="0.5" />
    </svg>
  );
}

function ExcisedTissueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M9 3 L15 3 L18 8 L18 19 Q18 21 15 21 L9 21 Q6 21 6 19 L6 8 Z" fill="currentColor" fillOpacity="0.05" />
      <path d="M9 3 L15 3 L18 8 L18 19 Q18 21 15 21 L9 21 Q6 21 6 19 L6 8 Z" />
      <path d="M6 8 L18 8" strokeOpacity="0.3" />
      <ellipse cx="12" cy="14" rx="3" ry="3.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M11 13 Q12 15 13 13" strokeOpacity="0.4" strokeWidth="1" />
    </svg>
  );
}

function PhytosampleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M12 22 L12 10" />
      <path d="M12 10 Q6 8 5 3 Q11 5 12 10" fill="currentColor" fillOpacity="0.08" />
      <path d="M12 10 Q6 8 5 3 Q11 5 12 10" />
      <path d="M12 14 Q18 12 19 7 Q13 9 12 14" fill="currentColor" fillOpacity="0.08" />
      <path d="M12 14 Q18 12 19 7 Q13 9 12 14" />
      <path d="M12 17 Q7 16 6 12 Q11 13 12 17" fill="currentColor" fillOpacity="0.06" />
      <path d="M12 17 Q7 16 6 12 Q11 13 12 17" strokeOpacity="0.6" />
    </svg>
  );
}

export const ITEM_TYPE_ICONS: Record<ShipItemType, () => React.JSX.Element> = {
  // Cargo
  general: GeneralIcon,
  ordnance: OrdnanceIcon,
  precious: PreciousIcon,
  contraband: ContrabandIcon,
  mission: MissionIcon,
  // Isolation
  "biogenic-seed": BiogenicSeedIcon,
  "live-specimen": LiveSpecimenIcon,
  cadaver: CadaverIcon,
  "excised-tissue": ExcisedTissueIcon,
  phytosample: PhytosampleIcon,
};

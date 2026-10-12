/* Site-wide data. Copy here is the approved v10 copy (12 Oct); change it only after messaging sign-off. */

export interface NavLink { label: string; href: string; soon?: boolean }

/* About us and Careers are listed but not built yet */
export const NAV_LINKS: NavLink[] = [
  { label: "About us", href: "#", soon: true },
  { label: "Careers", href: "#", soon: true },
];

export const FOOTER_LINKS: NavLink[] = [
  { label: "Home", href: "#top" },
  { label: "About us", href: "#", soon: true },
  { label: "Careers", href: "#", soon: true },
  { label: "Request access", href: "#briefing" },
];

export interface Tile {
  date: string;
  datetime: string;
  fig: "stack" | "arc" | "grid" | "meter";
  num: string;
  line: string;
  source: { label: string; href: string };
  nowrap?: boolean;
}

export const TILES: Tile[] = [
  {
    date: "JUL 2026", datetime: "2026-07", fig: "stack", num: "~2,500",
    line: "high and critical vulnerabilities published in one month. Five times the earlier record.",
    source: { label: "Epoch AI", href: "https://epoch.ai/data-insights" },
  },
  {
    date: "JUL 2026", datetime: "2026-07", fig: "arc", num: "One weekend", nowrap: true,
    line: "for an autonomous AI agent to move through Hugging Face's systems.",
    /* TODO: Hugging Face source URL (carried over from an earlier draft; confirm before launch) */
    source: { label: "Hugging Face", href: "https://huggingface.co/blog/security-incident-july-2026" },
  },
  {
    date: "APR 2026", datetime: "2026-04", fig: "grid", num: "3 of 10",
    line: "attempts where a frontier AI model completed a simulated corporate network attack end to end, with no active defenders.",
    source: { label: "UK AISI", href: "https://www.aisi.gov.uk/blog/our-evaluation-of-claude-mythos-previews-cyber-capabilities" },
  },
  {
    date: "NOV 2025", datetime: "2025-11", fig: "meter", num: "80–90%",
    line: "of a state-sponsored espionage campaign was run by AI.",
    source: { label: "Anthropic", href: "https://www.anthropic.com/news/disrupting-AI-espionage" },
  },
];

export const TRAITS = [
  { word: "Fast", line: "Attacks run at machine speed, with very little human involvement." },
  { word: "Large-scale", line: "Many attack surfaces are hit at the same time, and each failed attempt costs almost nothing." },
  { word: "Persistent", line: "They keep going day and night, and they are harder to detect and contain." },
];

export const ROLES = [
  "Security leader",
  "Security practitioner",
  "Risk or compliance",
  "Investor",
  "Security researcher",
  "Press",
  "Other",
];

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IconTrain = (p: P) => (
  <svg {...base(p)}><path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12" /></svg>
);
export const IconRoutines = (p: P) => (
  <svg {...base(p)}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
);
export const IconBody = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="4.5" r="2" /><path d="M6 9l6 1 6-1M12 10v5M9 21l3-6 3 6" /></svg>
);
export const IconProgress = (p: P) => (
  <svg {...base(p)}><path d="M3 20h18M4 16l5-5 4 3 7-8" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconUp = (p: P) => (
  <svg {...base(p)}><path d="M6 15l6-6 6 6" /></svg>
);
export const IconDown = (p: P) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
);
export const IconMore = (p: P) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconBolt = (p: P) => (
  <svg {...base(p)}><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.6 3-5.6 4-9 2 1.3 3 3.2 3 5 1-.5 1.8-1.5 2-2.8 1.6 1.5 4 3.8 4 6.8 0 3.4-2.6 6-6.5 6z" /></svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
);
export const IconHistory = (p: P) => (
  <svg {...base(p)}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4h4" /><path d="M12 8v4.5l3 2" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
);
export const IconTimer = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M10 2h4" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" stroke="none" /></svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)}><path d="M8 5v14M16 5v14" strokeWidth={3} /></svg>
);
export const IconReset = (p: P) => (
  <svg {...base(p)}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>
);
export const IconNote = (p: P) => (
  <svg {...base(p)}><path d="M5 4h14v11l-5 5H5V4zM14 20v-5h5M8.5 9h7M8.5 12.5h4" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
);
export const IconStack = (p: P) => (
  <svg {...base(p)}><rect x="6" y="3.5" width="12" height="4" rx="1" /><rect x="6" y="10" width="12" height="4" rx="1" /><rect x="6" y="16.5" width="12" height="4" rx="1" /><path d="M12 1.5v2M12 7.5v2.5M12 14v2.5" /></svg>
);
export const IconScale = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="4" width="17" height="16" rx="4" /><path d="M8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.6-2" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);

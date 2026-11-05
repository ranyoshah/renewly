export const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "#2f6f8f",
  Design: "#c0567a",
  Productivity: "#6f7f2a",
  Communication: "#7a5ab8",
  "Sales & CRM": "#c7792b",
  Marketing: "#c99a12",
  "Data & Analytics": "#2e8c7a",
  "Finance & HR": "#8a6d55",
  "Security & IT": "#4b5a73",
  "AI tools": "#9b4bb0",
  "Cloud & Hosting": "#3d86c6",
  Other: "#9aa3b0",
};

export function catColor(c: string) {
  return CATEGORY_COLORS[c] ?? CATEGORY_COLORS.Other;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function niceDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
export function dayMonth(d: string) {
  const [, m, day] = d.split("-").map(Number);
  return { day, month: MONTHS[m - 1] };
}

export function timeAgo(t: Date) {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function originFrom(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

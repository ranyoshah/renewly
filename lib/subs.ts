// Core business logic. Plain code only: no AI, no external calls.
import { newKey, ready, sql } from "./db";
import type { Workspace } from "./auth";

export const CATEGORIES = [
  "Engineering",
  "Design",
  "Productivity",
  "Communication",
  "Sales & CRM",
  "Marketing",
  "Data & Analytics",
  "Finance & HR",
  "Security & IT",
  "AI tools",
  "Cloud & Hosting",
  "Other",
] as const;
const OVERLAP_CATEGORIES = ["Design", "Communication", "Productivity", "Sales & CRM", "Marketing", "Data & Analytics", "AI tools"];
export const CYCLES = ["monthly", "quarterly", "annual", "weekly"] as const;
export const STATUSES = ["active", "cancelling", "cancelled"] as const;

// Fixed, approximate conversion rates into INR. Used only to show totals in one currency.
export const FX_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 88,
  EUR: 102,
  GBP: 117,
  SGD: 68,
  AED: 24,
  AUD: 58,
};
export const CURRENCIES = Object.keys(FX_TO_INR);

export type Category = (typeof CATEGORIES)[number];
export type Cycle = (typeof CYCLES)[number];
export type Status = (typeof STATUSES)[number];

export type Sub = {
  id: string;
  workspace_id: string;
  vendor: string;
  plan: string | null;
  category: string;
  amount: number;
  currency: string;
  billing_cycle: Cycle;
  next_renewal: string | null;
  owner: string | null;
  seats: number | null;
  status: Status;
  notes: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
};

export type SubInput = {
  vendor: string;
  plan?: string | null;
  category?: string | null;
  amount: number;
  currency?: string | null;
  billing_cycle?: string | null;
  next_renewal?: string | null;
  last_charged?: string | null;
  owner?: string | null;
  seats?: number | null;
  status?: string | null;
  notes?: string | null;
};

export type Actor = "claude" | "person";

// ---------- helpers ----------

export function vendorKey(name: string) {
  return name.toLowerCase().replace(/\.(com|io|ai|app|so|co)$/g, "").replace(/[^a-z0-9]/g, "");
}

// Dates are calculated in Indian Standard Time.
export const APP_TZ = "Asia/Kolkata";
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function validDate(d?: string | null) {
  return !!d && DATE_RE.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z"));
}

function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addCycle(date: string, cycle: Cycle, times = 1) {
  if (cycle === "weekly") {
    const t = new Date(date + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() + 7 * times);
    return t.toISOString().slice(0, 10);
  }
  const months = cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12;
  return addMonths(date, months * times);
}

/** The next renewal on or after today, rolling a past date forward by whole billing cycles. */
export function upcomingRenewal(s: Pick<Sub, "next_renewal" | "billing_cycle" | "status">, from = today()) {
  if (!s.next_renewal || s.status === "cancelled") return null;
  let d = s.next_renewal;
  let guard = 0;
  while (d < from && guard++ < 600) d = addCycle(s.next_renewal, s.billing_cycle, guard);
  return d;
}

export function daysUntil(date: string, from = today()) {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

export function convert(amount: number, from: string, to: string) {
  const a = FX_TO_INR[from] ?? 1;
  const b = FX_TO_INR[to] ?? 1;
  return (amount * a) / b;
}

export function monthlyCost(s: Pick<Sub, "amount" | "billing_cycle">) {
  switch (s.billing_cycle) {
    case "annual":
      return s.amount / 12;
    case "quarterly":
      return s.amount / 3;
    case "weekly":
      return (s.amount * 52) / 12;
    default:
      return s.amount;
  }
}

export function monthlyIn(s: Sub, base: string) {
  return convert(monthlyCost(s), s.currency, base);
}

export function money(amount: number, currency: string, opts: { compact?: boolean } = {}) {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: opts.compact || Math.abs(amount) >= 1000 ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  }).format(amount);
}

const cycleWord: Record<Cycle, string> = { monthly: "mo", quarterly: "qtr", annual: "yr", weekly: "wk" };
export function priceLabel(s: Pick<Sub, "amount" | "currency" | "billing_cycle">) {
  return `${money(s.amount, s.currency)}/${cycleWord[s.billing_cycle]}`;
}

function clean(s?: string | null) {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function normCategory(c?: string | null): string {
  if (!c) return "Other";
  const hit = CATEGORIES.find((x) => x.toLowerCase() === c.trim().toLowerCase());
  return hit ?? "Other";
}

function normCycle(c?: string | null): Cycle {
  const v = (c ?? "").toLowerCase();
  if (v.startsWith("ann") || v.startsWith("year") || v === "yearly") return "annual";
  if (v.startsWith("quar")) return "quarterly";
  if (v.startsWith("week")) return "weekly";
  return "monthly";
}

function normStatus(s?: string | null): Status {
  const v = (s ?? "").toLowerCase();
  return (STATUSES as readonly string[]).includes(v) ? (v as Status) : "active";
}

function normCurrency(c: string | null | undefined, fallback: string) {
  const v = (c ?? "").toUpperCase().trim();
  return FX_TO_INR[v] ? v : fallback;
}

function rowToSub(r: Record<string, unknown>): Sub {
  return { ...(r as unknown as Sub), amount: Number(r.amount), seats: r.seats == null ? null : Number(r.seats) };
}

// ---------- activity ----------

export async function logActivity(
  wsId: string,
  actor: Actor,
  action: string,
  vendor: string | null,
  subscriptionId: string | null,
  detail?: string,
) {
  await sql()`insert into activity (workspace_id, subscription_id, vendor, actor, action, detail)
    values (${wsId}, ${subscriptionId}, ${vendor}, ${actor}, ${action}, ${detail ?? null})`;
}

export type ActivityRow = {
  id: number;
  subscription_id: string | null;
  vendor: string | null;
  actor: Actor;
  action: string;
  detail: string | null;
  created_at: Date;
};

export async function listActivity(wsId: string, limit = 100, subscriptionId?: string) {
  await ready();
  if (subscriptionId) {
    return sql()<ActivityRow[]>`select * from activity where workspace_id = ${wsId} and subscription_id = ${subscriptionId}
      order by created_at desc, id desc limit ${limit}`;
  }
  return sql()<ActivityRow[]>`select * from activity where workspace_id = ${wsId} order by created_at desc, id desc limit ${limit}`;
}

// ---------- queries ----------

export async function listSubs(wsId: string) {
  await ready();
  const rows = await sql()`select * from subscriptions where workspace_id = ${wsId} order by lower(vendor)`;
  return rows.map(rowToSub);
}

export async function getSub(wsId: string, id: string) {
  await ready();
  const [r] = await sql()`select * from subscriptions where workspace_id = ${wsId} and id = ${id}`;
  return r ? rowToSub(r) : null;
}

export async function findSubByVendor(wsId: string, vendor: string) {
  const [r] = await sql()`select * from subscriptions where workspace_id = ${wsId} and vendor_key = ${vendorKey(vendor)}`;
  return r ? rowToSub(r) : null;
}

// ---------- writes ----------

const FIELDS = ["vendor", "plan", "category", "amount", "currency", "billing_cycle", "next_renewal", "owner", "seats", "status", "notes"] as const;
type Field = (typeof FIELDS)[number];

function describe(field: Field, v: unknown, s: Pick<Sub, "currency">) {
  if (v == null || v === "") return "—";
  if (field === "amount") return money(Number(v), s.currency);
  return String(v);
}

/** Normalise raw input into the columns we store. Only keys present in `input` are returned. */
function normalise(input: Partial<SubInput>, base: string, existing?: Sub) {
  const out: Partial<Record<Field, unknown>> = {};
  if (input.vendor !== undefined) out.vendor = input.vendor.trim();
  if (input.plan !== undefined) out.plan = clean(input.plan);
  if (input.category !== undefined) out.category = normCategory(input.category);
  if (input.amount !== undefined) {
    const n = Number(input.amount);
    if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be a positive number.");
    out.amount = Math.round(n * 100) / 100;
  }
  if (input.currency !== undefined) out.currency = normCurrency(input.currency, existing?.currency ?? base);
  if (input.billing_cycle !== undefined) out.billing_cycle = normCycle(input.billing_cycle);
  if (input.owner !== undefined) out.owner = clean(input.owner);
  if (input.notes !== undefined) out.notes = clean(input.notes);
  if (input.status !== undefined) out.status = normStatus(input.status);
  if (input.seats !== undefined) {
    const n = input.seats == null || (input.seats as unknown) === "" ? null : Math.round(Number(input.seats));
    out.seats = n != null && Number.isFinite(n) && n > 0 ? n : null;
  }
  if (input.next_renewal !== undefined) {
    if (input.next_renewal && !validDate(input.next_renewal)) throw new Error("Renewal date must be YYYY-MM-DD.");
    out.next_renewal = clean(input.next_renewal);
  }
  // If only the last charge date is known, the next renewal is one billing cycle later.
  if (!out.next_renewal && validDate(input.last_charged)) {
    const cycle = (out.billing_cycle as Cycle) ?? existing?.billing_cycle ?? "monthly";
    out.next_renewal = addCycle(input.last_charged!, cycle);
  }
  return out;
}

export async function createSub(ws: Workspace, input: SubInput, actor: Actor) {
  await ready();
  const n = normalise(input, ws.base_currency);
  if (!n.vendor) throw new Error("Vendor name is required.");
  const id = newKey(8);
  const [r] = await sql()`
    insert into subscriptions (id, workspace_id, vendor, vendor_key, plan, category, amount, currency, billing_cycle,
      next_renewal, owner, seats, status, notes, source)
    values (${id}, ${ws.id}, ${n.vendor as string}, ${vendorKey(n.vendor as string)}, ${(n.plan as string) ?? null},
      ${(n.category as string) ?? "Other"}, ${(n.amount as number) ?? 0}, ${(n.currency as string) ?? ws.base_currency},
      ${(n.billing_cycle as string) ?? "monthly"}, ${(n.next_renewal as string) ?? null}, ${(n.owner as string) ?? null},
      ${(n.seats as number) ?? null}, ${(n.status as string) ?? "active"}, ${(n.notes as string) ?? null}, ${actor})
    returning *`;
  const sub = rowToSub(r);
  await logActivity(ws.id, actor, "added", sub.vendor, sub.id, `${priceLabel(sub)} · ${sub.category}`);
  return sub;
}

export async function updateSub(ws: Workspace, id: string, patch: Partial<SubInput>, actor: Actor) {
  await ready();
  const existing = await getSub(ws.id, id);
  if (!existing) throw new Error("Subscription not found.");
  const n = normalise(patch, ws.base_currency, existing);
  // The form shows the rolled-forward renewal date; saving it unchanged is not a real edit.
  if (n.next_renewal && n.next_renewal === upcomingRenewal(existing)) delete n.next_renewal;
  const changes: string[] = [];
  const next = { ...existing } as Record<string, unknown>;
  for (const f of FIELDS) {
    if (!(f in n)) continue;
    const before = existing[f as keyof Sub];
    const after = n[f];
    if ((before ?? null) === (after ?? null) || (f === "amount" && Number(before) === Number(after))) continue;
    changes.push(`${f.replace("_", " ")}: ${describe(f, before, existing)} → ${describe(f, after, { currency: (n.currency as string) ?? existing.currency })}`);
    next[f] = after;
  }
  if (!changes.length) return { sub: existing, changes };
  const v = next as unknown as Sub;
  const [r] = await sql()`
    update subscriptions set vendor = ${v.vendor}, vendor_key = ${vendorKey(v.vendor)}, plan = ${v.plan}, category = ${v.category},
      amount = ${v.amount}, currency = ${v.currency}, billing_cycle = ${v.billing_cycle}, next_renewal = ${v.next_renewal},
      owner = ${v.owner}, seats = ${v.seats}, status = ${v.status}, notes = ${v.notes}, updated_at = now()
    where id = ${id} and workspace_id = ${ws.id} returning *`;
  const sub = rowToSub(r);
  const action = patch.status && n.status !== existing.status ? `marked ${n.status}` : "edited";
  await logActivity(ws.id, actor, action, sub.vendor, sub.id, changes.join("; "));
  return { sub, changes };
}

export async function deleteSub(ws: Workspace, id: string, actor: Actor) {
  const s = await getSub(ws.id, id);
  if (!s) return;
  await sql()`delete from subscriptions where id = ${id} and workspace_id = ${ws.id}`;
  await logActivity(ws.id, actor, "deleted", s.vendor, null, priceLabel(s));
}

/** Add many subscriptions at once. Vendors already tracked are updated instead of duplicated. */
export async function upsertSubs(ws: Workspace, items: SubInput[], actor: Actor) {
  const created: Sub[] = [];
  const updated: { sub: Sub; changes: string[] }[] = [];
  const errors: { vendor: string; error: string }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = vendorKey(item.vendor || "");
    if (!key) {
      errors.push({ vendor: item.vendor, error: "Missing vendor name" });
      continue;
    }
    if (seen.has(key)) {
      skipped.push(item.vendor); // same vendor twice in one batch: keep the first
      continue;
    }
    seen.add(key);
    try {
      const existing = await findSubByVendor(ws.id, item.vendor);
      if (existing) {
        const patch: Partial<SubInput> = {};
        // Keep the existing display name; only fill in or refresh the other fields.
        for (const [k, v] of Object.entries(item))
          if (k !== "vendor" && v !== undefined && v !== null && v !== "") (patch as Record<string, unknown>)[k] = v;
        updated.push(await updateSub(ws, existing.id, patch, actor));
      } else {
        created.push(await createSub(ws, item, actor));
      }
    } catch (e) {
      errors.push({ vendor: item.vendor, error: (e as Error).message });
    }
  }
  return { created, updated, errors, skipped };
}

export async function deleteAllSubs(ws: Workspace) {
  await sql()`delete from subscriptions where workspace_id = ${ws.id}`;
  await logActivity(ws.id, "person", "cleared all subscriptions", null, null);
}

// ---------- summary ----------

export function summarise(subs: Sub[], base: string, from = today()) {
  const live = subs.filter((s) => s.status !== "cancelled");
  const monthly = live.reduce((t, s) => t + monthlyIn(s, base), 0);

  const byCat = new Map<string, { category: string; monthly: number; count: number; vendors: string[] }>();
  for (const s of live) {
    const c = byCat.get(s.category) ?? { category: s.category, monthly: 0, count: 0, vendors: [] };
    c.monthly += monthlyIn(s, base);
    c.count += 1;
    c.vendors.push(s.vendor);
    byCat.set(s.category, c);
  }
  const categories = [...byCat.values()].sort((a, b) => b.monthly - a.monthly);

  const upcoming = live
    .map((s) => ({ sub: s, date: upcomingRenewal(s, from) }))
    .filter((x): x is { sub: Sub; date: string } => !!x.date && daysUntil(x.date, from) <= 30)
    .sort((a, b) => a.date.localeCompare(b.date));

  const cancelledSavings = subs.filter((s) => s.status === "cancelled").reduce((t, s) => t + monthlyIn(s, base), 0);

  return {
    base,
    monthly,
    annual: monthly * 12,
    activeCount: live.length,
    categories,
    upcoming,
    upcomingTotal: upcoming.reduce((t, u) => t + convert(u.sub.amount, u.sub.currency, base), 0),
    noOwner: live.filter((s) => !s.owner),
    noRenewalDate: live.filter((s) => !s.next_renewal),
    cancelling: subs.filter((s) => s.status === "cancelling"),
    // Categories where tools usually substitute for each other; Engineering or Cloud tools rarely do.
    overlaps: categories.filter((c) => c.count >= 2 && OVERLAP_CATEGORIES.includes(c.category)),
    cancelledSavings,
  };
}

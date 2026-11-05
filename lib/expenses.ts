// Monthly expenses by bucket. Plain code only: no AI, no external calls.
import { newKey, ready, sql } from "./db";
import type { Workspace } from "./auth";
import { DEMO_EMAIL } from "./brand";
import { convert, logActivity, money, validDate, vendorKey, type Actor } from "./subs";

export const BUCKETS = [
  "Tech & software",
  "Travel",
  "Meals & entertainment",
  "Office & admin",
  "Marketing",
  "Professional services",
  "Bank & card fees",
  "Other",
] as const;
export type Bucket = (typeof BUCKETS)[number];

// Made-up owners for the demo account only.
const DEMO_OWNERS: Partial<Record<Bucket, string>> = {
  "Tech & software": "Arjun Rao",
  Travel: "Meera Iyer",
  "Meals & entertainment": "Kabir Shah",
  "Office & admin": "Ananya Gupta",
  Marketing: "Rhea Kapoor",
  "Professional services": "Vikram Nair",
  "Bank & card fees": "Rohan Mehta",
};

export const BUCKET_COLORS: Record<string, string> = {
  "Tech & software": "#2f6f8f",
  Travel: "#c7792b",
  "Meals & entertainment": "#c0567a",
  "Office & admin": "#6f7f2a",
  Marketing: "#7a5ab8",
  "Professional services": "#2e8c7a",
  "Bank & card fees": "#4b5a73",
  Other: "#9aa3b0",
};
export const bucketColor = (b: string) => BUCKET_COLORS[b] ?? BUCKET_COLORS.Other;

export type BucketRow = { name: string; owner: string | null; sort: number };

export type Txn = {
  id: string;
  workspace_id: string;
  txn_date: string;
  merchant: string;
  description: string | null;
  amount: number;
  currency: string;
  bucket: string;
  notes: string | null;
  source: string;
  base_amount: number | null;
  base_currency: string | null;
  created_at: Date;
  updated_at: Date;
};

export type TxnInput = {
  date: string;
  merchant: string;
  description?: string | null;
  amount: number;
  currency?: string | null;
  bucket?: string | null;
  notes?: string | null;
  amount_in_home_currency?: number | null;
};

export function normBucket(b?: string | null): Bucket {
  const v = (b ?? "").trim().toLowerCase();
  if (!v) return "Other";
  const exact = BUCKETS.find((x) => x.toLowerCase() === v);
  if (exact) return exact;
  const first = BUCKETS.find((x) => x.toLowerCase().split(/[ &]+/)[0] === v.split(/[ &]+/)[0]);
  return first ?? "Other";
}

function rowToTxn(r: Record<string, unknown>): Txn {
  return { ...(r as unknown as Txn), amount: Number(r.amount), base_amount: r.base_amount == null ? null : Number(r.base_amount) };
}

function dedupeKey(date: string, merchant: string, amount: number, currency: string, description?: string | null) {
  return [date, vendorKey(description || merchant), amount.toFixed(2), currency].join("|");
}

// ---------- buckets ----------

export async function listBuckets(ws: Pick<Workspace, "id" | "email">) {
  await ready();
  let rows = await sql()<BucketRow[]>`select name, owner, sort from buckets where workspace_id = ${ws.id} order by sort`;
  if (!rows.length) {
    const demo = ws.email === DEMO_EMAIL;
    for (const [i, name] of BUCKETS.entries()) {
      await sql()`insert into buckets (workspace_id, name, owner, sort)
        values (${ws.id}, ${name}, ${demo ? DEMO_OWNERS[name] ?? null : null}, ${i}) on conflict do nothing`;
    }
    rows = await sql()<BucketRow[]>`select name, owner, sort from buckets where workspace_id = ${ws.id} order by sort`;
  }
  return rows;
}

export async function setBucketOwner(ws: Workspace, bucket: string, owner: string | null, actor: Actor) {
  const name = normBucket(bucket);
  const rows = await listBuckets(ws);
  const before = rows.find((r) => r.name === name)?.owner ?? null;
  const after = owner?.trim() || null;
  if (before === after) return { name, before, after, changed: false };
  await sql()`update buckets set owner = ${after} where workspace_id = ${ws.id} and name = ${name}`;
  await logActivity(ws.id, actor, "set bucket owner", name, null, `owner: ${before ?? "—"} → ${after ?? "—"}`);
  return { name, before, after, changed: true };
}

// ---------- transactions ----------

function normaliseTxn(input: Partial<TxnInput>, base: string) {
  const out: Record<string, unknown> = {};
  if (input.date !== undefined) {
    if (!validDate(input.date)) throw new Error("Date must be YYYY-MM-DD.");
    out.txn_date = input.date;
  }
  if (input.merchant !== undefined) {
    const m = input.merchant.trim();
    if (!m) throw new Error("Merchant is required.");
    out.merchant = m.slice(0, 120);
  }
  if (input.description !== undefined) out.description = input.description?.trim() || null;
  if (input.amount !== undefined) {
    const n = Number(input.amount);
    if (!Number.isFinite(n)) throw new Error("Amount must be a number.");
    out.amount = Math.round(n * 100) / 100;
  }
  if (input.currency !== undefined) {
    const c = (input.currency ?? "").toUpperCase().trim();
    out.currency = c && /^[A-Z]{3}$/.test(c) ? c : base;
  }
  if (input.bucket !== undefined) out.bucket = normBucket(input.bucket);
  if (input.notes !== undefined) out.notes = input.notes?.trim() || null;
  return out;
}

export async function addTransactions(ws: Workspace, items: TxnInput[], actor: Actor) {
  await ready();
  await listBuckets(ws);
  const added: Txn[] = [];
  const duplicates: string[] = [];
  const errors: { merchant: string; error: string }[] = [];
  for (const item of items) {
    try {
      const n = normaliseTxn({ ...item, currency: item.currency ?? ws.base_currency, bucket: item.bucket ?? "Other" }, ws.base_currency);
      if (!n.txn_date || !n.merchant || n.amount === undefined) throw new Error("Date, merchant and amount are required.");
      const home = item.amount_in_home_currency;
      const baseAmt = n.currency === ws.base_currency ? null : home != null && Number.isFinite(Number(home)) ? Math.round(Number(home) * 100) / 100 : null;
      const key = dedupeKey(n.txn_date as string, n.merchant as string, n.amount as number, n.currency as string, n.description as string | null);
      const rows = await sql()`
        insert into transactions (id, workspace_id, txn_date, merchant, description, amount, currency, bucket, notes, source, dedupe_key, base_amount, base_currency)
        values (${newKey(8)}, ${ws.id}, ${n.txn_date as string}, ${n.merchant as string}, ${(n.description as string) ?? null},
          ${n.amount as number}, ${n.currency as string}, ${n.bucket as string}, ${(n.notes as string) ?? null}, ${actor}, ${key},
          ${baseAmt}, ${baseAmt == null ? null : ws.base_currency})
        on conflict (workspace_id, dedupe_key) do nothing
        returning *`;
      if (rows.length) added.push(rowToTxn(rows[0]));
      else duplicates.push(`${n.merchant} ${n.txn_date}`);
    } catch (e) {
      errors.push({ merchant: item.merchant, error: (e as Error).message });
    }
  }
  if (added.length) {
    const months = [...new Set(added.map((t) => t.txn_date.slice(0, 7)))].map(monthLabel).join(", ");
    await logActivity(ws.id, actor, `added ${added.length} transactions`, months, null,
      added.slice(0, 6).map((t) => t.merchant).join(", ") + (added.length > 6 ? ` and ${added.length - 6} more` : ""));
  }
  return { added, duplicates, errors };
}

export async function listMonths(wsId: string) {
  await ready();
  const rows = await sql()<{ m: string }[]>`
    select distinct substr(txn_date, 1, 7) as m from transactions where workspace_id = ${wsId} order by m desc`;
  return rows.map((r) => r.m);
}

export async function listTxns(wsId: string, month: string) {
  await ready();
  const rows = await sql()`select * from transactions where workspace_id = ${wsId} and txn_date like ${month + "-%"}
    order by txn_date desc, created_at desc`;
  return rows.map(rowToTxn);
}

export async function getTxn(wsId: string, id: string) {
  await ready();
  const [r] = await sql()`select * from transactions where workspace_id = ${wsId} and id = ${id}`;
  return r ? rowToTxn(r) : null;
}

export async function updateTxn(ws: Workspace, id: string, patch: Partial<TxnInput>, actor: Actor) {
  const t = await getTxn(ws.id, id);
  if (!t) throw new Error("Transaction not found.");
  const n = normaliseTxn(patch, ws.base_currency);
  const fields: [keyof Txn, string][] = [
    ["txn_date", "date"], ["merchant", "merchant"], ["amount", "amount"], ["currency", "currency"], ["bucket", "bucket"], ["notes", "notes"],
  ];
  const changes: string[] = [];
  const next = { ...t } as Record<string, unknown>;
  for (const [f, label] of fields) {
    if (!(f in n)) continue;
    const a = t[f] ?? null;
    const b = n[f] ?? null;
    if (a === b || (f === "amount" && Number(a) === Number(b))) continue;
    const fmt = (v: unknown) => (v == null || v === "" ? "—" : f === "amount" ? money(Number(v), (n.currency as string) ?? t.currency) : String(v));
    changes.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
    next[f] = b;
  }
  if (!changes.length) return { txn: t, changes };
  const v = next as unknown as Txn;
  const moneyChanged = Number(v.amount) !== Number(t.amount) || v.currency !== t.currency;
  const [r] = await sql()`update transactions set txn_date = ${v.txn_date}, merchant = ${v.merchant}, amount = ${v.amount},
    currency = ${v.currency}, bucket = ${v.bucket}, notes = ${v.notes}, updated_at = now(),
    base_amount = ${moneyChanged ? null : t.base_amount}, base_currency = ${moneyChanged ? null : t.base_currency}
    where id = ${id} and workspace_id = ${ws.id} returning *`;
  await logActivity(ws.id, actor, patch.bucket && n.bucket !== t.bucket ? `moved to ${n.bucket}` : "edited transaction", v.merchant, null, changes.join("; "));
  return { txn: rowToTxn(r), changes };
}

export async function deleteTxn(ws: Workspace, id: string, actor: Actor) {
  const t = await getTxn(ws.id, id);
  if (!t) return null;
  await sql()`delete from transactions where id = ${id} and workspace_id = ${ws.id}`;
  await logActivity(ws.id, actor, "deleted transaction", t.merchant, null, `${t.txn_date} · ${money(t.amount, t.currency)}`);
  return t;
}

export async function deleteAllTxns(wsId: string) {
  await sql()`delete from transactions where workspace_id = ${wsId}`;
}

// ---------- summary ----------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}
export function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export function summariseMonth(txns: Txn[], buckets: BucketRow[], base: string) {
  // Use the statement's own home-currency amount when Claude provided it; otherwise convert at fixed rates.
  const inBase = (t: Txn) => (t.base_amount != null && t.base_currency === base ? t.base_amount : convert(t.amount, t.currency, base));
  const map = new Map(buckets.map((b) => [b.name, { name: b.name, owner: b.owner, total: 0, count: 0 }]));
  for (const t of txns) {
    const b = map.get(t.bucket) ?? map.get("Other")!;
    b.total += inBase(t);
    b.count += 1;
  }
  const all = [...map.values()];
  const total = all.reduce((s, b) => s + b.total, 0);
  const used = all.filter((b) => b.count > 0).sort((a, b) => b.total - a.total);
  const unused = all.filter((b) => b.count === 0);
  const biggest = [...txns].sort((a, b) => inBase(b) - inBase(a)).slice(0, 3);
  return { base, total, count: txns.length, buckets: used, unused, biggest, inBase, noOwner: used.filter((b) => !b.owner) };
}

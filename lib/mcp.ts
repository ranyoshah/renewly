// MCP tools that Claude calls. The app does storage and maths; Claude does the reading and thinking.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Workspace } from "./auth";
import { APP_NAME } from "./brand";
import {
  CATEGORIES,
  CURRENCIES,
  CYCLES,
  STATUSES,
  findSubByVendor,
  getSub,
  listSubs,
  money,
  monthlyIn,
  priceLabel,
  summarise,
  updateSub,
  upcomingRenewal,
  upsertSubs,
  daysUntil,
  type Sub,
} from "./subs";
import { BUCKETS, addTransactions, listBuckets, listMonths, listTxns, monthLabel, setBucketOwner, summariseMonth } from "./expenses";

export const SERVER_INSTRUCTIONS = `${APP_NAME} is the user's company spend tracker. It keeps (a) every SaaS subscription with owners and renewal dates, and (b) every card transaction sorted into expense buckets (Tech & software, Travel, Meals & entertainment, Office & admin, Marketing, Professional services, Bank & card fees, Other), each bucket with a named owner. The app shows live dashboards and syncs renewals to the user's calendar.

When the user shares a card or bank statement, do BOTH steps unless they ask for only one:
A. Call add_transactions once with EVERY line of the statement (including refunds as negative amounts, and fees). Give each a clean merchant name, the original description, the date, the amount and currency as charged (plus amount_in_home_currency when the statement also shows the converted amount), and the best bucket. Software, SaaS and cloud go in "Tech & software"; card markup fees and taxes on them go in "Bank & card fees".
B. Call add_subscriptions once with the recurring software/SaaS charges only:
   - Group repeated charges for the same vendor into ONE subscription. Use the clean brand name (e.g. "Figma", not "FIGMA* MONTHLY SF").
   - Work out billing_cycle from the pattern (monthly if it repeats monthly; annual if it is one large yearly charge).
   - Use the charge date as last_charged (the app calculates the next renewal), or next_renewal if known.
Re-sending the same statement is safe: the app skips duplicate transactions and updates existing subscriptions.
After adding, tell the user what was added, the month's total by bucket, the SaaS monthly total, and share the dashboard links.

For questions about spend, renewals, owners or overlap, call get_monthly_spend, get_spend_summary or list_subscriptions. Always use the numbers the app returns; do not compute totals yourself.`;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const subFields = {
  plan: z.string().max(80).optional().describe("Plan or tier name, e.g. 'Business', 'Pro'"),
  category: z.enum(CATEGORIES).optional().describe("Closest category"),
  amount: z.number().nonnegative().describe("Price charged per billing cycle (not per month unless monthly)"),
  currency: z.enum(CURRENCIES as [string, ...string[]]).optional().describe("ISO currency of the charge"),
  billing_cycle: z.enum(CYCLES).optional().describe("How often it is charged. Default monthly"),
  next_renewal: date.optional().describe("Next charge date if known, YYYY-MM-DD"),
  last_charged: date.optional().describe("Most recent charge date, YYYY-MM-DD. Used to calculate next renewal"),
  owner: z.string().max(80).optional().describe("Person responsible for this tool"),
  seats: z.number().int().positive().optional().describe("Number of seats/licences, if known"),
  notes: z.string().max(500).optional(),
};

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function line(s: Sub, base: string) {
  const r = upcomingRenewal(s);
  const per = s.currency === base && s.billing_cycle === "monthly" ? "" : ` (≈ ${money(monthlyIn(s, base), base)}/mo)`;
  return `- ${s.vendor}${s.plan ? ` ${s.plan}` : ""} [id ${s.id}] — ${priceLabel(s)}${per} · ${s.category} · ${s.status}` +
    ` · renews ${r ?? "unknown"} · owner ${s.owner ?? "none"}${s.seats ? ` · ${s.seats} seats` : ""}`;
}

export function registerTools(server: McpServer, ws: Workspace, baseUrl: string) {
  const dash = `${baseUrl}/dashboard`;

  server.registerTool(
    "add_subscriptions",
    {
      title: "Add subscriptions",
      description:
        "Save one or more SaaS subscriptions to the tracker (e.g. extracted from a card statement). Existing vendors are updated instead of duplicated. Returns what changed and the new totals.",
      inputSchema: z.object({
        subscriptions: z
          .array(z.object({ vendor: z.string().min(1).max(80).describe("Clean brand name, e.g. 'Notion'"), ...subFields }))
          .min(1)
          .max(100),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ subscriptions }) => {
      const res = await upsertSubs(ws, subscriptions, "claude");
      const all = await listSubs(ws.id);
      const s = summarise(all, ws.base_currency);
      const parts = [
        `Added ${res.created.length}, updated ${res.updated.length}${res.errors.length ? `, failed ${res.errors.length}` : ""}.`,
        ...res.created.map((x) => `+ ${x.vendor}: ${priceLabel(x)}, renews ${upcomingRenewal(x) ?? "unknown"}`),
        ...res.updated.map((u) => `~ ${u.sub.vendor}: ${u.changes.length ? u.changes.join("; ") : "no changes"}`),
        ...res.errors.map((e) => `! ${e.vendor}: ${e.error}`),
        ...(res.skipped.length ? [`Skipped duplicates in this batch: ${res.skipped.join(", ")}`] : []),
        "",
        `Now tracking ${s.activeCount} tools: ${money(s.monthly, s.base)}/month (${money(s.annual, s.base)}/year).`,
        `${s.upcoming.length} renew in the next 30 days.`,
        `Dashboard (the user can review and edit here): ${dash}`,
      ];
      return text(parts.join("\n"));
    },
  );

  server.registerTool(
    "list_subscriptions",
    {
      title: "List subscriptions",
      description: "List tracked subscriptions with ids, prices, renewal dates and owners. Optional filters.",
      inputSchema: z.object({
        status: z.enum([...STATUSES, "all"]).optional().describe("Default: active and cancelling"),
        category: z.enum(CATEGORIES).optional(),
        renewing_within_days: z.number().int().positive().max(366).optional(),
        missing_owner: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ status, category, renewing_within_days, missing_owner }) => {
      let subs = await listSubs(ws.id);
      if (!status) subs = subs.filter((s) => s.status !== "cancelled");
      else if (status !== "all") subs = subs.filter((s) => s.status === status);
      if (category) subs = subs.filter((s) => s.category === category);
      if (missing_owner) subs = subs.filter((s) => !s.owner);
      if (renewing_within_days) {
        subs = subs.filter((s) => {
          const r = upcomingRenewal(s);
          return r && daysUntil(r) <= renewing_within_days;
        });
      }
      if (!subs.length) return text(`No subscriptions match. Dashboard: ${dash}`);
      return text([`${subs.length} subscriptions:`, ...subs.map((s) => line(s, ws.base_currency)), "", `Dashboard: ${dash}`].join("\n"));
    },
  );

  server.registerTool(
    "update_subscription",
    {
      title: "Update a subscription",
      description:
        "Change one tracked subscription: owner, price, plan, seats, renewal date, notes, or status (e.g. mark as 'cancelling' or 'cancelled'). Identify it by id or vendor name.",
      inputSchema: z.object({
        id: z.string().optional().describe("Subscription id from list_subscriptions"),
        vendor: z.string().optional().describe("Vendor name, if id is not known"),
        new_vendor_name: z.string().max(80).optional(),
        status: z.enum(STATUSES).optional(),
        ...Object.fromEntries(Object.entries(subFields).map(([k, v]) => [k, v.optional()])),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const { id, vendor, new_vendor_name, last_charged: _lc, ...rest } = args as Record<string, unknown>;
      const sub = id ? await getSub(ws.id, String(id)) : vendor ? await findSubByVendor(ws.id, String(vendor)) : null;
      if (!sub) return { ...text(`Could not find that subscription. Use list_subscriptions to get ids.`), isError: true };
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
      if (new_vendor_name) patch.vendor = new_vendor_name;
      if (_lc && !patch.next_renewal) patch.last_charged = _lc;
      const { sub: after, changes } = await updateSub(ws, sub.id, patch, "claude");
      return text(
        changes.length
          ? `Updated ${after.vendor}: ${changes.join("; ")}.\nView or edit: ${baseUrl}/dashboard/subscriptions/${after.id}`
          : `No changes needed for ${after.vendor}.`,
      );
    },
  );

  server.registerTool(
    "get_spend_summary",
    {
      title: "Get spend summary",
      description:
        "Totals and insights calculated by the app: monthly and annual SaaS spend, spend by category, renewals in the next 30 days, tools without an owner, and categories with several tools (possible overlap).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const subs = await listSubs(ws.id);
      if (!subs.length) return text(`Nothing is tracked yet. Share a card statement and I can add the subscriptions. Dashboard: ${dash}`);
      const s = summarise(subs, ws.base_currency);
      const m = (n: number) => money(n, s.base);
      const out = [
        `${ws.name}: ${s.activeCount} active tools, ${m(s.monthly)}/month, ${m(s.annual)}/year (in ${s.base}, approximate FX).`,
        "",
        "By category (per month):",
        ...s.categories.map((c) => `- ${c.category}: ${m(c.monthly)} (${c.count}: ${c.vendors.join(", ")})`),
        "",
        `Renewing in next 30 days (${m(s.upcomingTotal)} total):`,
        ...(s.upcoming.length ? s.upcoming.map((u) => `- ${u.date} (${daysUntil(u.date)}d): ${u.sub.vendor} ${priceLabel(u.sub)}`) : ["- none"]),
        "",
        `No owner (${s.noOwner.length}): ${s.noOwner.map((x) => x.vendor).join(", ") || "none"}`,
        `No renewal date (${s.noRenewalDate.length}): ${s.noRenewalDate.map((x) => x.vendor).join(", ") || "none"}`,
        `Marked cancelling: ${s.cancelling.map((x) => x.vendor).join(", ") || "none"}`,
        `Possible overlap: ${s.overlaps.map((o) => `${o.category} (${o.vendors.join(", ")})`).join("; ") || "none"}`,
        s.cancelledSavings ? `Saved so far by cancelling: ${m(s.cancelledSavings)}/month` : "",
        "",
        `Dashboard: ${dash}`,
      ];
      return text(out.join("\n"));
    },
  );

  server.registerTool(
    "add_transactions",
    {
      title: "Add transactions",
      description:
        "Save card or bank statement lines to the monthly expense tracker, each sorted into an expense bucket. Duplicates (same date, merchant and amount) are skipped. Returns the month's totals by bucket and owner.",
      inputSchema: z.object({
        transactions: z
          .array(
            z.object({
              date: date.describe("Transaction date, YYYY-MM-DD"),
              merchant: z.string().min(1).max(120).describe("Clean merchant name, e.g. 'Uber', 'IndiGo', 'Figma'"),
              description: z.string().max(200).optional().describe("Original statement text"),
              amount: z.number().describe("Amount as charged; refunds are negative"),
              currency: z.string().length(3).optional().describe("ISO currency, e.g. INR or USD"),
              amount_in_home_currency: z.number().optional().describe("For foreign-currency charges: the amount the statement shows in the account's home currency (e.g. the INR column), if shown"),
              bucket: z.enum(BUCKETS).describe("Expense bucket"),
              notes: z.string().max(300).optional(),
            }),
          )
          .min(1)
          .max(300),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ transactions }) => {
      const res = await addTransactions(ws, transactions, "claude");
      const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort();
      const buckets = await listBuckets(ws);
      const parts = [
        `Added ${res.added.length} transactions${res.duplicates.length ? `, skipped ${res.duplicates.length} already saved` : ""}${res.errors.length ? `, failed ${res.errors.length}` : ""}.`,
        ...res.errors.map((e) => `! ${e.merchant}: ${e.error}`),
      ];
      for (const m of months) {
        const s = summariseMonth(await listTxns(ws.id, m), buckets, ws.base_currency);
        parts.push("", `${monthLabel(m)}: ${money(s.total, s.base)} across ${s.count} transactions.`);
        for (const b of s.buckets) parts.push(`- ${b.name} (owner ${b.owner ?? "none"}): ${money(b.total, s.base)}, ${b.count} ${b.count === 1 ? "item" : "items"}`);
        parts.push(`View and edit: ${baseUrl}/dashboard/month?m=${m}`);
      }
      return text(parts.join("\n"));
    },
  );

  server.registerTool(
    "get_monthly_spend",
    {
      title: "Get monthly spend",
      description: "Totals for one month by expense bucket, with each bucket's owner and the largest transactions. Defaults to the latest month with data.",
      inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM") }),
      annotations: { readOnlyHint: true },
    },
    async ({ month }) => {
      const months = await listMonths(ws.id);
      const m = month ?? months[0];
      if (!m) return text(`No transactions saved yet. Share a card statement and I can add them. Dashboard: ${baseUrl}/dashboard/month`);
      const txns = await listTxns(ws.id, m);
      const s = summariseMonth(txns, await listBuckets(ws), ws.base_currency);
      const out = [
        `${monthLabel(m)}: ${money(s.total, s.base)} across ${s.count} transactions (in ${s.base}, approximate FX).`,
        ...s.buckets.map((b) => `- ${b.name} (owner ${b.owner ?? "none"}): ${money(b.total, s.base)}, ${b.count} ${b.count === 1 ? "item" : "items"}`),
        "",
        "Largest:",
        ...s.biggest.map((t) => `- ${t.txn_date} ${t.merchant}: ${money(t.amount, t.currency)} (${t.bucket})`),
        s.noOwner.length ? `Buckets with spend but no owner: ${s.noOwner.map((b) => b.name).join(", ")}` : "",
        `Months with data: ${months.map(monthLabel).join(", ")}`,
        `View and edit: ${baseUrl}/dashboard/month?m=${m}`,
      ];
      return text(out.filter(Boolean).join("\n"));
    },
  );

  server.registerTool(
    "set_bucket_owner",
    {
      title: "Set bucket owner",
      description: "Assign the person who owns an expense bucket (e.g. Travel → Meera). Use an empty owner to clear it.",
      inputSchema: z.object({ bucket: z.enum(BUCKETS), owner: z.string().max(80) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ bucket, owner }) => {
      const r = await setBucketOwner(ws, bucket, owner, "claude");
      return text(r.changed ? `${r.name} is now owned by ${r.after ?? "nobody"} (was ${r.before ?? "nobody"}).` : `${r.name} already owned by ${r.after ?? "nobody"}.`);
    },
  );
}

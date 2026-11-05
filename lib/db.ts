import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./password";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./brand";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function makeClient() {
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) and redeploy.");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: 3,
    idle_timeout: 20,
    prepare: false, // safe with poolers like Neon / PgBouncer
    onnotice: () => {},
  });
}

export function sql() {
  if (!globalThis.__sql) globalThis.__sql = makeClient();
  return globalThis.__sql;
}

export function newKey(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

async function migrate() {
  const db = sql();
  await db.unsafe(`
    create table if not exists workspaces (
      id text primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      base_currency text not null default 'INR',
      mcp_key text not null unique,
      share_key text not null unique,
      cal_key text not null unique,
      created_at timestamptz not null default now()
    );
    create table if not exists subscriptions (
      id text primary key,
      workspace_id text not null references workspaces(id) on delete cascade,
      vendor text not null,
      vendor_key text not null,
      plan text,
      category text not null default 'Other',
      amount numeric(14,2) not null,
      currency text not null default 'INR',
      billing_cycle text not null default 'monthly',
      next_renewal text,
      owner text,
      seats integer,
      status text not null default 'active',
      notes text,
      source text not null default 'manual',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, vendor_key)
    );
    create table if not exists activity (
      id bigserial primary key,
      workspace_id text not null references workspaces(id) on delete cascade,
      subscription_id text,
      vendor text,
      actor text not null,
      action text not null,
      detail text,
      created_at timestamptz not null default now()
    );
    create index if not exists activity_ws_idx on activity (workspace_id, created_at desc);
    create table if not exists buckets (
      workspace_id text not null references workspaces(id) on delete cascade,
      name text not null,
      owner text,
      sort integer not null default 0,
      primary key (workspace_id, name)
    );
    create table if not exists transactions (
      id text primary key,
      workspace_id text not null references workspaces(id) on delete cascade,
      txn_date text not null,
      merchant text not null,
      description text,
      amount numeric(14,2) not null,
      currency text not null default 'INR',
      bucket text not null default 'Other',
      notes text,
      source text not null default 'manual',
      dedupe_key text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, dedupe_key)
    );
    create index if not exists transactions_ws_date_idx on transactions (workspace_id, txn_date);
    alter table transactions add column if not exists base_amount numeric(14,2);
    alter table transactions add column if not exists base_currency text;
  `);

  const [demo] = await db`select id from workspaces where email = ${DEMO_EMAIL}`;
  if (!demo) {
    await db`
      insert into workspaces (id, name, email, password_hash, base_currency, mcp_key, share_key, cal_key)
      values (${newKey(8)}, 'Acme Labs (demo)', ${DEMO_EMAIL}, ${hashPassword(DEMO_PASSWORD)}, 'INR',
              ${newKey()}, ${newKey()}, ${newKey()})
      on conflict (email) do nothing`;
  }
}

/** Creates tables (and the demo account) on first use. Safe to call on every request. */
export async function ready() {
  if (!globalThis.__schemaReady) {
    globalThis.__schemaReady = migrate().catch((e) => {
      globalThis.__schemaReady = undefined;
      throw e;
    });
  }
  return globalThis.__schemaReady;
}

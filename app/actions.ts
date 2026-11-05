"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, requireWorkspace, setSession } from "@/lib/auth";
import { newKey, ready, sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSub, deleteAllSubs, deleteSub, updateSub, CURRENCIES, type SubInput } from "@/lib/subs";
import { addTransactions, deleteAllTxns, deleteTxn, setBucketOwner, updateTxn, BUCKETS } from "@/lib/expenses";

function str(f: FormData, k: string) {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function back(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
}

export async function login(form: FormData) {
  await ready();
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const [ws] = await sql()<{ id: string; password_hash: string }[]>`select id, password_hash from workspaces where email = ${email}`;
  if (!ws || !verifyPassword(password, ws.password_hash)) back("/login", "That email and password don't match.");
  await setSession(ws.id);
  redirect("/dashboard");
}

export async function signup(form: FormData) {
  await ready();
  const name = str(form, "name");
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const currency = CURRENCIES.includes(str(form, "currency")) ? str(form, "currency") : "INR";
  if (!name || !email.includes("@")) back("/signup", "Add your company name and a valid email.");
  if (password.length < 8) back("/signup", "Use a password with at least 8 characters.");
  const [exists] = await sql()`select 1 from workspaces where email = ${email}`;
  if (exists) back("/signup", "An account with this email already exists. Log in instead.");
  const id = newKey(8);
  await sql()`insert into workspaces (id, name, email, password_hash, base_currency, mcp_key, share_key, cal_key)
    values (${id}, ${name}, ${email}, ${hashPassword(password)}, ${currency}, ${newKey()}, ${newKey()}, ${newKey()})`;
  await setSession(id);
  redirect("/dashboard/connect?welcome=1");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

function readSubForm(form: FormData): SubInput {
  const seats = str(form, "seats");
  return {
    vendor: str(form, "vendor"),
    plan: str(form, "plan"),
    category: str(form, "category"),
    amount: Number(str(form, "amount") || "0"),
    currency: str(form, "currency"),
    billing_cycle: str(form, "billing_cycle"),
    next_renewal: str(form, "next_renewal") || null,
    owner: str(form, "owner"),
    seats: seats ? Number(seats) : null,
    status: str(form, "status") || "active",
    notes: str(form, "notes"),
  };
}

export async function addSubscription(form: FormData) {
  const ws = await requireWorkspace();
  const input = readSubForm(form);
  if (!input.vendor) back("/dashboard/new", "Add the tool's name.");
  let id = "";
  try {
    id = (await createSub(ws, input, "person")).id;
  } catch (e) {
    const msg = (e as Error).message.includes("unique") ? `${input.vendor} is already tracked.` : (e as Error).message;
    back("/dashboard/new", msg);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/subscriptions/${id}?saved=added`);
}

export async function saveSubscription(form: FormData) {
  const ws = await requireWorkspace();
  const id = str(form, "id");
  try {
    await updateSub(ws, id, readSubForm(form), "person");
  } catch (e) {
    const msg = (e as Error).message.includes("unique") ? "Another subscription already uses that name." : (e as Error).message;
    back(`/dashboard/subscriptions/${id}`, msg);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/subscriptions/${id}?saved=1`);
}

export async function setStatus(form: FormData) {
  const ws = await requireWorkspace();
  const id = str(form, "id");
  await updateSub(ws, id, { status: str(form, "status") }, "person");
  revalidatePath("/dashboard");
  const ret = str(form, "return");
  redirect(ret || `/dashboard/subscriptions/${id}?saved=1`);
}

export async function removeSubscription(form: FormData) {
  const ws = await requireWorkspace();
  await deleteSub(ws, str(form, "id"), "person");
  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}

export async function saveWorkspace(form: FormData) {
  const ws = await requireWorkspace();
  const name = str(form, "name") || ws.name;
  const currency = CURRENCIES.includes(str(form, "currency")) ? str(form, "currency") : ws.base_currency;
  await sql()`update workspaces set name = ${name}, base_currency = ${currency} where id = ${ws.id}`;
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/connect?saved=1");
}

export async function rotateLinks(form: FormData) {
  const ws = await requireWorkspace();
  const which = str(form, "which");
  if (which === "mcp") await sql()`update workspaces set mcp_key = ${newKey()} where id = ${ws.id}`;
  if (which === "share") await sql()`update workspaces set share_key = ${newKey()} where id = ${ws.id}`;
  if (which === "cal") await sql()`update workspaces set cal_key = ${newKey()} where id = ${ws.id}`;
  redirect("/dashboard/connect?rotated=1");
}

export async function clearAll() {
  const ws = await requireWorkspace();
  await deleteAllTxns(ws.id);
  await deleteAllSubs(ws);
  revalidatePath("/dashboard");
  redirect("/dashboard?cleared=1");
}

function readTxnForm(form: FormData) {
  return {
    date: str(form, "date"),
    merchant: str(form, "merchant"),
    amount: Number(str(form, "amount") || "0"),
    currency: str(form, "currency"),
    bucket: str(form, "bucket"),
    notes: str(form, "notes"),
  };
}

export async function saveTransaction(form: FormData) {
  const ws = await requireWorkspace();
  const id = str(form, "id");
  try {
    await updateTxn(ws, id, readTxnForm(form), "person");
  } catch (e) {
    back(`/dashboard/transactions/${id}`, (e as Error).message);
  }
  revalidatePath("/dashboard/month");
  redirect(`/dashboard/transactions/${id}?saved=1`);
}

export async function moveTransaction(form: FormData) {
  const ws = await requireWorkspace();
  await updateTxn(ws, str(form, "id"), { bucket: str(form, "bucket") }, "person");
  revalidatePath("/dashboard/month");
  redirect(str(form, "return") || "/dashboard/month");
}

export async function addTransaction(form: FormData) {
  const ws = await requireWorkspace();
  const t = readTxnForm(form);
  const res = await addTransactions(ws, [t], "person");
  if (res.errors.length) back("/dashboard/month?add=1", res.errors[0].error);
  if (res.duplicates.length) back("/dashboard/month?add=1", "That transaction is already saved.");
  redirect(`/dashboard/month?m=${t.date.slice(0, 7)}&saved=added`);
}

export async function removeTransaction(form: FormData) {
  const ws = await requireWorkspace();
  const t = await deleteTxn(ws, str(form, "id"), "person");
  redirect(`/dashboard/month${t ? `?m=${t.txn_date.slice(0, 7)}&saved=deleted` : ""}`);
}

export async function saveBucketOwners(form: FormData) {
  const ws = await requireWorkspace();
  for (const b of BUCKETS) {
    const v = form.get(`owner:${b}`);
    if (typeof v === "string") await setBucketOwner(ws, b, v, "person");
  }
  revalidatePath("/dashboard/month");
  const m = str(form, "m");
  redirect(`/dashboard/month?${m ? `m=${m}&` : ""}saved=owners`);
}

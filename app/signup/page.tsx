import Link from "next/link";
import { signup } from "../actions";
import { Brand } from "@/components/Brand";
import { CURRENCIES } from "@/lib/subs";

export const metadata = { title: "Create account" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="auth">
      <div className="auth-card">
        <Brand />
        <h1>Create your account</h1>
        {error && <p className="error" role="alert">{error}</p>}
        <form action={signup}>
          <label className="field">Company name<input name="name" required placeholder="Acme Labs" /></label>
          <label className="field">Work email<input name="email" type="email" required autoComplete="email" /></label>
          <label className="field">Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="field">Show totals in
            <select name="currency" defaultValue="INR">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <button className="btn" type="submit">Create account</button>
        </form>
        <p className="muted small">Already have an account? <Link href="/login">Log in</Link></p>
      </div>
    </main>
  );
}

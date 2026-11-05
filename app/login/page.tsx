import Link from "next/link";
import { login } from "../actions";
import { Brand } from "@/components/Brand";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/brand";

export const metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="auth">
      <div className="auth-card">
        <Brand />
        <h1>Log in</h1>
        {error && <p className="error" role="alert">{error}</p>}
        <form action={login}>
          <label className="field">Email<input name="email" type="email" required autoComplete="email" defaultValue={DEMO_EMAIL} /></label>
          <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="btn" type="submit">Log in</button>
        </form>
        <div className="demo-box">
          <strong>Demo account</strong>
          <div className="num">Email: {DEMO_EMAIL}</div>
          <div className="num">Password: {DEMO_PASSWORD}</div>
        </div>
        <p className="muted small">No account? <Link href="/signup">Create one</Link></p>
      </div>
    </main>
  );
}

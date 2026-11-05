import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Page not found</h1>
        <p className="muted">This link doesn’t exist or has been replaced with a new one.</p>
        <Link className="btn" href="/">Go to home page</Link>
      </div>
    </main>
  );
}

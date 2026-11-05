import { Brand } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { requireWorkspace } from "@/lib/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand href="/dashboard" />
          <NavLinks />
          <div className="who">
            <span className="ws-name">{ws.name}</span>
            <form action={logout}><button className="btn link small" type="submit">Log out</button></form>
          </div>
        </div>
      </header>
      <main className="wrap page">{children}</main>
    </>
  );
}

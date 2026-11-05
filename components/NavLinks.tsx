"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Subscriptions" },
  { href: "/dashboard/month", label: "This month" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/connect", label: "Connect Claude" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const on = l.href === "/dashboard" ? path === "/dashboard" || path.startsWith("/dashboard/subscriptions") : l.href === "/dashboard/month" ? path.startsWith("/dashboard/month") || path.startsWith("/dashboard/transactions") : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

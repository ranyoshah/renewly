"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/connect", label: "Connect Claude" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const on = l.href === "/dashboard" ? path === "/dashboard" || path.startsWith("/dashboard/subscriptions") : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

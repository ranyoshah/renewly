import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <rect x="12" y="27" width="18" height="10" rx="3" fill="var(--primary-ink)" />
      <rect x="33" y="27" width="11" height="10" rx="3" fill="#9fe0cd" />
      <rect x="47" y="27" width="5" height="10" rx="2.5" fill="#f0b54a" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label={`${APP_NAME} home`}>
      <Logo />
      {APP_NAME}
    </Link>
  );
}

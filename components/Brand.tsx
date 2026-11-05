import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label={`${APP_NAME} home`}>
      <span className="brand-mark" aria-hidden />
      {APP_NAME}
    </Link>
  );
}

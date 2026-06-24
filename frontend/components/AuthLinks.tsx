"use client";

import { usePathname } from "next/navigation";

const SHOP_DOMAIN = process.env.NEXT_PUBLIC_SHOP_DOMAIN!;

export function AuthLinks() {
  const pathname = usePathname();
  const returnUrl = encodeURIComponent(`${window.location.origin}${pathname}`);

  const loginUrl = `https://${SHOP_DOMAIN}/account/login?return_url=${returnUrl}`;
  const registerUrl = `https://${SHOP_DOMAIN}/account/register?return_url=${returnUrl}`;

  const linkClass =
    "text-sm text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors";

  return (
    <>
      <li>
        <a href={loginUrl} rel="noopener" className={linkClass}>
          Login
        </a>
      </li>
      <li>
        <a href={registerUrl} rel="noopener" className={linkClass}>
          Register
        </a>
      </li>
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface Customer {
  firstName: string;
  lastName: string;
  emailAddress: { emailAddress: string };
}

const linkClass =
  "text-sm text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors";

export function AuthLinks() {
  const pathname = usePathname();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/customer")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCustomer(data.customer);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <li className="text-sm text-[var(--color-muted)]">...</li>;
  }

  if (customer) {
    const displayName =
      customer.firstName || customer.emailAddress?.emailAddress || "Account";
    return (
      <>
        <li className="text-sm text-[var(--color-muted)]">
          Hi, {displayName}
        </li>
        <li>
          <a href="/api/auth/logout" className={linkClass}>
            Logout
          </a>
        </li>
      </>
    );
  }

  const returnTo = encodeURIComponent(pathname);
  return (
    <li>
      <a
        href={`/api/auth/login?returnTo=${returnTo}`}
        className={linkClass}
      >
        Login
      </a>
    </li>
  );
}

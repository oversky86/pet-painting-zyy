import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review your custom pet painting order before checkout.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  // Cart page will be fully implemented in Task 9
  // It needs client-side state management for cart operations
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Your Cart</h1>
      <div className="mt-8 text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
        <p className="text-[var(--color-muted)]">
          Your cart is empty. Browse our collection to create your custom pet painting.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Browse Products
        </Link>
      </div>
    </section>
  );
}

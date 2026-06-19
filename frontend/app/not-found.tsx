import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-2xl mx-auto px-4 py-24 text-center">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="mt-4 text-lg text-[var(--color-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/"
          className="px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-[var(--color-border)] rounded-lg font-medium hover:bg-[var(--color-secondary)] transition-colors"
        >
          Browse Products
        </Link>
      </div>
    </section>
  );
}

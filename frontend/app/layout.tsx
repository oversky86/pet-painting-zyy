import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pet Painting Studio | Custom AI Pet Portraits",
    template: "%s | Pet Painting Studio",
  },
  description:
    "Transform your pet's photo into a beautiful oil painting. AI-powered custom pet portraits in Classic Oil and Impressionist styles.",
  keywords: [
    "pet painting",
    "custom pet portrait",
    "AI art",
    "oil painting",
    "pet photo",
  ],
  openGraph: {
    type: "website",
    siteName: "Pet Painting Studio",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Organization JSON-LD for site-level SEO
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pet Painting Studio",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://petpainting.studio",
  description: "Custom AI-powered pet oil paintings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        {/* Performance: resource preconnect for CDN and external services */}
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <link
          rel="preconnect"
          href={`https://${process.env.NEXT_PUBLIC_SHOP_DOMAIN}`}
        />
        <link
          rel="dns-prefetch"
          href={`https://${process.env.NEXT_PUBLIC_SHOP_DOMAIN}`}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {/* Accessibility: skip navigation link */}
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>

        <header className="border-b border-[var(--color-border)] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight"
              aria-label="Pet Painting Studio - Home"
            >
              Pet Painting Studio
            </Link>
            <nav aria-label="Main navigation">
              <ul className="flex items-center gap-6">
                <li>
                  <Link
                    href="/"
                    className="text-sm text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Shop
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cart"
                    className="text-sm text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Cart
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-[var(--color-border)] bg-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-[var(--color-muted)]">
            <p>&copy; {new Date().getFullYear()} Pet Painting Studio. All rights reserved.</p>
            <p className="mt-1">
              Handcrafted with heart. Delivered with care.
            </p>
          </div>
        </footer>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
      </body>
    </html>
  );
}

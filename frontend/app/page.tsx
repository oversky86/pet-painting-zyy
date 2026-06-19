import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "@/lib/storefront";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop | Pet Painting Studio",
  description:
    "Browse our collection of custom AI pet portraits. Upload your pet's photo and choose from Classic Oil or Impressionist styles.",
};

export const revalidate = 3600; // ISR: revalidate every hour

export default async function HomePage() {
  let products: Product[] = [];
  let fetchError = "";

  try {
    products = await getProducts();
  } catch {
    fetchError = "Unable to load products. Please try again later.";
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero section */}
      <header className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Custom Pet Oil Paintings
        </h1>
        <p className="mt-4 text-lg text-[var(--color-muted)] max-w-2xl mx-auto">
          Upload your pet&apos;s photo, choose an artistic style, and our AI
          transforms it into a stunning oil painting — hand-finished by real
          artists.
        </p>
      </header>

      {/* Product grid */}
      {fetchError ? (
        <div className="text-center py-12" role="alert">
          <p className="text-[var(--color-muted)]">{fetchError}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-muted)]">
            No products available yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <article key={product.id} className="group">
              <Link
                href={`/products/${product.handle}`}
                className="block"
                prefetch={true}
              >
                <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-[var(--color-secondary)]">
                  {product.featuredImage ? (
                    <Image
                      src={product.featuredImage.url}
                      alt={
                        product.featuredImage.altText ||
                        `${product.title} - custom pet painting`
                      }
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)]">
                      No image
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h2 className="font-semibold text-lg">{product.title}</h2>
                  <p className="text-[var(--color-muted)] text-sm mt-1 line-clamp-2">
                    {product.description}
                  </p>
                  <p className="mt-2 font-medium">
                    From{" "}
                    {product.priceRange.minVariantPrice.currencyCode}{" "}
                    {product.priceRange.minVariantPrice.amount}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* Trust badges */}
      <section className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center" aria-label="Features">
        {[
          { icon: "🎨", text: "Free AI preview & revisions" },
          { icon: "🖌️", text: "Hand-painted by real artists" },
          { icon: "🏛️", text: "Museum-quality materials" },
          { icon: "✅", text: "100% satisfaction guarantee" },
        ].map((badge) => (
          <div key={badge.text} className="py-4">
            <span className="text-2xl" role="img" aria-hidden="true">
              {badge.icon}
            </span>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{badge.text}</p>
          </div>
        ))}
      </section>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getProductByHandle } from "@/lib/storefront";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import type { Product } from "@/lib/types";

export const revalidate = 3600; // ISR

// SEO: Dynamic metadata from Shopify product
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  try {
    const product = await getProductByHandle(handle);
    return {
      title: product.title,
      description:
        product.description || "Custom pet oil painting powered by AI",
      keywords: [
        "pet painting",
        "custom oil painting",
        "AI art",
        product.title,
      ],
      openGraph: {
        title: product.title,
        description: product.description,
        images: product.featuredImage
          ? [
              {
                url: product.featuredImage.url,
                width: product.featuredImage.width ?? 800,
                height: product.featuredImage.height ?? 600,
                alt: product.featuredImage.altText || product.title,
              },
            ]
          : [],
      },
      alternates: {
        canonical: `/products/${handle}`,
      },
    };
  } catch {
    return { title: "Product Not Found" };
  }
}

// SEO: Schema.org Product JSON-LD
function ProductJsonLd({ product }: { product: Product }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage?.url,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: product.priceRange.minVariantPrice.amount,
      highPrice: product.priceRange.maxVariantPrice.amount,
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// SEO: BreadcrumbList JSON-LD
function BreadcrumbJsonLd({
  productTitle,
  handle,
}: {
  productTitle: string;
  handle: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: process.env.NEXT_PUBLIC_APP_URL || "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${process.env.NEXT_PUBLIC_APP_URL || ""}/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: productTitle,
        item: `${process.env.NEXT_PUBLIC_APP_URL || ""}/products/${handle}`,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  // Extract unique Size and Frame options from variants
  const sizeOptions = [
    ...new Set(
      product.variants.nodes
        .flatMap((v) => v.selectedOptions)
        .filter((opt) => opt.name === "Size")
        .map((opt) => opt.value)
    ),
  ];
  const frameOptions = [
    ...new Set(
      product.variants.nodes
        .flatMap((v) => v.selectedOptions)
        .filter((opt) => opt.name === "Frame")
        .map((opt) => opt.value)
    ),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd productTitle={product.title} handle={handle} />

      {/* SEO: Breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex gap-2 text-sm text-[var(--color-muted)]">
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/" className="hover:text-[var(--foreground)]">
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-[var(--foreground)]">
            {product.title}
          </li>
        </ol>
      </nav>

      {/* Product Customizer: 4-step single-page flow */}
      <section aria-label="Customize your painting">
        <ProductCustomizer
          productHandle={handle}
          productId={product.id}
          productTitle={product.title}
          productImage={product.featuredImage?.url ?? ""}
          sizeOptions={sizeOptions}
          frameOptions={frameOptions}
          price={product.priceRange.minVariantPrice}
          variants={product.variants.nodes}
        />
      </section>
    </div>
  );
}

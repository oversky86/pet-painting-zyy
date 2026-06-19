import type { Product } from "./types";

const SHOP_DOMAIN = process.env.NEXT_PUBLIC_SHOP_DOMAIN!;
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_STOREFRONT_TOKEN!;
const API_VERSION = "2025-04";

const STOREFRONT_URL = `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`;

async function storefrontFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  });

  if (!res.ok) {
    throw new Error(`Storefront API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Storefront API GraphQL error: ${json.errors[0]?.message}`);
  }
  return json.data;
}

const PRODUCT_FRAGMENT = `
  fragment ProductFragment on Product {
    id
    title
    handle
    description
    descriptionHtml
    tags
    availableForSale
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 10) {
      nodes {
        url
        altText
        width
        height
      }
    }
    variants(first: 50) {
      nodes {
        id
        title
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        availableForSale
        selectedOptions {
          name
          value
        }
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
  }
`;

export async function getProducts(): Promise<Product[]> {
  const data = await storefrontFetch<{ products: { nodes: Product[] } }>(
    `query GetProducts { products(first: 20) { nodes { ...ProductFragment } } } ${PRODUCT_FRAGMENT}`
  );
  return data.products.nodes;
}

export async function getProductByHandle(handle: string): Promise<Product> {
  const data = await storefrontFetch<{ product: Product }>(
    `query GetProduct($handle: String!) { product(handle: $handle) { ...ProductFragment } } ${PRODUCT_FRAGMENT}`,
    { handle }
  );
  if (!data.product) {
    throw new Error(`Product not found: ${handle}`);
  }
  return data.product;
}

// Cart API (Storefront Cart API)
export async function createCart(lines: { merchandiseId: string; attributes?: { key: string; value: string }[] }[]) {
  const data = await storefrontFetch<{
    cartCreate: { cart: { id: string; checkoutUrl: string } };
  }>(
    `mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(lines: $lines) {
        cart { id checkoutUrl }
      }
    }`,
    { lines }
  );
  return data.cartCreate.cart;
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; attributes?: { key: string; value: string }[] }[]
) {
  const data = await storefrontFetch<{
    cartLinesAdd: { cart: { id: string; checkoutUrl: string } };
  }>(
    `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { id checkoutUrl }
      }
    }`,
    { cartId, lines }
  );
  return data.cartLinesAdd.cart;
}

export async function getCart(cartId: string) {
  const data = await storefrontFetch<{
    cart: {
      id: string;
      checkoutUrl: string;
      totalQuantity: number;
      cost: { totalAmount: { amount: string; currencyCode: string } };
      lines: {
        nodes: {
          id: string;
          quantity: number;
          merchandise: { id: string; title: string; price: { amount: string; currencyCode: string } };
          attributes: { key: string; value: string }[];
        };
      };
    };
  }>(
    `query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        id
        checkoutUrl
        totalQuantity
        cost { totalAmount { amount currencyCode } }
        lines(first: 50) {
          nodes {
            id quantity
            merchandise { ... on ProductVariant { id title price { amount currencyCode } } }
            attributes { key value }
          }
        }
      }
    }`,
    { cartId }
  );
  return data.cart;
}

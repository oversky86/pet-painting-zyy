import crypto, { createCipheriv, createDecipheriv, scryptSync } from "crypto";

const SHOP_DOMAIN = process.env.NEXT_PUBLIC_SHOP_DOMAIN!;
const CLIENT_ID = process.env.CUSTOMER_ACCOUNT_CLIENT_ID || process.env.SHOPIFY_API_KEY || "";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "default-secret-change-me-32chars!";
const API_VERSION = "2025-04";

// ─── OpenID Discovery ───────────────────────────────────────────────────────

interface OpenIDConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

interface CustomerApiConfig {
  graphql_api: string;
}

let cachedOpenID: OpenIDConfig | null = null;
let cachedApi: CustomerApiConfig | null = null;

export async function getOpenIDConfig(): Promise<OpenIDConfig> {
  if (cachedOpenID) return cachedOpenID;
  const res = await fetch(
    `https://${SHOP_DOMAIN}/.well-known/openid-configuration`
  );
  if (!res.ok) throw new Error(`Failed to fetch OpenID config: ${res.status}`);
  cachedOpenID = await res.json();
  return cachedOpenID!;
}

export async function getCustomerApiEndpoint(): Promise<CustomerApiConfig> {
  if (cachedApi) return cachedApi;
  const res = await fetch(
    `https://${SHOP_DOMAIN}/.well-known/customer-account-api`
  );
  if (!res.ok)
    throw new Error(`Failed to fetch Customer API config: ${res.status}`);
  cachedApi = await res.json();
  return cachedApi!;
}

// ─── PKCE Helpers ───────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ─── Cookie Encryption (AES-256-GCM) ────────────────────────────────────────

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "customer-account-salt", 32);
}

export function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(COOKIE_SECRET);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptValue(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const key = deriveKey(COOKIE_SECRET);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

// ─── Token Exchange ─────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { token_endpoint } = await getOpenIDConfig();
  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse | null> {
  try {
    const { token_endpoint } = await getOpenIDConfig();
    const res = await fetch(token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Customer Account API GraphQL ───────────────────────────────────────────

export async function customerGraphQL<T = unknown>(
  query: string,
  accessToken: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { graphql_api } = await getCustomerApiEndpoint();
  const res = await fetch(graphql_api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customer API error: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Customer API GraphQL error: ${json.errors[0]?.message}`);
  }
  return json.data as T;
}

// ─── Customer Profile Query ─────────────────────────────────────────────────

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  emailAddress: { emailAddress: string };
}

const CUSTOMER_QUERY = `
  query GetCustomer {
    customer {
      firstName
      lastName
      emailAddress { emailAddress }
    }
  }
`;

export async function getCustomerProfile(
  accessToken: string
): Promise<CustomerProfile | null> {
  try {
    const data = await customerGraphQL<{ customer: CustomerProfile | null }>(
      CUSTOMER_QUERY,
      accessToken
    );
    return data.customer;
  } catch {
    return null;
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

export { CLIENT_ID, SHOP_DOMAIN, API_VERSION };

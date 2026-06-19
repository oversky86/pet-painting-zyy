"use client";

import React, { memo } from "react";
import type { MoneyV2 } from "@/lib/types";
import { getStyleName } from "@/lib/prompts";

interface Props {
  style: string;
  size: string;
  frame: string;
  previewStatus: "none" | "generating" | "generated";
  price: MoneyV2;
  compareAtPrice: MoneyV2 | null;
  onCheckout: () => void;
  canContinue: boolean;
  isLoading?: boolean;
}

// Performance: React.memo to prevent unnecessary re-renders
export const SelectionsPanel = memo(function SelectionsPanel({
  style,
  size,
  frame,
  previewStatus,
  price,
  compareAtPrice,
  onCheckout,
  canContinue,
  isLoading = false,
}: Props) {
  const previewLabel =
    previewStatus === "generated"
      ? "Generated"
      : previewStatus === "generating"
        ? "Generating..."
        : "Not started";

  return (
    <aside
      className="flex flex-col gap-6 p-6 bg-white rounded-xl border border-[var(--color-border)] h-fit sticky top-24"
      aria-label="Your selections"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        Your Selections
      </h2>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Style</dt>
          <dd className="font-medium">{style ? getStyleName(style) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Size</dt>
          <dd className="font-medium">{size || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Frame</dt>
          <dd className="font-medium">{frame || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Preview</dt>
          <dd className="font-medium">{previewLabel}</dd>
        </div>
      </dl>

      <div className="border-t border-[var(--color-border)] pt-4">
        <p className="text-xs text-[var(--color-muted)]">All-in Price</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-3xl font-bold">
            {price.currencyCode === "USD" ? "$" : price.currencyCode}
            {price.amount}
          </p>
          {compareAtPrice && parseFloat(compareAtPrice.amount) > parseFloat(price.amount) && (
            <p className="text-lg text-[var(--color-muted)] line-through">
              {compareAtPrice.currencyCode === "USD" ? "$" : compareAtPrice.currencyCode}
              {compareAtPrice.amount}
            </p>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          Includes AI preview, painting, &amp; shipping.
        </p>
      </div>

      <button
        onClick={onCheckout}
        disabled={!canContinue || isLoading}
        className="w-full py-3 px-6 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-lg font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        aria-disabled={!canContinue || isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? "Creating Order..." : "Checkout"}
      </button>

      <button className="text-sm text-[var(--color-muted)] underline hover:text-[var(--foreground)] transition-colors">
        Save for later
      </button>

      {/* Trust features */}
      <ul className="space-y-2 pt-2 border-t border-[var(--color-border)]" aria-label="Features">
        {[
          "Free AI preview & revisions",
          "Hand-painted by real artists",
          "Museum-quality materials",
          "100% satisfaction guarantee",
        ].map((text) => (
          <li key={text} className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
            <span className="text-green-600 mt-0.5" aria-hidden="true">✓</span>
            {text}
          </li>
        ))}
      </ul>

      <p className="text-xs text-center text-[var(--color-muted)] pt-2">
        Handcrafted with heart. Delivered with care.
        <br />
        <span className="text-[10px]">
          Each painting is carefully hand-crafted by our artists and packaged to arrive safely at your door.
        </span>
      </p>
    </aside>
  );
});

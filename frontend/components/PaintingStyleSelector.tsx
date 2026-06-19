"use client";

import React, { memo } from "react";
import { PAINTING_STYLES } from "@/lib/prompts";

interface Props {
  selected: string;
  onSelect: (style: string) => void;
}

const STYLE_ENTRIES = Object.entries(PAINTING_STYLES).map(([key, value]) => ({
  key,
  ...value,
}));

// Performance: React.memo to prevent re-renders when unrelated state changes
export const PaintingStyleSelector = memo(function PaintingStyleSelector({
  selected,
  onSelect,
}: Props) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        2. Choose Style
      </p>
      <div
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Painting style"
      >
        {STYLE_ENTRIES.map((style) => {
          const isSelected = selected === style.key;
          return (
            <button
              key={style.key}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(style.key)}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-[var(--color-accent)] shadow-md"
                  : "border-transparent hover:border-[var(--color-border)]"
              }`}
            >
              {/* Style placeholder image */}
              <div
                className={`w-full h-full flex items-center justify-center ${
                  style.key === "classic-oil"
                    ? "bg-amber-900/10"
                    : "bg-blue-200/20"
                }`}
              >
                <span className="text-4xl" aria-hidden="true">
                  {style.key === "classic-oil" ? "🖼️" : "🎨"}
                </span>
              </div>

              {/* Label overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs font-medium">{style.name}</p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
});

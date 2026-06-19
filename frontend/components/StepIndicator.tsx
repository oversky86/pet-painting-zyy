"use client";

import React, { memo } from "react";
import type { Step } from "@/lib/types";

interface Props {
  currentStep: Step;
}

const STEPS: { key: Step; number: string; label: string }[] = [
  { key: "create", number: "01", label: "CREATE" },
  { key: "preview", number: "02", label: "PREVIEW" },
  { key: "details", number: "03", label: "DETAILS" },
  { key: "checkout", number: "04", label: "CHECKOUT" },
];

// Performance: React.memo to prevent re-renders when other state changes
export const StepIndicator = memo(function StepIndicator({ currentStep }: Props) {
  return (
    <nav aria-label="Customization steps" className="w-full py-4 bg-[var(--color-secondary)]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <a
            href="/"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors mr-auto"
          >
            ← Back to Home
          </a>
          <ol className="flex items-center gap-1 sm:gap-2 text-sm">
            {STEPS.map((step, index) => {
              const isActive = step.key === currentStep;
              return (
                <li key={step.key} className="flex items-center">
                  <span
                    className={`px-2 py-1 rounded font-medium tracking-wide transition-colors ${
                      isActive
                        ? "text-[var(--foreground)] font-bold"
                        : "text-[var(--color-muted)]"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {step.number} {step.label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span className="text-[var(--color-muted)] mx-1" aria-hidden="true">
                      –
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
});

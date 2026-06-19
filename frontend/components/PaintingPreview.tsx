"use client";

import React, { memo } from "react";

interface Props {
  paintingUrl: string;
  isGenerating: boolean;
  progress: number;
}

// Performance: React.memo to prevent unnecessary re-renders
export const PaintingPreview = memo(function PaintingPreview({
  paintingUrl,
  isGenerating,
  progress,
}: Props) {
  return (
    <div
      className="relative w-full aspect-[3/4] max-h-[600px] flex items-center justify-center"
      aria-label="Painting preview"
    >
      {/* Frame container - styled like the visual design */}
      <div className="relative w-full h-full max-w-md mx-auto">
        {/* Gold frame effect */}
        <div className="absolute inset-0 rounded-lg border-8 border-[var(--color-accent)]/40 shadow-xl bg-[var(--color-secondary)]" />

        {isGenerating ? (
          /* Generating state: progress indicator */
          <div className="absolute inset-8 flex flex-col items-center justify-center bg-[var(--foreground)]/80 rounded-lg">
            <div className="text-center text-white space-y-4 px-8">
              <p className="text-xs uppercase tracking-widest">Creating Portrait</p>
              <h3 className="text-lg font-semibold">
                Turning your photo into a keepsake painting
              </h3>
              <p className="text-sm text-white/70">
                Sketching silhouette and expression
              </p>
              <div className="w-full max-w-xs mx-auto">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Generation progress"
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-white/60">
                  <span>Studio in Progress</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </div>
          </div>
        ) : paintingUrl ? (
          /* Completed state: show the painting */
          <img
            src={paintingUrl}
            alt="Generated pet oil painting"
            className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] object-cover rounded-sm"
          />
        ) : (
          /* Empty state: placeholder */
          <div className="absolute inset-8 flex items-center justify-center">
            <p className="text-[var(--color-muted)] text-sm">
              Your painting will appear here
            </p>
          </div>
        )}
      </div>

      {/* Accessibility: live region for generation status */}
      <div aria-live="polite" className="sr-only">
        {isGenerating &&
          `Generating your painting, ${progress}% complete. Please wait...`}
        {paintingUrl && !isGenerating && "Your painting preview is ready."}
      </div>
    </div>
  );
});

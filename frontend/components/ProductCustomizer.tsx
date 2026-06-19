"use client";

import React, { useState, useCallback, useEffect, useRef, memo } from "react";
import type { Step, MoneyV2, ProductVariant } from "@/lib/types";
import { StepIndicator } from "./StepIndicator";
import { PetPhotoUpload } from "./PetPhotoUpload";
import { PaintingStyleSelector } from "./PaintingStyleSelector";
import { PaintingPreview } from "./PaintingPreview";
import { SelectionsPanel } from "./SelectionsPanel";
import { uploadPhoto, generatePreview, getJobStatus } from "@/lib/app-api";

interface Props {
  productHandle: string;
  productId: string;
  productTitle: string;
  productImage: string;
  sizeOptions: string[];
  frameOptions: string[];
  price: MoneyV2;
  variants: ProductVariant[];
}

// Performance: React.memo to prevent unnecessary re-renders from parent
export const ProductCustomizer = memo(function ProductCustomizer({
  productHandle,
  productTitle,
  productImage,
  sizeOptions,
  frameOptions,
  price,
}: Props) {
  // Step state
  const [step, setStep] = useState<Step>("create");

  // Form state
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFileId, setPhotoFileId] = useState("");
  const [style, setStyle] = useState("");
  const [size, setSize] = useState(sizeOptions[0] || "");
  const [frame, setFrame] = useState(frameOptions[0] || "");

  // Generation state
  const [jobId, setJobId] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [status, setStatus] = useState<
    "idle" | "uploading" | "generating" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Refs for cleanup
  const abortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Performance: useCallback for stable references
  const handlePhotoUpload = useCallback(async (file: File) => {
    setStatus("uploading");
    setErrorMessage("");
    try {
      const result = await uploadPhoto(file);
      setPhotoUrl(result.photo_url);
      setPhotoFileId(result.job_id);
      setStatus("idle");
    } catch {
      setErrorMessage("Upload failed. Please try again.");
      setStatus("error");
    }
  }, []);

  const handleStyleSelect = useCallback((s: string) => setStyle(s), []);

  const handleSizeChange = useCallback((s: string) => setSize(s), []);

  const handleFrameChange = useCallback((f: string) => setFrame(f), []);

  // Performance: Poll with exponential backoff (2s → 4s → 8s → 16s)
  const startPolling = useCallback(
    (id: string, attempt = 0) => {
      const delay = Math.min(2000 * Math.pow(2, attempt), 16000);

      pollTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await getJobStatus(id, abortRef.current?.signal);
          if (abortRef.current?.signal.aborted) return;

          if (result.status === "completed") {
            setResultUrl(result.result_url || "");
            setProgress(100);
            setStatus("done");
            return;
          }

          if (result.status === "failed") {
            setErrorMessage("Generation failed. Please try again.");
            setStatus("error");
            return;
          }

          // Still processing — update progress and continue polling
          setProgress(Math.min(90, 20 + attempt * 12));
          startPolling(id, attempt + 1);
        } catch {
          if (!abortRef.current?.signal.aborted) {
            setErrorMessage("Network error. Retrying...");
            startPolling(id, attempt + 1);
          }
        }
      }, delay);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!photoUrl || !style) return;
    setStatus("generating");
    setProgress(5);
    setErrorMessage("");

    try {
      const result = await generatePreview(photoUrl, style);
      setJobId(result.job_id);

      // Performance: AbortController for cancelling stale polling
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStep("preview");
      startPolling(result.job_id);
    } catch {
      setErrorMessage("Failed to start generation. Please try again.");
      setStatus("error");
    }
  }, [photoUrl, style, startPolling]);

  const handleContinueToDetails = useCallback(() => {
    if (status === "done") {
      setStep("details");
    }
  }, [status]);

  // Performance: Cleanup on unmount (prevent memory leaks)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const isGenerating = status === "generating";
  const canGenerate = photoUrl && style && !isGenerating;
  const canContinueToDetails = status === "done" && resultUrl;
  const previewStatus: "none" | "generating" | "generated" =
    status === "done" ? "generated" : isGenerating ? "generating" : "none";

  const showOrderPanel = status === "done" && !!resultUrl;

  return (
    <div className="space-y-0">
      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* 3-column layout for CREATE and PREVIEW steps */}
      {(step === "create" || step === "preview") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          {/* Left column: Photo upload + Style selection */}
          <div className="lg:col-span-3 space-y-8 border border-dashed border-[var(--color-border)] rounded-xl p-6">
            <PetPhotoUpload
              onUpload={handlePhotoUpload}
              photoUrl={photoUrl}
              fileId={photoFileId}
              isUploading={status === "uploading"}
            />

            <PaintingStyleSelector
              selected={style}
              onSelect={handleStyleSelect}
            />

            {/* Size selector */}
            {sizeOptions.length > 0 && (
              <div className="space-y-2">
                <label
                  htmlFor="size-select"
                  className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]"
                >
                  3. Size
                </label>
                <select
                  id="size-select"
                  value={size}
                  onChange={(e) => handleSizeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none"
                >
                  {sizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Frame selector */}
            {frameOptions.length > 0 && (
              <div className="space-y-2">
                <label
                  htmlFor="frame-select"
                  className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]"
                >
                  4. Frame
                </label>
                <select
                  id="frame-select"
                  value={frame}
                  onChange={(e) => handleFrameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[var(--color-accent)] focus:outline-none"
                >
                  {frameOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate / Regenerate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all ${
                isGenerating
                  ? "bg-[var(--color-muted)] text-white opacity-60 cursor-not-allowed"
                  : canGenerate
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
                    : "bg-[var(--color-border)] text-[var(--color-muted)] cursor-not-allowed"
              }`}
              aria-busy={isGenerating}
            >
              {isGenerating
                ? "Generating..."
                : resultUrl
                  ? "Regenerate"
                  : "Generate Preview"}
            </button>

            {/* Error message */}
            {errorMessage && (
              <p className="text-red-600 text-sm" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Center column: Canvas preview */}
          <div className={`flex items-center justify-center ${showOrderPanel ? "lg:col-span-6" : "lg:col-span-9"}`}>
            <PaintingPreview
              paintingUrl={resultUrl}
              isGenerating={isGenerating}
              progress={progress}
            />
          </div>

          {/* Right column: Order panel — only shown after image generation */}
          {showOrderPanel && (
            <div className="lg:col-span-3">
              <SelectionsPanel
                style={style}
                size={size}
                frame={frame}
                previewStatus={previewStatus}
                price={price}
                onContinue={handleContinueToDetails}
                canContinue={!!canContinueToDetails}
              />
            </div>
          )}
        </div>
      )}

      {/* DETAILS step (step 03) — placeholder for Task 9 */}
      {step === "details" && (
        <section className="max-w-2xl mx-auto py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Order Details</h2>
          <p className="text-[var(--color-muted)]">
            Shipping information and special instructions will be collected here.
          </p>
        </section>
      )}

      {/* CHECKOUT step (step 04) — placeholder for Task 9 */}
      {step === "checkout" && (
        <section className="max-w-2xl mx-auto py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Checkout</h2>
          <p className="text-[var(--color-muted)]">
            Shopify checkout integration coming soon.
          </p>
        </section>
      )}
    </div>
  );
});

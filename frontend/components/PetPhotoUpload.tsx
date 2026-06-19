"use client";

import React, { useCallback, useRef, useState, memo } from "react";

interface Props {
  onUpload: (file: File) => void;
  photoUrl: string;
  fileId: string;
  isUploading: boolean;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

// Performance: Client-side image compression using Canvas
function compressImage(file: File, maxSize = 2 * 1024 * 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      // Resize to max 1200px on longest side
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size <= maxSize) {
            resolve(blob);
          } else {
            // Reduce quality if still too large
            canvas.toBlob(
              (compressed) => compressed ? resolve(compressed) : reject(new Error("Compression failed")),
              "image/jpeg",
              0.7
            );
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Performance: React.memo to prevent re-renders
export const PetPhotoUpload = memo(function PetPhotoUpload({
  onUpload,
  photoUrl,
  fileId,
  isUploading,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      setError("");

      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Please upload a JPG, PNG, or WebP image.");
        return;
      }

      // Validate size
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
        return;
      }

      // Performance: instant local preview via FileReader
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);

      try {
        // Performance: compress image on client before upload
        const compressed = await compressImage(file);
        const compressedFile = new File([compressed], file.name, {
          type: "image/jpeg",
        });
        onUpload(compressedFile);
      } catch {
        setError("Failed to process image. Please try again.");
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChangePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const displayUrl = photoUrl || localPreview;

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        Studio Upload
      </p>
      <h3 className="font-semibold">Upload Your Pet&apos;s Photo</h3>

      {displayUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-secondary)]">
          <img
            src={displayUrl}
            alt="Uploaded pet photo"
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
              Photo uploaded
            </span>
          </div>
          {fileId && (
            <p className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded">
              {fileId.slice(0, 32)}...
            </p>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
              : "border-[var(--color-border)] hover:border-[var(--color-muted)]"
          }`}
          aria-label="Upload pet photo - click or drag and drop"
        >
          <p className="text-[var(--color-muted)] text-sm">
            {dragOver ? "Drop your photo here" : "Click or drag & drop your pet photo"}
          </p>
          <p className="text-xs text-[var(--color-muted)]/60 mt-1">
            JPG, PNG, WebP • Max {MAX_SIZE_MB}MB
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm" role="alert">{error}</p>
      )}

      {/* Accessibility: live region for upload/generation status */}
      <div aria-live="polite" className="sr-only">
        {isUploading && "Uploading your photo..."}
      </div>

      <div className="flex gap-2">
        {isUploading && (
          <button
            disabled
            className="px-4 py-2 bg-[var(--color-muted)] text-white rounded-lg text-sm opacity-60 cursor-not-allowed"
            aria-busy
          >
            Uploading...
          </button>
        )}
        {displayUrl && (
          <button
            onClick={handleChangePhoto}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm hover:bg-[var(--color-secondary)] transition-colors"
          >
            Change Photo
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </section>
  );
});

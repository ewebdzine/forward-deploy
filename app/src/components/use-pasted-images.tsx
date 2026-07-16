"use client";

import { useState } from "react";

export type PastedImage = { dataUrl: string; mediaType: string };

/**
 * Clipboard-image support for the chat composers: paste screenshots, preview
 * as thumbnails, ship as base64 for the current turn only.
 */
export function usePastedImages(max = 3) {
  const [images, setImages] = useState<PastedImage[]>([]);

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData?.items ?? []).filter(
      (i) => i.kind === "file" && i.type.startsWith("image/")
    );
    if (!files.length) return; // plain text paste proceeds normally
    e.preventDefault();
    for (const item of files) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) =>
          prev.length >= max
            ? prev
            : [...prev, { dataUrl: String(reader.result), mediaType: file.type }]
        );
      };
      reader.readAsDataURL(file);
    }
  }

  function remove(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function clear() {
    setImages([]);
  }

  /** API payload shape: strip the data-URL prefix down to raw base64. */
  function payload(): { mediaType: string; data: string }[] {
    return images.map((i) => ({
      mediaType: i.mediaType,
      data: i.dataUrl.split(",")[1] ?? "",
    }));
  }

  return { images, onPaste, remove, clear, payload };
}

export function PastedThumbs({
  images,
  onRemove,
}: {
  images: PastedImage[];
  onRemove: (index: number) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="paste-strip">
      {images.map((img, i) => (
        <span className="paste-thumb" key={i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.dataUrl} alt={`pasted screenshot ${i + 1}`} />
          <button type="button" title="Remove" onClick={() => onRemove(i)}>
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}

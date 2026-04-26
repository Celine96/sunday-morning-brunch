"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductImageProps {
  src?: string;
  alt: string;
  size?: "sm" | "lg";
}

export default function ProductImage({ src, alt, size = "sm" }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full h-full"
        style={{
          background: "linear-gradient(135deg, #F5F0E8 0%, #EDE5D8 50%, #E8DCC8 100%)",
        }}
      >
        <svg
          className={size === "lg" ? "w-16 h-16" : "w-10 h-10"}
          fill="none"
          viewBox="0 0 24 24"
          stroke="#D4C9B5"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
        <span className="text-xs text-warm-400 mt-2">No Image</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      sizes={size === "lg" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      onError={() => setHasError(true)}
    />
  );
}

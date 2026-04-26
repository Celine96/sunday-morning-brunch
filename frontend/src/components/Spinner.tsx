"use client";

export default function Spinner({
  size = "h-8 w-8",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full ${size} border-b-2 border-amber-500`}
      />
    </div>
  );
}

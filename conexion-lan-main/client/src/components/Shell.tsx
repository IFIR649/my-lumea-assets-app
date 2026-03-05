import type React from "react";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(15,23,42,0.10),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgba(2,132,199,0.10),transparent_50%),linear-gradient(to_bottom,rgba(248,250,252,1),rgba(241,245,249,1))]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {children}
      </div>
    </div>
  );
}

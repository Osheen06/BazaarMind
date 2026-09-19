import React, { useEffect, useState } from "react";

const MESSAGES = [
  "Listening to the market…",
  "Interpreting your signal…",
  "Checking available market evidence…",
  "Corroborating vendor observations…",
];

export function ListeningLoader({ label }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (label) return;
    const t = setInterval(() => setI((v) => (v + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, [label]);
  return (
    <div className="flex items-center gap-3 text-sm text-[#5C6360]" data-testid="loading-indicator">
      <span className="relative inline-flex h-2.5 w-2.5 text-[#1E5631]">
        <span className="bm-pulse-ring" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1E5631]" />
      </span>
      <span>{label || MESSAGES[i]}</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 w-24 bg-[#F0EBDE] rounded" />
        <div className="h-6 w-28 bg-[#F0EBDE] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="h-8 bg-[#F0EBDE] rounded" />
        <div className="h-8 bg-[#F0EBDE] rounded" />
      </div>
      <div className="h-16 bg-[#F0EBDE] rounded-xl mt-4" />
      <div className="h-4 bg-[#F0EBDE] rounded mt-4" />
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((d) => (
        <span key={d} className="h-1.5 w-1.5 rounded-full bg-[#1E5631] bm-blink" style={{ animationDelay: `${d * 0.2}s` }} />
      ))}
    </span>
  );
}

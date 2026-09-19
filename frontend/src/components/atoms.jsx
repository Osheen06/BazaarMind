import React from "react";
import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";

const cx = (...c) => c.filter(Boolean).join(" ");

export function SectionLabel({ children, className }) {
  return (
    <div className={cx("text-xs font-semibold tracking-[0.14em] uppercase text-[#5C6360]", className)}>
      {children}
    </div>
  );
}

export function Chip({ children, tone = "neutral", className, ...rest }) {
  const tones = {
    neutral: "bg-[#F7F4EE] text-[#5C6360] border-[#E5DEC9]",
    green: "bg-[#1E5631]/8 text-[#1E5631] border-[#1E5631]/20",
    orange: "bg-[#D96B27]/10 text-[#B4571E] border-[#D96B27]/25",
    red: "bg-[#C53030]/8 text-[#C53030] border-[#C53030]/20",
    ink: "bg-[#1E2022] text-[#FDFBF7] border-transparent",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function ConfidenceBadge({ level, className }) {
  const map = {
    High: { tone: "green", Icon: ShieldCheck },
    Medium: { tone: "orange", Icon: Shield },
    Low: { tone: "red", Icon: ShieldAlert },
  };
  const { tone, Icon } = map[level] || map.Low;
  return (
    <Chip tone={tone} className={className} data-testid="confidence-badge">
      <Icon className="h-3.5 w-3.5" />
      {level} confidence
    </Chip>
  );
}

const AVAIL_TONE = { Tight: "orange", Limited: "orange", Good: "green", Normal: "neutral", Unknown: "neutral" };
const DEMAND_TONE = { Elevated: "orange", Normal: "neutral", Low: "neutral", Unknown: "neutral" };

export function AvailabilityPill({ value }) {
  return <Chip tone={AVAIL_TONE[value] || "neutral"}>{value}</Chip>;
}
export function DemandPill({ value }) {
  return <Chip tone={DEMAND_TONE[value] || "neutral"}>{value}</Chip>;
}

export function DemoNote({ className, children }) {
  return (
    <p className={cx("text-xs text-[#8A8A82] italic", className)}>
      {children || "Demo data — synthetic signals for product demonstration."}
    </p>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold text-[#1E2022]">{value}</div>
      <div className="text-xs font-semibold tracking-wide uppercase text-[#5C6360] mt-0.5">{label}</div>
      {sub && <div className="text-xs text-[#8A8A82] mt-0.5">{sub}</div>}
    </div>
  );
}

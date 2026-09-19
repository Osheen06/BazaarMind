import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { getMarketPulse, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import SignalCard from "../components/SignalCard";
import { CardSkeleton } from "../components/Loading";
import { SectionLabel, ConfidenceBadge, DemoNote } from "../components/atoms";

export default function MarketPulse() {
  const { marketId, pulseVersion } = useApp();
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getMarketPulse(marketId)
      .then(setPulse)
      .catch(() => setPulse(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); trackEvent("market_pulse_viewed"); /* eslint-disable-next-line */ }, [marketId, pulseVersion]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <SectionLabel>Today's Market Pulse</SectionLabel>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[#1E2022] mt-1">
            {pulse?.market?.name || "Market"}
          </h1>
          <p className="text-sm text-[#5C6360] mt-1">
            Last updated {pulse?.lastUpdated || "—"} · {pulse?.totalSignals ?? 0} signals combined
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pulse && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E5DEC9] px-3 py-1.5 text-xs font-semibold text-[#1E2022]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1E5631]" /> Overall: {pulse.overallConfidence}
            </span>
          )}
          <button
            onClick={load}
            data-testid="refresh-pulse-button"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1E5631] text-[#FDFBF7] px-3.5 py-1.5 text-xs font-semibold hover:bg-[#194727] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#D96B27]/8 border border-[#D96B27]/20 px-3.5 py-2.5">
        <DemoNote className="not-italic text-[#B4571E] font-medium">
          Demo data — synthetic signals for product demonstration. Values are illustrative, not real-world measurements.
        </DemoNote>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {loading && !pulse
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : (pulse?.products || []).map((p, i) => <SignalCard key={p.product} p={p} index={i} />)}
      </div>

      {!loading && pulse && pulse.products.length === 0 && (
        <div className="mt-8 text-center text-[#5C6360]">I don't have enough signals from this market yet.</div>
      )}

      <p className="mt-8 text-xs text-[#8A8A82]">
        Prices shown are reported signals, not guaranteed prices. BazaarMind never ranks a cheapest vendor. AI interprets — humans decide.
      </p>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Store, Sparkles, ArrowDown, ArrowUp, History } from "lucide-react";
import { getMarketNetwork, getSnapshots, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import { SectionLabel, Chip, DemoNote } from "../components/atoms";

export default function MarketNetwork() {
  const { marketId } = useApp();
  const [net, setNet] = useState(null);
  const [snaps, setSnaps] = useState([]);

  useEffect(() => {
    getMarketNetwork(marketId).then(setNet).catch(() => {});
    getSnapshots(marketId).then((r) => setSnaps(r.snapshots || [])).catch(() => {});
    trackEvent("market_network_viewed");
  }, [marketId]);

  return (
    <div>
      <SectionLabel>Market Network</SectionLabel>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[#1E2022] mt-1">One market, heard as a network</h1>
      <p className="text-sm text-[#5C6360] mt-1 max-w-2xl">
        More shoppers create demand signals. More vendors create supply signals. Gemini interprets both. Together they become market intelligence.
      </p>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 mt-6">
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 md:p-8" data-testid="network-graph-container">
          <NetworkGraph net={net} />
          <DemoNote className="mt-4 text-center">
            Demo environment — synthetic market data. Node counts reflect live signals in the demo state; no precise geographic tracking.
          </DemoNote>
        </div>

        <div className="flex flex-col gap-3">
          <StatCard icon={Users} label="Shopper signals" value={net?.shopperSignals ?? "—"} tone="green" desc="Aggregated demand — never individual identity" />
          <StatCard icon={Store} label="Supply signals" value={net?.supplySignals ?? "—"} tone="orange" desc={`${net?.vendors?.length ?? 0} vendors participating`} />
          <div className="bg-[#F7F4EE] border border-[#E5DEC9] rounded-2xl p-4">
            <div className="text-xs font-semibold tracking-wide uppercase text-[#5C6360] mb-2">Layered model</div>
            <div className="text-sm text-[#3A403D] leading-relaxed font-mono">
              SHOPPER SIGNALS<br />↓ demand layer<br /><b>MARKET</b><br />↑ supply layer<br />VENDORS
            </div>
          </div>
        </div>
      </div>

      {/* Vendors */}
      <div className="mt-6">
        <div className="text-sm font-semibold text-[#1E2022] mb-2">Participating vendors (sensors)</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(net?.vendors || []).map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white border border-[#E5DEC9] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#1E2022]">{v.name}</div>
                <div className="text-[11px] text-[#8A8A82]">{v.stall}</div>
              </div>
              <Chip tone="green">{v.supplySignals} signals</Chip>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Snapshots */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2022] mb-2">
          <History className="h-4 w-4" /> Market snapshots
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {snaps.map((s) => (
            <div key={s.id} className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[#1E2022]">{s.label}</span>
                <Chip tone="neutral">synthetic</Chip>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {s.changes.map((c, i) => (
                  <div key={i} className="text-xs text-[#3A403D]">
                    <span className="font-semibold">{c.product}</span> {c.field}: <span className="text-[#8A8A82]">{c.from}</span> → <span className="text-[#1E5631] font-semibold">{c.to}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DemoNote className="mt-3">Historical snapshots are synthetic demo data. Architecture supports real captured snapshots over time.</DemoNote>
      </div>
    </div>
  );
}

function NetworkGraph({ net }) {
  const vendors = (net?.vendors || []).slice(0, 6);
  return (
    <div className="relative">
      <svg viewBox="0 0 600 360" className="w-full h-auto">
        {/* demand edges (top -> market) */}
        {[0, 1, 2, 3].map((i) => (
          <line key={`d${i}`} x1={120 + i * 120} y1="60" x2="300" y2="180" stroke="#1E5631" strokeOpacity="0.35" strokeWidth="1.5" className="bm-flow" />
        ))}
        {/* supply edges (market -> bottom) */}
        {vendors.map((_, i) => {
          const x = 80 + i * (440 / Math.max(vendors.length - 1, 1));
          return <line key={`s${i}`} x1="300" y1="180" x2={x} y2="300" stroke="#D96B27" strokeOpacity="0.4" strokeWidth="1.5" className="bm-flow" />;
        })}

        {/* shopper nodes */}
        {[0, 1, 2, 3].map((i) => (
          <g key={`sn${i}`}>
            <circle cx={120 + i * 120} cy="60" r="16" fill="#1E5631" fillOpacity="0.1" stroke="#1E5631" strokeOpacity="0.4" />
            <foreignObject x={104 + i * 120} y="44" width="32" height="32">
              <div className="flex items-center justify-center h-full text-[#1E5631]"><Users size={16} /></div>
            </foreignObject>
          </g>
        ))}

        {/* market hub */}
        <circle cx="300" cy="180" r="46" fill="#1E5631" />
        <circle cx="300" cy="180" r="46" fill="none" stroke="#1E5631" strokeOpacity="0.25" strokeWidth="14">
          <animate attributeName="r" values="46;58;46" dur="3s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
        </circle>
        <text x="300" y="176" textAnchor="middle" fill="#FDFBF7" fontSize="13" fontWeight="700" fontFamily="Outfit">MARKET</text>
        <text x="300" y="192" textAnchor="middle" fill="#FDFBF7" fontSize="9" opacity="0.8">Gemini interprets</text>

        {/* vendor nodes */}
        {vendors.map((v, i) => {
          const x = 80 + i * (440 / Math.max(vendors.length - 1, 1));
          return (
            <g key={v.id}>
              <circle cx={x} cy="300" r="15" fill="#D96B27" fillOpacity="0.12" stroke="#D96B27" strokeOpacity="0.5" />
              <foreignObject x={x - 15} y="285" width="30" height="30">
                <div className="flex items-center justify-center h-full text-[#B4571E]"><Store size={15} /></div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mt-1">
        <span className="inline-flex items-center gap-1 text-[#1E5631]"><ArrowDown className="h-3.5 w-3.5" /> Demand · shoppers</span>
        <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[#1E5631]" /> Gemini</span>
        <span className="inline-flex items-center gap-1 text-[#B4571E]"><ArrowUp className="h-3.5 w-3.5" /> Supply · vendors</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, desc }) {
  const tones = { green: "bg-[#1E5631]/8 text-[#1E5631]", orange: "bg-[#D96B27]/10 text-[#B4571E]" };
  return (
    <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
      <div className={`h-9 w-9 rounded-lg ${tones[tone]} flex items-center justify-center`}><Icon className="h-4.5 w-4.5 h-5 w-5" /></div>
      <div className="font-display text-2xl font-bold text-[#1E2022] mt-2">{value}</div>
      <div className="text-xs font-semibold tracking-wide uppercase text-[#5C6360]">{label}</div>
      <div className="text-[11px] text-[#8A8A82] mt-0.5">{desc}</div>
    </div>
  );
}

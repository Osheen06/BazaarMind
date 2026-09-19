import React from "react";
import { motion } from "framer-motion";
import { Boxes, TrendingUp, IndianRupee, Users, Store, Clock, AlertTriangle } from "lucide-react";
import { AvailabilityPill, DemandPill, ConfidenceBadge } from "./atoms";

export default function SignalCard({ p, index = 0 }) {
  return (
    <motion.div
      data-testid="market-pulse-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-[0_1px_2px_rgba(30,32,34,0.04)] hover:shadow-[0_8px_28px_rgba(30,32,34,0.08)] transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-[#1E2022]">{p.product}</h3>
        <ConfidenceBadge level={p.confidence} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field icon={Boxes} label="Availability"><AvailabilityPill value={p.availability} /></Field>
        <Field icon={TrendingUp} label="Demand"><DemandPill value={p.demand} /></Field>
      </div>

      <div className="mt-4 rounded-xl bg-[#F7F4EE] border border-[#E5DEC9] px-3.5 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-[#5C6360]">
          <IndianRupee className="h-3.5 w-3.5" /> Reported price signal
        </div>
        <div className="font-display text-xl font-bold text-[#1E2022] mt-1">
          {p.reportedPriceSignal || "No price reported"}
        </div>
        <div className="text-[11px] text-[#8A8A82] mt-0.5">Vendor-reported range · not a guaranteed price</div>
      </div>

      {p.conflicting && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#B4571E]">
          <AlertTriangle className="h-3.5 w-3.5" /> Vendors are reporting different conditions.
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#E5DEC9] flex items-center justify-between text-xs text-[#5C6360]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />{p.vendorObservations} vendor</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.shopperSignals} shopper</span>
        </div>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{p.lastUpdated}</span>
      </div>
    </motion.div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {children}
    </div>
  );
}

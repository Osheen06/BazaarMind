import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Network, Store, Users, Sparkles, MessageSquare } from "lucide-react";
import { trackEvent } from "../lib/api";

const HERO_IMG =
  "https://images.pexels.com/photos/37904046/pexels-photo-37904046.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => { trackEvent("landing_viewed"); }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF7] bm-noise">
      <header className="max-w-6xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#1E5631] flex items-center justify-center">
            <Network className="h-5 w-5 text-[#FDFBF7]" />
          </div>
          <span className="font-display font-extrabold text-[#1E2022] tracking-tight">BazaarMind</span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#1E5631]/8 border border-[#1E5631]/20 px-3 py-1.5 text-xs font-semibold text-[#1E5631]">
          <Radio className="h-3.5 w-3.5" /> Live Gemini + Synthetic demo signals
        </span>
      </header>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-6 md:pt-12 pb-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-xs font-semibold text-[#5C6360] mb-6"
          >
            Neighborhood market intelligence · Delhi NCR
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1E2022] leading-[1.02]"
          >
            The Market That<br /> Thinks as One.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-5 text-[#3A403D] text-base sm:text-lg leading-relaxed max-w-md"
          >
            Every shopper is a signal. Every vendor is a sensor. The market is the network.
            <span className="text-[#1E5631] font-semibold"> Gemini is the interpreter.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-8 flex flex-col sm:flex-row gap-3"
          >
            <button
              data-testid="cta-see-pulse"
              onClick={() => { trackEvent("cta_see_pulse"); navigate("/pulse"); }}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#1E5631] px-6 py-3.5 text-[#FDFBF7] font-semibold hover:bg-[#194727] transition-colors"
            >
              See Today's Market Pulse
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              data-testid="cta-try"
              onClick={() => { trackEvent("cta_try"); navigate("/shop"); }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-[#E5DEC9] px-6 py-3.5 text-[#1E2022] font-semibold hover:bg-[#F7F4EE] transition-colors"
            >
              Try BazaarMind
            </button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <div className="rounded-3xl overflow-hidden border border-[#E5DEC9] shadow-[0_20px_60px_rgba(30,32,34,0.14)]">
            <img src={HERO_IMG} alt="Delhi neighborhood market" className="w-full h-[300px] md:h-[420px] object-cover" />
          </div>
          <FlywheelCard />
        </motion.div>
      </section>

      {/* Signal → Intelligence diagram */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-10">
        <div className="rounded-3xl bg-[#F7F4EE] border border-[#E5DEC9] p-6 md:p-10">
          <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-center text-center">
            <DiagramNode icon={Users} title="Shopper signals" desc="What the neighborhood wants" tone="green" />
            <Plus />
            <DiagramNode icon={Store} title="Vendor signals" desc="What stalls actually see" tone="orange" />
            <Plus />
            <DiagramNode icon={Sparkles} title="Gemini" desc="Interprets multilingual input" tone="ink" />
          </div>
          <div className="flex justify-center my-4 text-[#B8B2A0]">↓</div>
          <div className="rounded-2xl bg-[#1E5631] text-[#FDFBF7] px-6 py-5 text-center">
            <div className="text-xs tracking-[0.16em] uppercase opacity-80">Living output</div>
            <div className="font-display text-2xl font-bold mt-1">Market Intelligence</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <p className="font-display text-xl md:text-2xl text-[#1E2022] max-w-2xl leading-snug">
          "The market doesn't need to become smarter. It needs a way to hear itself."
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => navigate("/vendor")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E5631] hover:underline">
            <Store className="h-4 w-4" /> I'm a vendor
          </button>
          <button onClick={() => navigate("/shop")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E5631] hover:underline">
            <MessageSquare className="h-4 w-4" /> I'm a shopper
          </button>
        </div>
        <p className="mt-8 text-xs text-[#8A8A82] max-w-xl">
          Demo environment — synthetic market data. Gemini interpretation is live. No real users, vendors, pilot results,
          or partnerships are represented.
        </p>
      </section>
    </div>
  );
}

function FlywheelCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
      className="absolute -bottom-6 -left-2 sm:left-4 bg-white border border-[#E5DEC9] rounded-2xl shadow-lg px-4 py-3 max-w-[220px]"
    >
      <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360]">Today's Market Pulse</div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-semibold text-[#1E2022] text-sm">Tomatoes</span>
        <span className="text-xs font-semibold text-[#B4571E]">Tight</span>
      </div>
      <div className="text-xs text-[#5C6360]">₹55–₹60/kg · Medium confidence</div>
    </motion.div>
  );
}

function DiagramNode({ icon: Icon, title, desc, tone }) {
  const tones = {
    green: "bg-[#1E5631]/8 text-[#1E5631]",
    orange: "bg-[#D96B27]/10 text-[#B4571E]",
    ink: "bg-[#1E2022] text-[#FDFBF7]",
  };
  return (
    <div className="rounded-2xl bg-white border border-[#E5DEC9] px-4 py-5">
      <div className={`h-11 w-11 rounded-xl ${tones[tone]} flex items-center justify-center mx-auto`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-[#1E2022] mt-3 text-sm">{title}</div>
      <div className="text-xs text-[#5C6360] mt-0.5">{desc}</div>
    </div>
  );
}
const Plus = () => <div className="text-[#B8B2A0] font-display text-xl hidden md:block">+</div>;

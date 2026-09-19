import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getPilotMetrics, getPilotStatus, createInvite, trackEvent } from "../lib/api";
import {
  Target, Users, Store, Building2, TrendingUp, Layers, Map, ShoppingCart, Truck, Network, Quote, UserPlus, Activity, Link2, Copy, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { SectionLabel, Chip } from "../components/atoms";

const TABS = [
  { id: "pilot", label: "Pilot" },
  { id: "status", label: "Live Status" },
  { id: "onboard", label: "Onboard" },
  { id: "model", label: "Business Model" },
  { id: "moat", label: "Moat" },
  { id: "roadmap", label: "Roadmap" },
  { id: "positioning", label: "Positioning" },
  { id: "research", label: "Research" },
];

export default function PilotBusiness() {
  const [tab, setTab] = useState("pilot");
  const [pilot, setPilot] = useState(null);

  useEffect(() => { getPilotMetrics().then(setPilot).catch(() => {}); trackEvent("business_viewed"); }, []);

  return (
    <div>
      <SectionLabel>Pilot & Business</SectionLabel>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[#1E2022] mt-1">The system behind the pulse</h1>
      <p className="text-sm text-[#5C6360] mt-1 max-w-2xl">
        A hypothesis-stage plan. Nothing here represents real traction, revenue, users, or partnerships.
      </p>

      <div className="flex gap-2 flex-wrap mt-5 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`biz-tab-${t.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-[#1E5631] text-[#FDFBF7]" : "bg-white border border-[#E5DEC9] text-[#3A403D] hover:bg-[#F7F4EE]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === "pilot" && <Pilot pilot={pilot} />}
        {tab === "status" && <LiveStatus />}
        {tab === "onboard" && <Onboard />}
        {tab === "model" && <Model />}
        {tab === "moat" && <Moat />}
        {tab === "roadmap" && <Roadmap />}
        {tab === "positioning" && <Positioning />}
        {tab === "research" && <Research />}
      </motion.div>
    </div>
  );
}

function LiveStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => { getPilotStatus().then(setStatus).catch(() => {}); }, []);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2022]"><Activity className="h-4 w-4 text-[#1E5631]" /> Database-derived pilot metrics</div>
        <Chip tone={status?.hasPilotData ? "green" : "orange"}>{status?.environment || "DEMO"} environment</Chip>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="pilot-status-metrics">
        {(status?.metrics || []).map((m) => (
          <div key={m.name} className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
            <div className="text-xs font-semibold tracking-wide uppercase text-[#5C6360]">{m.name}</div>
            <div className="font-display text-2xl font-bold text-[#1E2022] mt-1">{m.display}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#8A8A82]">
        These read live from the database. Until real pilot participants join, they honestly show "Awaiting pilot data" — no fabricated traction.
      </p>
    </div>
  );
}

function Onboard() {
  const navigate = useNavigate();
  const [community, setCommunity] = useState("");
  const [invite, setInvite] = useState(null);
  const link = invite ? `${window.location.origin}/join?invite=${invite.code}` : "";

  const generate = async () => {
    if (!community.trim()) { toast.error("Enter a community / RWA name first."); return; }
    const res = await createInvite(community.trim(), "demo-ina");
    setInvite(res);
    trackEvent("pilot_invite_created");
  };
  const copy = () => { navigator.clipboard.writeText(link); toast.success("Invite link copied."); };
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join our BazaarMind market pilot: ${link}`)}`, "_blank");

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl bg-white border border-[#E5DEC9] p-6">
        <div className="h-11 w-11 rounded-xl bg-[#1E5631]/8 flex items-center justify-center text-[#1E5631]"><UserPlus className="h-5 w-5" /></div>
        <h2 className="font-display text-xl font-bold text-[#1E2022] mt-3">Run the 14-day INA Market pilot</h2>
        <p className="text-sm text-[#5C6360] mt-1">
          Onboard 20–50 households and 10–15 vendors from one community. Onboarding takes under a minute and drops the participant
          straight into the real experience. Their contributions are labelled PILOT (kept separate from demo signals).
        </p>
        <button onClick={() => navigate("/join")} data-testid="onboard-cta"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1E5631] text-[#FDFBF7] px-5 py-2.5 text-sm font-semibold hover:bg-[#194727]">
          <UserPlus className="h-4 w-4" /> Open onboarding
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-[#E5DEC9] p-6">
        <div className="h-11 w-11 rounded-xl bg-[#D96B27]/10 flex items-center justify-center text-[#B4571E]"><Link2 className="h-5 w-5" /></div>
        <h2 className="font-display text-xl font-bold text-[#1E2022] mt-3">Shareable RWA invite link</h2>
        <p className="text-sm text-[#5C6360] mt-1">Generate one link for a whole community. Everyone who taps it joins the pilot in one tap, pre-filled with the community and market.</p>
        <div className="mt-3 flex gap-2">
          <input value={community} onChange={(e) => setCommunity(e.target.value)} placeholder="Green Meadows RWA"
            data-testid="invite-community-input" className="flex-1 rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white" />
          <button onClick={generate} data-testid="invite-generate-button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E5631] text-[#FDFBF7] px-4 py-2 text-sm font-semibold hover:bg-[#194727]">
            <Link2 className="h-4 w-4" /> Generate
          </button>
        </div>
        {invite && (
          <div className="mt-3 rounded-xl bg-[#F7F4EE] border border-[#E5DEC9] p-3" data-testid="invite-link-box">
            <div className="font-mono text-xs text-[#1E2022] break-all">{link}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={copy} data-testid="invite-copy-button" className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E2022] hover:bg-white">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-[#1E5631] text-[#FDFBF7] px-3 py-1.5 text-xs font-semibold hover:bg-[#194727]">
                <Share2 className="h-3.5 w-3.5" /> Share on WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pilot({ pilot }) {
  const s = pilot?.setup;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          ["Communities", s?.community ?? 1], ["Markets", s?.market ?? 1], ["Vendors", s?.vendors ?? "10–15"],
          ["Households", s?.households ?? "20–50"], ["Duration", `${s?.durationDays ?? 14} days`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white border border-[#E5DEC9] rounded-2xl p-4 text-center">
            <div className="font-display text-xl font-bold text-[#1E2022]">{v}</div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mt-1">{k}</div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(pilot?.metrics || []).map((m) => (
          <div key={m.name} className="bg-white border border-[#E5DEC9] rounded-2xl p-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-[#1E2022] text-sm flex items-center gap-1.5"><Target className="h-4 w-4 text-[#1E5631]" /> {m.name}</div>
              <div className="text-xs text-[#5C6360] mt-1">Target: {m.target}</div>
            </div>
            <Chip tone="orange">{m.status}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

function Model() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#F7F4EE] border border-[#E5DEC9] p-6">
        <div className="grid md:grid-cols-3 gap-4 text-center items-center">
          <Node title="User" who="Shopper" desc="Checks the market before leaving home" icon={Users} tone="green" />
          <Node title="Payer" who="Vendor" desc="Wants neighborhood demand intelligence" icon={Store} tone="orange" />
          <Node title="Beneficiary / Distribution" who="Community / RWA" desc="Local commerce partner" icon={Building2} tone="ink" />
        </div>
        <p className="text-center text-sm text-[#3A403D] mt-4 font-semibold">USER ≠ PAYER ≠ BENEFICIARY</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          ["Vendor intelligence subscription", "Aggregated neighborhood demand + market pulse for participating vendors."],
          ["Qualified demand / transaction fee", "A future fee on qualified demand, only if commerce integrations are added."],
          ["RWA / community partnership", "Distribution through resident communities."],
          ["Consumer premium intelligence (later)", "Optional premium market insights for power shoppers."],
        ].map(([t, d]) => (
          <div key={t} className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
            <div className="font-semibold text-[#1E2022] text-sm">{t}</div>
            <div className="text-xs text-[#5C6360] mt-1">{d}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8A8A82]">Pricing is a hypothesis — to be validated through willingness-to-pay interviews. No pricing is claimed.</p>
    </div>
  );
}

function Moat() {
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-[#1E2022]">From market signals to a local market intelligence graph</h2>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {["Demand history", "Supply history", "Vendor participation", "Market snapshots", "Neighborhood behavior", "Temporal patterns"].map((x) => (
          <div key={x} className="bg-white border border-[#E5DEC9] rounded-xl px-4 py-3 text-sm font-medium text-[#1E2022] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#1E5631]" /> {x}
          </div>
        ))}
      </div>
      <div className="flex justify-center my-4 text-[#B8B2A0]">↓</div>
      <div className="rounded-2xl bg-[#1E5631] text-[#FDFBF7] p-5 text-center">
        <div className="font-display text-xl font-bold">Local Market Intelligence Graph</div>
        <div className="text-sm opacity-85 mt-1 flex items-center justify-center gap-2 flex-wrap">
          <span>Neighborhood</span> <Map className="h-4 w-4" /> <span>City</span> <Map className="h-4 w-4" /> <span>India</span>
        </div>
      </div>
      <p className="text-sm text-[#3A403D] mt-4 max-w-2xl">
        The moat is not the AI model. It is the accumulation of structured, contextual, local market intelligence over time —
        demand and supply history that no single vendor or app can observe alone.
      </p>
    </div>
  );
}

function Roadmap() {
  const phases = [
    ["Phase 1 — Now", "One community, one market. WhatsApp-style PWA, Market Pulse, shopping lists, vendor signals, live Gemini interpretation.", true],
    ["Phase 2", "Real WhatsApp Business integration, real pilot, more vendors & households, better corroboration, captured snapshots.", false],
    ["Phase 3", "Neighborhood expansion, cross-market intelligence, vendor intelligence subscriptions, community partnerships.", false],
    ["Phase 4", "City-scale market intelligence.", false],
    ["Phase 5", "India-scale local commerce intelligence network.", false],
  ];
  return (
    <div className="flex flex-col gap-3">
      {phases.map(([t, d, now]) => (
        <div key={t} className={`rounded-2xl border p-4 ${now ? "bg-[#1E5631]/6 border-[#1E5631]/25" : "bg-white border-[#E5DEC9]"}`}>
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-[#1E2022]">{t}</div>
            <Chip tone={now ? "green" : "neutral"}>{now ? "Built now" : "Planned"}</Chip>
          </div>
          <div className="text-sm text-[#5C6360] mt-1">{d}</div>
        </div>
      ))}
    </div>
  );
}

function Positioning() {
  const rows = [
    [ShoppingCart, "Quick commerce", "\"Bring it to me.\""],
    [Store, "Physical local market", "\"I'll go choose.\""],
    [Network, "BazaarMind", "\"Help me understand my local market before I go.\""],
    [Truck, "ONDC", "Commerce infrastructure / transaction network."],
  ];
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map(([Icon, t, d]) => (
          <div key={t} className={`rounded-2xl border p-4 ${t === "BazaarMind" ? "bg-[#1E5631]/6 border-[#1E5631]/25" : "bg-white border-[#E5DEC9]"}`}>
            <div className="flex items-center gap-2 font-semibold text-[#1E2022]"><Icon className="h-4 w-4 text-[#1E5631]" /> {t}</div>
            <div className="text-sm text-[#5C6360] mt-1">{d}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-[#3A403D] mt-4 max-w-2xl">
        BazaarMind is a local market intelligence layer — not a replacement for quick commerce, physical markets, or ONDC.
        Intelligence → discovery → intent → optional future commerce integrations.
      </p>
    </div>
  );
}

function Research() {
  const shopper = [
    "Tell me about your last market visit.", "How long did shopping take?", "Did you compare multiple vendors?",
    "How did you know what was available?", "Did you know prices before reaching the market?", "What frustrates you?",
    "Do you use quick commerce?", "Why do you still visit the physical market?",
    "What information would be useful before leaving home?", "Would you use a WhatsApp-based service?",
  ];
  const vendor = [
    "How do you decide what to stock?", "How do you know neighborhood demand?", "What information do you wish you had?",
    "Would you send a short voice note?", "What would make participation worthwhile?",
    "Would market-level demand intelligence be useful?", "Would you pay for such intelligence?",
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {[["Shopper questions", shopper], ["Vendor questions", vendor]].map(([title, qs]) => (
        <div key={title} className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
          <div className="font-semibold text-[#1E2022] flex items-center gap-2"><Quote className="h-4 w-4 text-[#1E5631]" /> {title}</div>
          <ul className="mt-3 flex flex-col gap-2">
            {qs.map((q) => <li key={q} className="text-sm text-[#3A403D] flex gap-2"><span className="text-[#B8B2A0]">•</span>{q}</li>)}
          </ul>
        </div>
      ))}
      <p className="text-xs text-[#8A8A82] md:col-span-2">
        These are the questions that must be validated. No interviews have been conducted — nothing here is presented as completed research.
      </p>
    </div>
  );
}

function Node({ title, who, desc, icon: Icon, tone }) {
  const tones = { green: "bg-[#1E5631]/8 text-[#1E5631]", orange: "bg-[#D96B27]/10 text-[#B4571E]", ink: "bg-[#1E2022] text-[#FDFBF7]" };
  return (
    <div className="rounded-2xl bg-white border border-[#E5DEC9] p-4">
      <div className={`h-11 w-11 rounded-xl ${tones[tone]} flex items-center justify-center mx-auto`}><Icon className="h-5 w-5" /></div>
      <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mt-3">{title}</div>
      <div className="font-display font-bold text-[#1E2022]">{who}</div>
      <div className="text-xs text-[#5C6360] mt-0.5">{desc}</div>
    </div>
  );
}

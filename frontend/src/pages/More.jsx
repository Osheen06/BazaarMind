import React, { useEffect } from "react";
import { Network, LineChart, Home, Sparkles, ShieldCheck, Languages, Image, ScanText, MessageSquareText, Settings2, MessageCircle, UserPlus, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MoreLinkRow } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { SectionLabel, Chip } from "../components/atoms";
import { trackEvent } from "../lib/api";

const GEMINI_USES = [
  [Languages, "Multilingual interpretation", "Hindi, Hinglish & English — no translation needed"],
  [ScanText, "Shopping-list parsing", "Turns a sentence into structured items"],
  [MessageSquareText, "Conversational questions", "Grounded answers from real signals"],
  [Image, "Image interpretation", "Reads only visible evidence from a stall photo"],
  [Sparkles, "Signal classification", "Demand vs supply vs price vs context"],
  [ShieldCheck, "Uncertainty preserved", "Confidence labels, never false precision"],
];

const SCHEMA = `{
  product, availability, demand,
  reportedPrice | null, priceUnit | null,
  signalType, language, confidence,
  reasoning
}`;

const RULES = [
  "Never invent a price — if none is stated, reportedPrice = null.",
  "Distinguish demand from supply (\"bahut chal raha hai\" = demand).",
  "Unclear product or availability → UNKNOWN.",
  "Image evidence only — never exact inventory counts.",
  "A vendor observation is a signal, not market truth.",
  "Preserve uncertainty; ask a clarification when ambiguous.",
];

export default function More() {
  const navigate = useNavigate();
  const { markets, marketId, setMarketId, currentMarket, participant, clearParticipant, dataSource } = useApp();
  useEffect(() => { trackEvent("more_viewed"); }, []);

  return (
    <div className="space-y-8">
      {/* Core concept */}
      <div className="rounded-3xl bg-[#1E5631] text-[#FDFBF7] p-6 md:p-8">
        <div className="font-display text-xl md:text-2xl font-bold leading-snug">
          Every shopper is a signal.<br />Every vendor is a sensor.<br />The market is the network.<br />
          <span className="text-[#F2C88C]">Gemini is the interpreter.</span>
        </div>
      </div>

      {/* Navigation hub */}
      <div>
        <SectionLabel className="mb-2">Explore</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          <MoreLinkRow to="/network" icon={Network} title="Market Network" desc="Demand & supply as one living graph" testid="more-network" />
          <MoreLinkRow to="/whatsapp" icon={MessageCircle} title="WhatsApp Channel" desc="Integration-ready — production credentials required" testid="more-whatsapp" />
          <MoreLinkRow to="/join" icon={UserPlus} title="Join the Pilot" desc="Onboard as a shopper or vendor in under a minute" testid="more-join" />
          <MoreLinkRow to="/business" icon={LineChart} title="Pilot & Business" desc="Pilot design, live status, model, moat" testid="more-business" />
          <MoreLinkRow to="/pulse" icon={Sparkles} title="Market Pulse" desc="Today's market signals" testid="more-pulse" />
          <MoreLinkRow to="/" icon={Home} title="Home" desc="The Market That Thinks as One" testid="more-home" />
        </div>
      </div>

      {/* Gemini Intelligence */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Gemini Intelligence</SectionLabel>
          <div className="flex gap-2">
            <Chip tone="green"><Sparkles className="h-3 w-3" /> Live Gemini</Chip>
            <Chip tone="orange">Demo signals</Chip>
          </div>
        </div>
        <p className="text-sm text-[#3A403D] max-w-2xl mb-4">
          BazaarMind doesn't make people speak the language of technology. It makes technology understand the language of the market.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GEMINI_USES.map(([Icon, t, d]) => (
            <div key={t} className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
              <Icon className="h-5 w-5 text-[#1E5631]" />
              <div className="font-semibold text-[#1E2022] text-sm mt-2">{t}</div>
              <div className="text-xs text-[#5C6360] mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="bg-[#1E2022] rounded-2xl p-4">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[#F2C88C] mb-2">Structured signal schema</div>
            <pre className="font-mono text-xs text-[#E9E4D6] whitespace-pre-wrap leading-relaxed">{SCHEMA}</pre>
          </div>
          <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mb-2">Interpretation rules</div>
            <ul className="flex flex-col gap-1.5">
              {RULES.map((r) => <li key={r} className="text-xs text-[#3A403D] flex gap-2"><span className="text-[#1E5631]">✓</span>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div>
        <SectionLabel className="mb-2">Settings</SectionLabel>
        <div className="bg-white border border-[#E5DEC9] rounded-2xl divide-y divide-[#F0EBDE]">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="font-semibold text-[#1E2022] text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" /> Data source</div>
              <div className="text-xs text-[#5C6360]">
                {dataSource === "PILOT"
                  ? `Pilot mode — you joined as ${participant?.role}. Your contributions are labelled PILOT.`
                  : "Demo mode — synthetic market signals. Join the pilot to contribute real (PILOT) data. Gemini stays live."}
              </div>
            </div>
            <Chip tone={dataSource === "PILOT" ? "green" : "orange"} data-testid="data-source-chip">{dataSource}</Chip>
          </div>
          {participant && (
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <div className="font-semibold text-[#1E2022] text-sm">Pilot participant</div>
                <div className="text-xs text-[#5C6360]">{participant.name || "Anonymous"} · {participant.role}</div>
              </div>
              <button onClick={clearParticipant} data-testid="leave-pilot-button"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-xs font-semibold text-[#B4571E] hover:bg-[#F7F4EE]">
                <LogOut className="h-3.5 w-3.5" /> Leave pilot
              </button>
            </div>
          )}
          <div className="px-4 py-4">
            <div className="font-semibold text-[#1E2022] text-sm mb-1">Market</div>
            <select value={marketId} onChange={(e) => setMarketId(e.target.value)} data-testid="market-selector"
              className="w-full rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white">
              {(markets.length ? markets : [currentMarket]).map((m) => <option key={m.id} value={m.id}>{`${m.name} — ${m.area}`}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Final statement + integrity */}
      <div className="rounded-2xl bg-[#F7F4EE] border border-[#E5DEC9] p-5">
        <p className="text-sm text-[#3A403D] leading-relaxed">
          BazaarMind is building the intelligence layer for India's neighborhood markets. We connect what shoppers want with what
          vendors see, combining demand, supply, availability and price signals through Gemini to create a living Market Pulse.
          We start with one community and one market, and grow into an intelligence network for offline commerce.
        </p>
        <p className="text-xs text-[#8A8A82] mt-4">
          Integrity note: This is a demonstration MVP. Market data is synthetic and labelled as such. Gemini interpretation is live.
          No real users, vendors, pilot results, revenue, partnerships, or testimonials are represented.
        </p>
      </div>
    </div>
  );
}

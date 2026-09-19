import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, ArrowRight, ArrowDown, Server, Sparkles, CheckCircle2, KeyRound } from "lucide-react";
import { getWhatsappStatus, trackEvent } from "../lib/api";
import { SectionLabel, Chip } from "../components/atoms";

const PIPELINE = [
  ["WhatsApp", "Shopper / vendor message"],
  ["BazaarMind conversation layer", "Isolated from the intelligence APIs"],
  ["Gemini", "Interpret · classify · parse"],
  ["Market Intelligence Engine", "Corroboration · confidence"],
  ["Market Pulse → reply", "Sent back to WhatsApp"],
];

const ENV_VARS = [
  ["WHATSAPP_VERIFY_TOKEN", "A secret you choose; matched during webhook verification"],
  ["WHATSAPP_ACCESS_TOKEN", "Meta system-user token (whatsapp_business_messaging)"],
  ["WHATSAPP_PHONE_NUMBER_ID", "From Meta → WhatsApp → API Setup"],
  ["META_APP_SECRET", "App Dashboard → Settings → Basic (verifies X-Hub-Signature-256)"],
];

export default function WhatsAppChannel() {
  const [status, setStatus] = useState(null);
  useEffect(() => { getWhatsappStatus().then(setStatus).catch(() => {}); trackEvent("whatsapp_channel_viewed"); }, []);
  const configured = status?.configured;

  return (
    <div>
      <SectionLabel>WhatsApp channel</SectionLabel>
      <div className="flex items-center gap-3 flex-wrap mt-1">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[#1E2022]">Built for WhatsApp-first distribution</h1>
      </div>
      <div className="mt-3">
        <Chip tone={configured ? "green" : "orange"} data-testid="whatsapp-status-badge">
          {configured ? "WhatsApp integration live" : "WhatsApp integration ready — production credentials required"}
        </Chip>
      </div>
      <p className="text-sm text-[#5C6360] mt-3 max-w-2xl">
        The webhook and Graph API contracts are fully implemented. When Meta credentials are provided as environment variables,
        inbound WhatsApp messages route through the <b>same</b> intelligence engine that powers this PWA — no business logic is duplicated.
        We never simulate a live WhatsApp connection or fabricate messages.
      </p>

      {/* Pipeline */}
      <div className="mt-6 grid gap-2 max-w-xl">
        {PIPELINE.map(([t, d], i) => (
          <React.Fragment key={t}>
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-2xl bg-white border border-[#E5DEC9] px-4 py-3">
              <div className="h-9 w-9 rounded-lg bg-[#1E5631]/8 flex items-center justify-center text-[#1E5631]">
                {i === 0 ? <MessageCircle className="h-5 w-5" /> : i === 2 ? <Sparkles className="h-5 w-5" /> : <Server className="h-5 w-5" />}
              </div>
              <div><div className="font-semibold text-[#1E2022] text-sm">{t}</div><div className="text-xs text-[#5C6360]">{d}</div></div>
            </motion.div>
            {i < PIPELINE.length - 1 && <ArrowDown className="h-4 w-4 text-[#B8B2A0] mx-auto" />}
          </React.Fragment>
        ))}
      </div>

      {/* Contract */}
      <div className="grid md:grid-cols-2 gap-3 mt-8">
        <div className="bg-[#1E2022] rounded-2xl p-4">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-[#F2C88C] mb-2">Webhook contract (implemented)</div>
          <pre className="font-mono text-xs text-[#E9E4D6] whitespace-pre-wrap leading-relaxed">{`GET  /api/whatsapp/webhook
  ?hub.mode=subscribe
  &hub.verify_token=…
  &hub.challenge=…      → echoes challenge

POST /api/whatsapp/webhook
  X-Hub-Signature-256: sha256=…
  → verifies HMAC, routes text
    messages to the engine,
    replies via Graph API`}</pre>
        </div>
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mb-2 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Required environment variables
          </div>
          <div className="flex flex-col gap-2">
            {ENV_VARS.map(([k, d]) => (
              <div key={k}>
                <div className="font-mono text-xs font-semibold text-[#1E2022]">{k}</div>
                <div className="text-[11px] text-[#5C6360]">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#F7F4EE] border border-[#E5DEC9] p-4">
        <div className="text-sm font-semibold text-[#1E2022] flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1E5631]" /> Try it now (in-product)</div>
        <p className="text-sm text-[#5C6360] mt-1">
          The polished in-product WhatsApp-style experience is live in <b>Shopper</b>. Real WhatsApp delivery activates automatically once the four
          credentials above are set — the code path is already wired.
        </p>
      </div>
    </div>
  );
}

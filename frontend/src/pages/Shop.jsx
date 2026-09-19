import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { parseShoppingList, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import { TypingDots } from "../components/Loading";
import { Chip } from "../components/atoms";

const SUGGESTIONS = [
  "I need 2kg tomatoes, coriander and onions",
  "Mujhe aaj palak, aloo aur hari mirch chahiye",
  "Bananas, carrots and potatoes",
];

export default function Shop() {
  const { marketId, refreshPulse } = useApp();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "text",
      text: "Namaste! Tell me what you need today — in Hindi, Hinglish or English. Your list becomes an anonymous demand signal for your market.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { trackEvent("shop_opened"); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", type: "text", text: value }]);
    setBusy(true);
    trackEvent("shopping_list_created");
    try {
      const res = await parseShoppingList(value, marketId);
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", type: "text", text: res.error }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", type: "text", text: "Here's what your market looks like today for your list 👇" },
          { role: "assistant", type: "list", data: res },
        ]);
        refreshPulse();
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", type: "text", text: "Connection lost. Showing your last available market view." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-190px)] md:h-[calc(100vh-160px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E2022]">Shopper</h1>
          <p className="text-sm text-[#5C6360]">BazaarMind · Market Intelligence</p>
        </div>
        <Chip tone="green">Speak naturally</Chip>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bm-scroll mt-4 pr-1 flex flex-col gap-3 py-2">
        {messages.map((m, i) =>
          m.type === "list" ? (
            <ListResult key={i} data={m.data} />
          ) : (
            <Bubble key={i} role={m.role}>{m.text}</Bubble>
          )
        )}
        {busy && (
          <div className="self-start bg-[#F7F4EE] border border-[#E5DEC9] rounded-2xl rounded-tl-none px-4 py-3">
            <TypingDots />
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap mt-2 mb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="text-xs rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-[#3A403D] hover:bg-[#F7F4EE]">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <input
          data-testid="shopper-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="I need tomatoes, coriander and onions…"
          className="flex-1 rounded-full border border-[#E5DEC9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1E5631] focus:ring-2 focus:ring-[#1E5631]/15"
        />
        <button
          data-testid="shopper-send-button"
          onClick={() => send()}
          disabled={busy}
          className="h-11 w-11 rounded-full bg-[#1E5631] text-[#FDFBF7] flex items-center justify-center hover:bg-[#194727] disabled:opacity-50 transition-colors"
        >
          <Send className="h-4.5 w-4.5 h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, children }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className={`max-w-[85%] px-3.5 py-3 text-sm leading-relaxed shadow-sm ${
        isUser
          ? "self-end bg-[#2D6A4F] text-white rounded-2xl rounded-tr-none"
          : "self-start bg-[#F7F4EE] border border-[#E5DEC9] text-[#1E2022] rounded-2xl rounded-tl-none"
      }`}
    >
      {children}
    </motion.div>
  );
}

function ListResult({ data }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="self-start max-w-[92%] w-full bg-white border border-[#E5DEC9] rounded-2xl rounded-tl-none p-4 shadow-sm"
      data-testid="shopping-list-result"
    >
      <div className="text-xs font-semibold tracking-wide uppercase text-[#5C6360] mb-2">Your list vs today's market</div>
      <div className="flex flex-col divide-y divide-[#F0EBDE]">
        {data.items.map((it) => (
          <div key={it.product} className="flex items-center justify-between py-2.5 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {it.status === "tight" ? (
                <AlertTriangle className="h-4.5 w-4.5 h-5 w-5 text-[#B4571E] shrink-0" />
              ) : it.status === "unknown" ? (
                <HelpCircle className="h-5 w-5 text-[#8A8A82] shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-[#1E5631] shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[#1E2022] text-sm">
                  {it.product}{it.quantity ? <span className="text-[#8A8A82] font-normal"> · {it.quantity}</span> : null}
                </div>
                {it.known ? (
                  <div className="text-xs text-[#5C6360]">
                    {it.availability} availability · {it.demand} demand{it.reportedPriceSignal ? ` · ${it.reportedPriceSignal}` : ""}
                  </div>
                ) : (
                  <div className="text-xs text-[#8A8A82]">Not enough signals for this item yet.</div>
                )}
              </div>
            </div>
            {it.known && (
              <Chip tone={it.status === "tight" ? "orange" : "green"}>
                {it.status === "tight" ? "Tight" : "OK"}
              </Chip>
            )}
          </div>
        ))}
      </div>
      {data.summary && (
        <div className="mt-3 rounded-xl bg-[#D96B27]/8 border border-[#D96B27]/20 px-3 py-2 text-sm text-[#B4571E] font-medium">
          {data.summary}
        </div>
      )}
      <div className="mt-2 text-[11px] text-[#8A8A82]">Your shopping list just became an anonymous market signal.</div>
    </motion.div>
  );
}

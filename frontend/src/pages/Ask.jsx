import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { askBazaar, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import { TypingDots } from "../components/Loading";
import { Chip } from "../components/atoms";

const QUESTIONS = [
  "What should I know before I go?",
  "Is anything looking difficult today?",
  "Why are tomatoes showing tight?",
  "What are shoppers asking for today?",
  "What are vendors reporting?",
];

export default function Ask() {
  const { marketId, dataSource } = useApp();
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me anything about your market today. I answer only from the signals I actually have — and I'll say so when I don't have enough." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text) => {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setBusy(true);
    trackEvent("ask_bazaarmind_used");
    try {
      const res = await askBazaar(value, marketId, dataSource);
      setMessages((m) => [...m, { role: "assistant", text: res.ok ? res.answer : res.error, live: res.ok }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "BazaarMind couldn't interpret that right now. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-190px)] md:h-[calc(100vh-160px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E2022]">Ask BazaarMind</h1>
          <p className="text-sm text-[#5C6360]">Grounded in today's market signals</p>
        </div>
        <Chip tone="green"><Sparkles className="h-3.5 w-3.5" /> Live Gemini</Chip>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bm-scroll mt-4 pr-1 flex flex-col gap-3 py-2">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className={`max-w-[88%] px-3.5 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "self-end bg-[#2D6A4F] text-white rounded-2xl rounded-tr-none"
                : "self-start bg-white border border-[#E5DEC9] text-[#1E2022] rounded-2xl rounded-tl-none"
            }`}
            data-testid={m.role === "assistant" ? "ask-answer" : undefined}
          >
            {m.role === "assistant" && m.live && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E5631] mb-1.5">
                <Sparkles className="h-3 w-3" /> LIVE GEMINI
              </span>
            )}
            <div>{m.text}</div>
          </motion.div>
        ))}
        {busy && (
          <div className="self-start bg-white border border-[#E5DEC9] rounded-2xl rounded-tl-none px-4 py-3">
            <TypingDots />
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mt-2 mb-1">
        {QUESTIONS.map((q) => (
          <button key={q} onClick={() => send(q)} className="text-xs rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-[#3A403D] hover:bg-[#F7F4EE]">
            {q}
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <input
          data-testid="ask-gemini-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="What should I know before I go?"
          className="flex-1 rounded-full border border-[#E5DEC9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1E5631] focus:ring-2 focus:ring-[#1E5631]/15"
        />
        <button
          data-testid="ask-send-button"
          onClick={() => send()}
          disabled={busy}
          className="h-11 w-11 rounded-full bg-[#1E5631] text-[#FDFBF7] flex items-center justify-center hover:bg-[#194727] disabled:opacity-50 transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

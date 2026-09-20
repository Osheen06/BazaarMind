import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  motion,
} from "framer-motion";

import {
  Send,
  Sparkles,
  MapPin,
} from "lucide-react";

import {
  askBazaar,
  trackEvent,
} from "../lib/api";

import {
  useApp,
} from "../context/AppContext";

import {
  TypingDots,
} from "../components/Loading";

import {
  Chip,
} from "../components/atoms";

const QUESTIONS = [
  "What should I know before I go?",
  "Is anything looking difficult today?",
  "Why are tomatoes showing tight?",
  "What are shoppers asking for today?",
  "What are vendors reporting?",
];

export default function Ask() {
  const {
    marketId,
    dataSource,
    currentMarket,
  } = useApp();

  const [
    messages,
    setMessages,
  ] = useState([
    {
      role: "assistant",
      text:
        "Ask me anything about your market today. I answer only from the signals I actually have — and I'll say so when I don't have enough.",
    },
  ]);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const scrollRef =
    useRef(null);

  // ---------------------------------------------------------
  // Auto-scroll conversation
  // ---------------------------------------------------------

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top:
        scrollRef.current
          .scrollHeight,
      behavior: "smooth",
    });
  }, [
    messages,
    busy,
  ]);

  // ---------------------------------------------------------
  // Send question
  // ---------------------------------------------------------

  const send = async (
    text
  ) => {
    const value =
      (text ?? input).trim();

    if (
      !value ||
      busy
    ) {
      return;
    }

    setInput("");

    setMessages((existing) => [
      ...existing,
      {
        role: "user",
        text: value,
      },
    ]);

    setBusy(true);

    trackEvent(
      "ask_bazaarmind_used",
      {
        marketId,
        dataSource,
      }
    );

    try {
      const response =
        await askBazaar(
          value,
          marketId,
          dataSource
        );

      setMessages((existing) => [
        ...existing,
        {
          role: "assistant",
          text:
            response.ok
              ? response.answer
              : response.error ||
                "BazaarMind couldn't answer that right now.",
          live:
            response.ok,
        },
      ]);
    } catch {
      setMessages((existing) => [
        ...existing,
        {
          role: "assistant",
          text:
            "BazaarMind couldn't interpret that right now. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-190px)] md:h-[calc(100vh-160px)]">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between gap-4">

        <div className="min-w-0">

          <h1 className="font-display text-2xl font-bold text-[#1E2022]">
            Ask BazaarMind
          </h1>

          <div className="flex items-center gap-1.5 mt-1 text-sm text-[#5C6360]">

            <MapPin className="h-3.5 w-3.5 shrink-0" />

            <span className="truncate">
              {currentMarket?.name ||
                "Current market"}
            </span>

            <span>·</span>

            <span>
              grounded in today's signals
            </span>
          </div>

        </div>

        <Chip tone="green">
          <Sparkles className="h-3.5 w-3.5" />
          Live Gemini
        </Chip>

      </div>

      {/* =====================================================
          MARKET CONTEXT
      ====================================================== */}

      <div className="mt-3 rounded-xl bg-[#1E5631]/5 border border-[#1E5631]/15 px-3.5 py-2.5">

        <div className="flex items-center gap-2">

          <div className="h-7 w-7 rounded-full bg-[#1E5631]/10 flex items-center justify-center shrink-0">
            <MapPin className="h-3.5 w-3.5 text-[#1E5631]" />
          </div>

          <div className="min-w-0">

            <div className="text-xs font-semibold text-[#1E2022]">
              {currentMarket?.name ||
                "Current market"}
            </div>

            <div className="text-[10px] text-[#5C6360] truncate">
              {currentMarket?.area ||
                "Delhi NCR"}
            </div>

          </div>

          <div className="ml-auto shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E5DEC9] px-2 py-1 text-[9px] font-semibold text-[#1E5631]">
              <Sparkles className="h-2.5 w-2.5" />
              {dataSource === "PILOT"
                ? "PILOT SIGNALS"
                : "DEMO SIGNALS"}
            </span>
          </div>

        </div>

      </div>

      {/* =====================================================
          CHAT
      ====================================================== */}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bm-scroll mt-4 pr-1 flex flex-col gap-3 py-2"
      >

        {messages.map(
          (message, index) => (
            <motion.div
              key={index}
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.3,
              }}
              className={`max-w-[88%] px-3.5 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "self-end bg-[#2D6A4F] text-white rounded-2xl rounded-tr-none"
                  : "self-start bg-white border border-[#E5DEC9] text-[#1E2022] rounded-2xl rounded-tl-none"
              }`}
              data-testid={
                message.role ===
                "assistant"
                  ? "ask-answer"
                  : undefined
              }
            >

              {/* Gemini indicator */}

              {message.role ===
                "assistant" &&
                message.live && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E5631] mb-1.5">
                    <Sparkles className="h-3 w-3" />
                    LIVE GEMINI
                  </span>
                )}

              <div>
                {message.text}
              </div>

            </motion.div>
          )
        )}

        {/* Typing */}

        {busy && (
          <div className="self-start bg-white border border-[#E5DEC9] rounded-2xl rounded-tl-none px-4 py-3">
            <TypingDots />
          </div>
        )}

      </div>

      {/* =====================================================
          SUGGESTED QUESTIONS
      ====================================================== */}

      <div className="flex gap-2 flex-wrap mt-2 mb-1">

        {QUESTIONS.map(
          (question) => (
            <button
              key={question}
              onClick={() =>
                send(question)
              }
              disabled={busy}
              className="text-xs rounded-full border border-[#E5DEC9] bg-white px-3 py-1.5 text-[#3A403D] hover:bg-[#F7F4EE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {question}
            </button>
          )
        )}

      </div>

      {/* =====================================================
          INPUT
      ====================================================== */}

      <div className="mt-1 flex items-center gap-2">

        <input
          data-testid="ask-gemini-input"
          value={input}
          onChange={(event) =>
            setInput(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key ===
              "Enter"
            ) {
              event.preventDefault();
              send();
            }
          }}
          disabled={busy}
          placeholder="What should I know before I go?"
          className="flex-1 rounded-full border border-[#E5DEC9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1E5631] focus:ring-2 focus:ring-[#1E5631]/15 disabled:bg-[#F7F4EE] disabled:text-[#8A8A82]"
        />

        <button
          data-testid="ask-send-button"
          onClick={() =>
            send()
          }
          disabled={
            busy ||
            !input.trim()
          }
          className="h-11 w-11 shrink-0 rounded-full bg-[#1E5631] text-[#FDFBF7] flex items-center justify-center hover:bg-[#194727] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>

      </div>

    </div>
  );
}
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, MessageSquare, Store, Sparkles, Grid3x3, Network,
  LineChart, Settings, Radio, ChevronRight,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const MOBILE_NAV = [
  { to: "/pulse", label: "Pulse", icon: Activity, testid: "nav-item-pulse" },
  { to: "/shop", label: "Shop", icon: MessageSquare, testid: "nav-item-shop" },
  { to: "/vendor", label: "Vendor", icon: Store, testid: "nav-item-vendor" },
  { to: "/ask", label: "Ask", icon: Sparkles, testid: "nav-item-ask" },
  { to: "/more", label: "More", icon: Grid3x3, testid: "nav-item-more" },
];

const SIDEBAR_NAV = [
  { to: "/pulse", label: "Market Pulse", icon: Activity, testid: "side-pulse" },
  { to: "/network", label: "Market Network", icon: Network, testid: "side-network" },
  { to: "/shop", label: "Shopper", icon: MessageSquare, testid: "side-shop" },
  { to: "/vendor", label: "Vendor", icon: Store, testid: "side-vendor" },
  { to: "/ask", label: "Gemini Intelligence", icon: Sparkles, testid: "side-ask" },
  { to: "/business", label: "Pilot & Business", icon: LineChart, testid: "side-business" },
  { to: "/more", label: "Settings", icon: Settings, testid: "side-settings" },
];

function DemoModeBadge() {
  const { demoMode } = useApp();
  return (
    <div className="flex items-center gap-2" data-testid="demo-mode-indicator">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E5631]/8 border border-[#1E5631]/20 px-2.5 py-1 text-[11px] font-semibold text-[#1E5631]">
        <Radio className="h-3 w-3" /> LIVE GEMINI
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D96B27]/10 border border-[#D96B27]/25 px-2.5 py-1 text-[11px] font-semibold text-[#B4571E]">
        {demoMode ? "DEMO MODE · Synthetic signals" : "LIVE DATA"}
      </span>
    </div>
  );
}

function Logo({ compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-[#1E5631] flex items-center justify-center shadow-sm">
        <Network className="h-5 w-5 text-[#FDFBF7]" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display font-extrabold text-[#1E2022] tracking-tight">BazaarMind</div>
          <div className="text-[10px] tracking-[0.16em] uppercase text-[#5C6360]">Delhi NCR Intelligence</div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentMarket } = useApp();

  return (
    <div className="min-h-screen bg-[#FDFBF7] bm-noise">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-[#F7F4EE] border-r border-[#E5DEC9] min-h-screen p-4 sticky top-0 h-screen">
          <button onClick={() => navigate("/")} className="mb-6 mt-1 text-left" data-testid="sidebar-logo">
            <Logo />
          </button>
          <nav className="flex flex-col gap-1">
            {SIDEBAR_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-[#1E5631] text-[#FDFBF7]" : "text-[#3A403D] hover:bg-[#EFE9DA]"
                  }`
                }
              >
                <item.icon className="h-4.5 w-4.5 h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto pt-4 border-t border-[#E5DEC9]">
            <div className="text-[11px] text-[#5C6360] mb-2">Current market</div>
            <div className="rounded-xl bg-white border border-[#E5DEC9] px-3 py-2.5">
              <div className="font-semibold text-sm text-[#1E2022]">{currentMarket.name}</div>
              <div className="text-[11px] text-[#8A8A82]">{currentMarket.area}</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="sticky top-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E5DEC9]">
            <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3">
              <div className="md:hidden"><Logo compact /></div>
              <div className="hidden md:block">
                <div className="font-display font-semibold text-[#1E2022]">{currentMarket.name}</div>
                <div className="text-[11px] text-[#5C6360]">{currentMarket.area}</div>
              </div>
              <DemoModeBadge />
            </div>
          </header>

          <main className="flex-1 px-4 md:px-8 py-5 md:py-8 pb-28 md:pb-10 max-w-5xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#FDFBF7]/95 backdrop-blur-md border-t border-[#E5DEC9] z-50 px-2 py-1.5 md:hidden flex justify-around items-center">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={item.testid}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-colors ${
                isActive ? "text-[#1E5631]" : "text-[#8A8A82]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && (
                  <motion.span layoutId="bm-tab" className="absolute -top-1.5 h-1 w-6 rounded-full bg-[#1E5631]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function MoreLinkRow({ to, icon: Icon, title, desc, testid }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      data-testid={testid}
      className="w-full flex items-center gap-4 rounded-2xl bg-white border border-[#E5DEC9] px-4 py-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="h-10 w-10 rounded-xl bg-[#1E5631]/8 flex items-center justify-center text-[#1E5631]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[#1E2022]">{title}</div>
        <div className="text-xs text-[#5C6360] truncate">{desc}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-[#B8B2A0]" />
    </button>
  );
}

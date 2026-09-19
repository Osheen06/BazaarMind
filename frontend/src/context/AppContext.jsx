import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMarkets } from "../lib/api";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const DEFAULT_MARKET = "demo-ina";

export function AppProvider({ children }) {
  const [markets, setMarkets] = useState([]);
  const [marketId, setMarketId] = useState(DEFAULT_MARKET);
  const [demoMode, setDemoMode] = useState(true); // synthetic signals view
  const [pulseVersion, setPulseVersion] = useState(0);

  useEffect(() => {
    getMarkets().then(setMarkets).catch(() => {});
  }, []);

  const refreshPulse = useCallback(() => setPulseVersion((v) => v + 1), []);

  const currentMarket =
    markets.find((m) => m.id === marketId) || { id: DEFAULT_MARKET, name: "INA Market", area: "Delhi NCR" };

  return (
    <AppContext.Provider
      value={{ markets, marketId, setMarketId, currentMarket, demoMode, setDemoMode, pulseVersion, refreshPulse }}
    >
      {children}
    </AppContext.Provider>
  );
}

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMarkets } from "../lib/api";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const DEFAULT_MARKET = "demo-ina";

function loadParticipant() {
  try { return JSON.parse(localStorage.getItem("bm_participant") || "null"); }
  catch { return null; }
}

export function AppProvider({ children }) {
  const [markets, setMarkets] = useState([]);
  const [participant, setParticipantState] = useState(loadParticipant());
  const [marketId, setMarketId] = useState(participant?.marketId || DEFAULT_MARKET);
  const [pulseVersion, setPulseVersion] = useState(0);
  const [coords, setCoords] = useState(null);

  useEffect(() => { getMarkets().then(setMarkets).catch(() => {}); }, []);

  const refreshPulse = useCallback(() => setPulseVersion((v) => v + 1), []);

  const setParticipant = useCallback((p) => {
    if (p) {
      localStorage.setItem("bm_participant", JSON.stringify(p));
      setParticipantState(p);
      if (p.marketId) setMarketId(p.marketId);
    }
  }, []);

  const clearParticipant = useCallback(() => {
    localStorage.removeItem("bm_participant");
    setParticipantState(null);
  }, []);

  const dataSource = participant ? "PILOT" : "DEMO";
  const currentMarket =
    markets.find((m) => m.id === marketId) || { id: DEFAULT_MARKET, name: "INA Market", area: "Delhi NCR" };

  return (
    <AppContext.Provider
      value={{
        markets, marketId, setMarketId, currentMarket,
        participant, setParticipant, clearParticipant,
        dataSource, pulseVersion, refreshPulse,
        coords, setCoords,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

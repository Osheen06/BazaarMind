import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMarkets,
  getMarketsNearby,
  discoverNearbyMarkets,
  registerDiscoveredMarket,
} from "../lib/api";

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

const DEFAULT_MARKET = "demo-ina";
const PARTICIPANT_KEY = "bazaarmind.participant";
const MARKET_KEY = "bazaarmind.marketId";

function loadParticipant() {
  try {
    const raw = localStorage.getItem(PARTICIPANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadMarketId() {
  try {
    return localStorage.getItem(MARKET_KEY) || DEFAULT_MARKET;
  } catch {
    return DEFAULT_MARKET;
  }
}

function saveParticipant(participant) {
  try {
    if (participant) {
      localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(participant));
    } else {
      localStorage.removeItem(PARTICIPANT_KEY);
    }
  } catch {}
}

function saveMarketId(marketId) {
  try {
    localStorage.setItem(MARKET_KEY, marketId);
  } catch {}
}

function getBrowserPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getLocationWithRetry() {
  const attempts = [
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 },
  ];

  let lastError = null;

  for (const options of attempts) {
    try {
      return await getBrowserPosition(options);
    } catch (error) {
      lastError = error;
      if (error?.code === 1) throw error;
    }
  }

  throw lastError || new Error("Could not determine device location.");
}

function mergeMarkets(registered = [], discovered = []) {
  const result = [];

  for (const market of registered) {
    result.push(market);
  }

  for (const market of discovered) {
    // If a discovered place was already registered by BazaarMind, keep the
    // registered record because it may contain participant/intelligence data.
    const existing = result.find((item) => {
      if (
        market.placeId &&
        (item.externalPlaceId === market.placeId || item.placeId === market.placeId)
      ) return true;
      if (!market.name || !item.name) return false;
      return item.name.trim().toLowerCase() === market.name.trim().toLowerCase();
    });

    if (existing) {
      existing.distanceKm = market.distanceKm ?? existing.distanceKm;
      existing.provider = existing.provider || market.provider;
      existing.googleMapsUri = existing.googleMapsUri || market.googleMapsUri;
      existing.discoveryOnly = Boolean(existing.discoveryOnly && market.discoveryOnly);
      continue;
    }

    result.push({
      ...market,
      id: market.id || undefined,
      intelligenceAvailable: false,
      discoveryOnly: true,
    });
  }

  result.sort((a, b) => {
    const ai = a.intelligenceAvailable ? 0 : 1;
    const bi = b.intelligenceAvailable ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return (a.distanceKm ?? Number.POSITIVE_INFINITY) -
      (b.distanceKm ?? Number.POSITIVE_INFINITY);
  });

  return result;
}

export function AppProvider({ children }) {
  const [markets, setMarkets] = useState([]);
  const [participant, setParticipantState] = useState(loadParticipant);
  const [marketId, setMarketIdState] = useState(loadMarketId);
  const [pulseVersion, setPulseVersion] = useState(0);

  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [nearbyMarkets, setNearbyMarkets] = useState([]);
  const [nearbyResult, setNearbyResult] = useState(null);
  const [locationProvider, setLocationProvider] = useState(null);

  const dataSource = participant ? "PILOT" : "DEMO";

  const setMarketId = useCallback((nextMarketId) => {
    if (!nextMarketId) return;
    setMarketIdState(nextMarketId);
    saveMarketId(nextMarketId);
    setPulseVersion((v) => v + 1);
  }, []);

  const setParticipant = useCallback((nextParticipant) => {
    setParticipantState(nextParticipant || null);
    saveParticipant(nextParticipant || null);
  }, []);

  useEffect(() => {
    getMarkets()
      .then((items) => setMarkets(Array.isArray(items) ? items : []))
      .catch(() => {});
  }, []);

  const currentMarket = useMemo(() => {
    return (
      markets.find((m) => m.id === marketId) ||
      nearbyMarkets.find((m) => m.id === marketId) ||
      null
    );
  }, [markets, nearbyMarkets, marketId]);

  const refreshPulse = useCallback(() => {
    setPulseVersion((v) => v + 1);
  }, []);

  const registerAndSelectMarket = useCallback(
    async (market) => {
      if (!market) return null;

      if (market.id) {
        setMarketId(market.id);
        return market.id;
      }

      if (market.placeId) {
        const result = await registerDiscoveredMarket(market);
        const registered = result?.market;
        if (!registered?.id) {
          throw new Error("Could not register the discovered market.");
        }

        setMarkets((current) => {
          const withoutDuplicate = current.filter((m) => m.id !== registered.id);
          return [...withoutDuplicate, registered];
        });
        setNearbyMarkets((current) =>
          current.map((m) =>
            m.placeId === market.placeId ? { ...m, ...registered } : m
          )
        );
        setMarketId(registered.id);
        return registered.id;
      }

      throw new Error("This market does not have a BazaarMind market ID.");
    },
    [setMarketId]
  );

  const findNearbyMarkets = useCallback(async (options = {}) => {
    const { forVendor = false, position: suppliedPosition = null } = options;
    setLocationStatus("locating");
    setLocationError("");

    try {
      // Vendor activation already has a verified browser position. Reuse it
      // instead of asking CoreLocation for a second fix, which can fail with
      // transient kCLErrorLocationUnknown on macOS even when the first fix
      // succeeded.
      const position = suppliedPosition || (await getLocationWithRetry());
      const nextCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      setCoords(nextCoords);

      const [registeredResult, discoveryResult] = await Promise.allSettled([
        getMarketsNearby(nextCoords.lat, nextCoords.lng, dataSource, 25),
        discoverNearbyMarkets(nextCoords.lat, nextCoords.lng, 10),
      ]);

      const registered =
        registeredResult.status === "fulfilled"
          ? registeredResult.value
          : { markets: [], recommendedMarketId: null };
      const discovered =
        discoveryResult.status === "fulfilled"
          ? discoveryResult.value
          : { markets: [], configured: false };

      const merged = mergeMarkets(
        registered.markets || [],
        discovered.markets || []
      );

      const intelligenceMarket =
        merged.find(
          (market) =>
            market.intelligenceAvailable &&
            Number.isFinite(Number(market.distanceKm))
        ) || null;

      const marketsWithinFiveKm = merged
        .filter(
          (market) =>
            Number.isFinite(Number(market.distanceKm)) &&
            Number(market.distanceKm) <= 5
        )
        .sort(
          (a, b) =>
            Number(a.distanceKm) - Number(b.distanceKm)
        );

      const nearestMarket = marketsWithinFiveKm[0] || null;
      const recommended = forVendor
        ? nearestMarket
        : intelligenceMarket || nearestMarket || merged[0] || null;

      const result = {
        ok: true,
        origin: nextCoords,
        dataSource,
        markets: merged,
        recommendedMarketId: recommended?.id || null,
        recommendedMarket: recommended,
        hasNearbyIntelligence: Boolean(intelligenceMarket),
        discoveryConfigured: Boolean(discovered.configured),
        discoveryProvider: discovered.provider || null,
        discoveryError:
          discoveryResult.status === "rejected"
            ? discoveryResult.reason?.response?.data?.detail ||
              discoveryResult.reason?.message ||
              "Real market discovery is temporarily unavailable."
            : null,
      };

      setNearbyResult(result);
      setNearbyMarkets(merged);
      setLocationProvider(
        discovered.configured ? "GOOGLE_PLACES + BAZAARMIND" : "BAZAARMIND"
      );
      setLocationStatus("success");

      if (recommended && forVendor) {
        // A vendor must activate against a real BazaarMind market record.
        // Google-discovered places are registered only at this point, after
        // we have established that the device is within the 5 km boundary.
        if (recommended.placeId && !recommended.id) {
          const registeredId = await registerAndSelectMarket(recommended);
          result.recommendedMarketId = registeredId;
          result.recommendedMarket = { ...recommended, id: registeredId };
          setNearbyResult({ ...result });
        } else if (recommended.id) {
          setMarketId(recommended.id);
        }
      }

      return result;
    } catch (error) {
      const code = error?.code;
      let message = "We couldn't determine your location.";

      if (code === 1) {
        message =
          "Location permission was denied. Allow location access for BazaarMind and try again.";
      } else if (code === 2) {
        message =
          "Your device could not determine its location. Turn on Location Services and Wi-Fi, then try again.";
      } else if (code === 3) {
        message =
          "Location lookup timed out. Try again outdoors or on a phone with Location Services enabled.";
      } else if (error?.response?.data?.detail) {
        message = error.response.data.detail;
      } else if (error?.message) {
        message = error.message;
      }

      setLocationStatus("error");
      setLocationError(message);
      return null;
    }
  }, [dataSource, registerAndSelectMarket, setMarketId]);

  const chooseNearbyMarket = useCallback(
    async (market) => {
      if (!market) return null;
      return registerAndSelectMarket(market);
    },
    [registerAndSelectMarket]
  );

  const value = useMemo(
    () => ({
      markets,
      participant,
      setParticipant,
      marketId,
      setMarketId,
      currentMarket,
      dataSource,
      pulseVersion,
      refreshPulse,
      coords,
      locationStatus,
      locationError,
      locationProvider,
      nearbyMarkets,
      nearbyResult,
      findNearbyMarkets,
      chooseNearbyMarket,
    }),
    [
      markets,
      participant,
      setParticipant,
      marketId,
      setMarketId,
      currentMarket,
      dataSource,
      pulseVersion,
      refreshPulse,
      coords,
      locationStatus,
      locationError,
      locationProvider,
      nearbyMarkets,
      nearbyResult,
      findNearbyMarkets,
      chooseNearbyMarket,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

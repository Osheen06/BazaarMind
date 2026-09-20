import axios from "axios";

const BACKEND_URL =
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

export const API = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API,
  timeout: 60000,
});

// ---------------------------------------------------------
// Markets
// ---------------------------------------------------------

export const getMarkets = () =>
  client.get("/markets").then((r) => r.data);

export const getMarketDiscoveryStatus = () =>
  client.get("/markets/discovery/status").then((r) => r.data);

export const discoverNearbyMarkets = (lat, lng, radiusKm = 10) =>
  client
    .get("/markets/discover-nearby", {
      params: { lat, lng, radiusKm },
    })
    .then((r) => {
      const data = r.data || {};
      return {
        ...data,
        // The backend calls Google Places results `places`; the frontend
        // market pipeline consumes `markets`. Normalize at the API boundary
        // so discovery cannot silently disappear from the UI.
        markets: Array.isArray(data.markets)
          ? data.markets
          : Array.isArray(data.places)
            ? data.places
            : [],
      };
    });

export const registerDiscoveredMarket = (market) =>
  client
    .post("/markets/register-discovered", {
      placeId: market.placeId,
      name: market.name,
      address: market.address || null,
      lat: market.lat,
      lng: market.lng,
      primaryType: market.primaryType || null,
      types: market.types || [],
      googleMapsUri: market.googleMapsUri || null,
    })
    .then((r) => r.data);

export const getMarketsNearby = (
  lat,
  lng,
  dataSource = "DEMO",
  radiusKm = 25
) =>
  client
    .get("/markets/nearby", {
      params: { lat, lng, dataSource, radiusKm },
    })
    .then((r) => r.data);

export const getProducts = () =>
  client.get("/products").then((r) => r.data);

// ---------------------------------------------------------
// Nearby BazaarMind vendors / stalls
// ---------------------------------------------------------

export const getVendorsNearby = ({
  lat,
  lng,
  marketId,
  dataSource = "DEMO",
  radiusKm = 2,
  product,
}) =>
  client
    .get("/vendors/nearby", {
      params: {
        lat,
        lng,
        marketId,
        dataSource,
        radiusKm,
        ...(product ? { product } : {}),
      },
    })
    .then((r) => r.data);

export const turnVendorLocationOn = (payload) =>
  client
    .post("/vendor/location/on", payload)
    .then((r) => r.data);

export const turnVendorLocationOff = (payload) =>
  client
    .post("/vendor/location/off", payload)
    .then((r) => r.data);

export const getVendorLocationStatus = (
  vendorId,
  marketId,
  dataSource = "DEMO"
) =>
  client
    .get("/vendor/location/status", {
      params: { vendorId, marketId, dataSource },
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Market Pulse
// ---------------------------------------------------------

export const getMarketPulse = (marketId, dataSource = "DEMO") =>
  client
    .get("/market-pulse", {
      params: { marketId, dataSource },
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Gemini signal interpretation
// ---------------------------------------------------------

export const interpretSignal = (text, imageBase64) =>
  client
    .post("/signals/interpret", {
      text,
      imageBase64,
    })
    .then((r) => r.data);

export const createSignal = (signal) =>
  client.post("/signals", signal).then((r) => r.data);

export const listSignals = (marketId) =>
  client
    .get("/signals", {
      params: { marketId },
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Shopper
// ---------------------------------------------------------

export const parseShoppingList = (text, marketId, participantId) =>
  client
    .post("/shopping-list/parse", {
      text,
      marketId,
      participantId,
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Ask BazaarMind
// ---------------------------------------------------------

export const askBazaar = (question, marketId, dataSource = "DEMO") =>
  client
    .post("/ask-bazaar", {
      question,
      marketId,
      dataSource,
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Vendor intelligence
// ---------------------------------------------------------

export const getVendorDemand = (marketId, dataSource = "DEMO") =>
  client
    .get("/vendor/demand", {
      params: { marketId, dataSource },
    })
    .then((r) => r.data);

export const getMarketNetwork = (marketId, dataSource = "DEMO") =>
  client
    .get("/market-network", {
      params: { marketId, dataSource },
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Snapshots
// ---------------------------------------------------------

export const getSnapshots = (marketId) =>
  client
    .get("/snapshots", {
      params: { marketId },
    })
    .then((r) => r.data);

export const getSnapshotHistory = (marketId, dataSource = "DEMO") =>
  client
    .get("/snapshots/history", {
      params: { marketId, dataSource },
    })
    .then((r) => r.data);

export const getSnapshotTrends = (
  marketId,
  dataSource = "DEMO",
  days = 7
) =>
  client
    .get("/snapshots/trends", {
      params: { marketId, dataSource, days },
    })
    .then((r) => r.data);

export const captureSnapshot = (marketId, dataSource = "DEMO") =>
  client
    .post("/snapshots/capture", null, {
      params: { marketId, dataSource },
    })
    .then((r) => r.data);

// ---------------------------------------------------------
// Pilot
// ---------------------------------------------------------

export const createInvite = (community, marketId) =>
  client
    .post("/pilot/invite", { community, marketId })
    .then((r) => r.data);

export const getInvite = (code) =>
  client.get(`/pilot/invite/${code}`).then((r) => r.data);

export const getPilotMetrics = () =>
  client.get("/pilot/metrics").then((r) => r.data);

export const getPilotStatus = (marketId) =>
  client
    .get("/pilot/status", {
      params: { marketId },
    })
    .then((r) => r.data);

export const onboardShopper = (payload) =>
  client.post("/pilot/onboard/shopper", payload).then((r) => r.data);

export const onboardVendor = (payload) =>
  client.post("/pilot/onboard/vendor", payload).then((r) => r.data);

// ---------------------------------------------------------
// Voice
// ---------------------------------------------------------

export const getVoiceStatus = () =>
  client.get("/voice/status").then((r) => r.data);

export const transcribeAudio = (blob, filename = "voice.webm") => {
  const form = new FormData();
  form.append("audio", blob, filename);

  return client
    .post("/voice/transcribe", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// ---------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------

export const getWhatsappStatus = () =>
  client.get("/whatsapp/status").then((r) => r.data);

// ---------------------------------------------------------
// Analytics
// ---------------------------------------------------------

export const trackEvent = (event, props = {}) => {
  client
    .post("/analytics/event", {
      event,
      props,
    })
    .catch(() => {});
};

export default client;

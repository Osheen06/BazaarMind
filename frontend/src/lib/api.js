import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, timeout: 60000 });

export const getMarkets = () => client.get("/markets").then((r) => r.data);
export const getMarketsNearby = (lat, lng) =>
  client.get("/markets/nearby", { params: { lat, lng } }).then((r) => r.data);
export const getProducts = () => client.get("/products").then((r) => r.data);

export const getMarketPulse = (marketId, dataSource = "DEMO") =>
  client.get("/market-pulse", { params: { marketId, dataSource } }).then((r) => r.data);

export const interpretSignal = (text, imageBase64) =>
  client.post("/signals/interpret", { text, imageBase64 }).then((r) => r.data);
export const createSignal = (signal) => client.post("/signals", signal).then((r) => r.data);
export const listSignals = (marketId) =>
  client.get("/signals", { params: { marketId } }).then((r) => r.data);

export const parseShoppingList = (text, marketId, participantId) =>
  client.post("/shopping-list/parse", { text, marketId, participantId }).then((r) => r.data);

export const askBazaar = (question, marketId, dataSource = "DEMO") =>
  client.post("/ask-bazaar", { question, marketId, dataSource }).then((r) => r.data);

export const getVendorDemand = (marketId, dataSource = "DEMO") =>
  client.get("/vendor/demand", { params: { marketId, dataSource } }).then((r) => r.data);
export const getMarketNetwork = (marketId, dataSource = "DEMO") =>
  client.get("/market-network", { params: { marketId, dataSource } }).then((r) => r.data);

export const getSnapshots = (marketId) =>
  client.get("/snapshots", { params: { marketId } }).then((r) => r.data);
export const getSnapshotHistory = (marketId, dataSource = "DEMO") =>
  client.get("/snapshots/history", { params: { marketId, dataSource } }).then((r) => r.data);
export const captureSnapshot = (marketId, dataSource = "DEMO") =>
  client.post("/snapshots/capture", null, { params: { marketId, dataSource } }).then((r) => r.data);

export const getPilotMetrics = () => client.get("/pilot/metrics").then((r) => r.data);
export const getPilotStatus = (marketId) =>
  client.get("/pilot/status", { params: { marketId } }).then((r) => r.data);
export const onboardShopper = (payload) => client.post("/pilot/onboard/shopper", payload).then((r) => r.data);
export const onboardVendor = (payload) => client.post("/pilot/onboard/vendor", payload).then((r) => r.data);

export const getVoiceStatus = () => client.get("/voice/status").then((r) => r.data);
export const transcribeAudio = (blob, filename = "voice.webm") => {
  const form = new FormData();
  form.append("audio", blob, filename);
  return client.post("/voice/transcribe", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const getWhatsappStatus = () => client.get("/whatsapp/status").then((r) => r.data);

export const trackEvent = (event, props = {}) => {
  client.post("/analytics/event", { event, props }).catch(() => {});
};

export default client;

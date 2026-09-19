import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, timeout: 60000 });

export const getMarkets = () => client.get("/markets").then((r) => r.data);
export const getProducts = () => client.get("/products").then((r) => r.data);
export const getMarketPulse = (marketId) =>
  client.get("/market-pulse", { params: { marketId } }).then((r) => r.data);
export const interpretSignal = (text, imageBase64) =>
  client.post("/signals/interpret", { text, imageBase64 }).then((r) => r.data);
export const createSignal = (signal) => client.post("/signals", signal).then((r) => r.data);
export const listSignals = (marketId) =>
  client.get("/signals", { params: { marketId } }).then((r) => r.data);
export const parseShoppingList = (text, marketId) =>
  client.post("/shopping-list/parse", { text, marketId }).then((r) => r.data);
export const askBazaar = (question, marketId) =>
  client.post("/ask-bazaar", { question, marketId }).then((r) => r.data);
export const getVendorDemand = (marketId) =>
  client.get("/vendor/demand", { params: { marketId } }).then((r) => r.data);
export const getMarketNetwork = (marketId) =>
  client.get("/market-network", { params: { marketId } }).then((r) => r.data);
export const getSnapshots = (marketId) =>
  client.get("/snapshots", { params: { marketId } }).then((r) => r.data);
export const getPilotMetrics = () => client.get("/pilot/metrics").then((r) => r.data);

export const trackEvent = (event, props = {}) => {
  client.post("/analytics/event", { event, props }).catch(() => {});
};

export default client;

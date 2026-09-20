import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Power, PowerOff, Radio, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import {
  getVendorLocationStatus,
  turnVendorLocationOn,
  turnVendorLocationOff,
} from "../lib/api";

const VENDOR_ID_KEY = "bazaarmind.vendorId";

function getStableVendorId() {
  try {
    const existing = localStorage.getItem(VENDOR_ID_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `vendor-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(VENDOR_ID_KEY, id);
    return id;
  } catch {
    return `vendor-${Date.now()}`;
  }
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function locateVendor() {
  try {
    return await getPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000,
    });
  } catch (firstError) {
    if (firstError?.code === 1) throw firstError;

    return getPosition({
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 30000,
    });
  }
}

function friendlyLocationError(error) {
  if (error?.code === 1) {
    return "Location permission was denied. Allow location access for this site and try again.";
  }

  if (error?.code === 2) {
    return "Your device could not determine its location. Try again with Wi-Fi/location enabled.";
  }

  if (error?.code === 3) {
    return "Location lookup timed out. Try again, preferably with Wi-Fi/location enabled.";
  }

  return error?.message || "Could not determine your stall location.";
}

export default function VendorLocationCard({
  marketId,
  dataSource = "DEMO",
  participant,
  onLocationChange,
}) {
  const { findNearbyMarkets, setMarketId } = useApp();

  const vendorId = useMemo(
    () => participant?.id || getStableVendorId(),
    [participant?.id]
  );

  const [stallName, setStallName] = useState(
    participant?.stall || participant?.name || "My stall"
  );
  const [vendorName, setVendorName] = useState(
    participant?.name || "BazaarMind Vendor"
  );
  const [active, setActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    if (!marketId || !vendorId) return;

    setChecking(true);

    try {
      const result = await getVendorLocationStatus(
        vendorId,
        marketId,
        dataSource
      );

      setActive(Boolean(result.active));
      setLocation(result.location || null);

      if (onLocationChange) {
        onLocationChange(result.location || null);
      }
    } catch {
      // A missing location record is not an error state for the vendor.
      setActive(false);
      setLocation(null);
      onLocationChange?.(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    setStallName(participant?.stall || participant?.name || "My stall");
    setVendorName(participant?.name || "BazaarMind Vendor");
  }, [participant?.name, participant?.stall]);

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, dataSource, vendorId]);

  const turnOn = async () => {
    setBusy(true);
    setError("");

    try {
      const position = await locateVendor();

      // Resolve the market from the vendor's actual current position instead
      // of trusting a stale/manual market selection. This is what prevents the
      // production flow from asking the vendor to guess which market they are
      // standing in.
      const nearby = await findNearbyMarkets({
        forVendor: true,
        position,
      });
      const resolvedMarketId = nearby?.recommendedMarketId;

      if (!resolvedMarketId) {
        throw new Error(
          "No BazaarMind market was found within 5 km of your current location. Move closer to a market or choose a nearby participating market."
        );
      }

      if (resolvedMarketId !== marketId) {
        setMarketId(resolvedMarketId);
      }

      const payload = {
        marketId: resolvedMarketId,
        vendorId,
        participantId: participant?.id || null,
        vendorName: vendorName.trim() || "BazaarMind Vendor",
        stallName: stallName.trim() || "My stall",
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        dataSource,
        durationMinutes: 480,
      };

      const result = await turnVendorLocationOn(payload);

      if (!result.ok) {
        throw new Error(result.error || "Could not activate stall location.");
      }

      setActive(true);
      setLocation(result.location);
      onLocationChange?.(result.location);

      toast.success("Your stall is now visible to nearby shoppers.");
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        (err?.code ? friendlyLocationError(err) : err?.message) ||
        "Could not activate stall location.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError("");

    try {
      await turnVendorLocationOff({
        vendorId,
        marketId,
        dataSource,
      });

      setActive(false);
      setLocation(null);
      onLocationChange?.(null);

      toast.success("Your stall is no longer visible to nearby shoppers.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not turn off stall location.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              active
                ? "bg-[#E8F3EB] text-[#1E5631]"
                : "bg-[#F7F4EE] text-[#5C6360]"
            }`}
          >
            {active ? (
              <Radio className="h-5 w-5" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[#1E2022]">
                Your stall location
              </h2>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  active
                    ? "bg-[#E8F3EB] text-[#1E5631]"
                    : "bg-[#F3F0E8] text-[#77766F]"
                }`}
              >
                {active ? "VISIBLE TO SHOPPERS" : "OFF"}
              </span>
            </div>

            <p className="text-xs text-[#5C6360] mt-1">
              Turn this on when you are at your stall. Nearby shoppers can then
              see your current BazaarMind signals and reported prices.
            </p>
          </div>
        </div>

        <button
          onClick={active ? turnOff : turnOn}
          disabled={busy || checking}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
            active
              ? "border border-[#E5DEC9] bg-white text-[#7A3028]"
              : "bg-[#1E5631] text-white hover:bg-[#194727]"
          }`}
        >
          {busy ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : active ? (
            <PowerOff className="h-4 w-4" />
          ) : (
            <Power className="h-4 w-4" />
          )}

          {busy
            ? "Updating…"
            : active
              ? "Turn off location"
              : "Turn on stall location"}
        </button>
      </div>

      {!active && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <label className="text-xs text-[#5C6360]">
            Vendor / shop name
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5DEC9] bg-white px-3 py-2 text-sm text-[#1E2022] outline-none focus:border-[#1E5631]"
              placeholder="Sharma Sabzi Stall"
            />
          </label>

          <label className="text-xs text-[#5C6360]">
            Stall name
            <input
              value={stallName}
              onChange={(e) => setStallName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5DEC9] bg-white px-3 py-2 text-sm text-[#1E2022] outline-none focus:border-[#1E5631]"
              placeholder="Sharma Sabzi Stall"
            />
          </label>
        </div>
      )}

      {active && location && (
        <div className="mt-4 rounded-xl bg-[#F7F4EE] border border-[#E5DEC9] p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5C6360]">
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5 text-[#1E5631]" />
              Location active
            </span>

            {location.accuracyMeters != null && (
              <span>
                Approx. accuracy: {Math.round(location.accuracyMeters)} m
              </span>
            )}

            <span>
              Expires{" "}
              {location.expiresAt
                ? new Date(location.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "later today"}
            </span>
          </div>

          <p className="text-[11px] text-[#8A8A82] mt-2">
            BazaarMind uses this as your stall's current location. It does not
            need continuous background tracking.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-[#FFF5EF] border border-[#F0D7C7] px-3 py-2 text-xs text-[#9B4D24]">
          {error}
        </div>
      )}

      <div className="mt-3 text-[11px] text-[#8A8A82]">
        {dataSource === "DEMO"
          ? "Demo mode: location and vendor signals are synthetic until a real pilot vendor is onboarded."
          : "Pilot mode: your location is shared with BazaarMind shoppers only while you keep it active."}
      </div>
    </div>
  );
}

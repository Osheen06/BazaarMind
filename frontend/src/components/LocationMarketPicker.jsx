import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, MapPin, Navigation, Radio, Store, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getVendorsNearby } from "../lib/api";

function formatDistance(km) {
  if (km == null) return "Distance unavailable";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

function formatPrice(offer) {
  if (offer.reportedPrice == null) return "Price not reported";
  return `₹${Number(offer.reportedPrice).toLocaleString("en-IN")}${offer.priceUnit ? `/${offer.priceUnit}` : ""}`;
}

export default function LocationMarketPicker() {
  const {
    markets,
    currentMarket,
    marketId,
    dataSource,
    coords,
    locationStatus,
    locationError,
    locationProvider,
    nearbyMarkets,
    findNearbyMarkets,
    chooseNearbyMarket,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);

  const displayedMarkets = nearbyMarkets.length ? nearbyMarkets : markets;

  const selected = useMemo(
    () => displayedMarkets.find((m) => m.id === marketId) || currentMarket,
    [displayedMarkets, marketId, currentMarket]
  );

  const loadNearbyVendors = async (market = selected) => {
    if (!market) return;

    const lat = coords?.lat ?? market.lat;
    const lng = coords?.lng ?? market.lng;

    if (lat == null || lng == null) {
      setVendors([]);
      return;
    }

    setVendorsLoading(true);

    try {
      const result = await getVendorsNearby({
        lat,
        lng,
        marketId: market.id,
        dataSource,
        radiusKm: 2,
      });

      setVendors(result.vendors || []);
    } catch {
      setVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  useEffect(() => {
    if (open && selected) {
      loadNearbyVendors(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected?.id, coords?.lat, coords?.lng, dataSource]);

  const handleLocation = async () => {
    const result = await findNearbyMarkets();

    if (result?.recommendedMarketId) {
      const recommended = (result.markets || []).find(
        (m) => m.id === result.recommendedMarketId
      );

      if (recommended) {
        await loadNearbyVendors(recommended);
      }
    }
  };

  const selectMarket = async (market) => {
    try {
      const selectedId = await chooseNearbyMarket(market);
      const resolvedMarket =
        (nearbyMarkets || []).find((item) => item.id === selectedId) ||
        { ...market, id: selectedId };
      await loadNearbyVendors(resolvedMarket);
    } catch (error) {
      // Keep the selector usable even if a third-party discovery registration
      // fails. The user can retry without losing the current market.
      console.error(error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[#E5DEC9] bg-white px-3 py-2 text-left shadow-sm hover:bg-[#F7F4EE] transition-colors"
      >
        <MapPin className="h-4 w-4 text-[#1E5631]" />

        <span className="hidden sm:block min-w-0">
          <span className="block text-xs font-semibold text-[#1E2022] truncate max-w-[150px]">
            {selected?.name || "Choose your market"}
          </span>
          <span className="block text-[10px] text-[#8A8A82]">
            {selected?.area || "Use your location"}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 text-[#8A8A82] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close market picker"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#E5DEC9] bg-[#FDFBF7] shadow-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#1E2022]">
                  Choose your market
                </h3>
                <p className="text-xs text-[#5C6360] mt-1">
                  Location helps BazaarMind find participating markets and
                  nearby stalls with available intelligence.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-[#F0EBDE]"
              >
                <X className="h-4 w-4 text-[#77766F]" />
              </button>
            </div>

            <button
              onClick={handleLocation}
              disabled={locationStatus === "locating"}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E5631] text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              <Navigation
                className={`h-4 w-4 ${
                  locationStatus === "locating" ? "animate-pulse" : ""
                }`}
              />
              {locationStatus === "locating"
                ? "Finding nearby markets…"
                : "Use my location"}
            </button>

            {locationStatus === "error" && locationError && (
              <div className="mt-3 rounded-xl border border-[#F0D7C7] bg-[#FFF5EF] px-3 py-2 text-xs text-[#9B4D24]">
                {locationError}
              </div>
            )}

            {locationStatus === "success" && coords && (
              <div className="mt-3 rounded-xl bg-[#EAF4ED] border border-[#D3E7D8] px-3 py-2 text-xs text-[#1E5631]">
                Location found. BazaarMind is using it to find nearby market context.
                {locationProvider ? ` Source: ${locationProvider}.` : ""}
              </div>
            )}

            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#8A8A82] mb-2">
                Nearby markets
              </div>
              <div className="text-[11px] text-[#77766F] mb-2">
                Real nearby places are discovery context. BazaarMind prices and
                availability appear only when participating vendors report them.
              </div>

              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {displayedMarkets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => selectMarket(market)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                      market.id === marketId
                        ? "border-[#B7CDBD] bg-[#F3F8F4]"
                        : "border-[#EDE6D7] bg-white hover:bg-[#F7F4EE]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[#1E2022] truncate">
                            {market.name}
                          </span>
                          {market.id === marketId && (
                            <Check className="h-4 w-4 text-[#1E5631]" />
                          )}
                        </div>

                        <div className="text-[11px] text-[#8A8A82] mt-0.5">
                          {market.distanceKm != null
                            ? formatDistance(market.distanceKm)
                            : market.area}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${
                          market.intelligenceAvailable
                            ? "bg-[#E8F3EB] text-[#1E5631]"
                            : "bg-[#F4F0E7] text-[#8A806E]"
                        }`}
                      >
                        {market.intelligenceAvailable
                          ? "Intelligence"
                          : market.provider === "GOOGLE_PLACES"
                            ? "Real market · discovery"
                            : "Discovery only"}
                      </span>
                    </div>
                  </button>
                ))}

                {!displayedMarkets.length && (
                  <div className="text-sm text-[#8A8A82] py-3">
                    No markets are available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#EDE6D7]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#1E2022]">
                    <Store className="h-4 w-4 text-[#1E5631]" />
                    Nearby BazaarMind stalls
                  </div>
                  <div className="text-[10px] text-[#8A8A82] mt-0.5">
                    Vendor-reported signals only
                  </div>
                </div>

                {vendorsLoading && (
                  <Radio className="h-4 w-4 text-[#1E5631] animate-pulse" />
                )}
              </div>

              <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                {!vendorsLoading && !vendors.length && (
                  <div className="rounded-xl bg-white border border-[#EDE6D7] px-3 py-3 text-xs text-[#77766F]">
                    No active BazaarMind stalls are reporting from this area
                    right now.
                  </div>
                )}

                {vendors.map((vendor) => (
                  <div
                    key={vendor.vendorId}
                    className="rounded-xl bg-white border border-[#EDE6D7] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1E2022] truncate">
                          {vendor.stallName || vendor.vendorName}
                        </div>

                        <div className="text-[10px] text-[#8A8A82] mt-0.5">
                          {formatDistance(vendor.distanceKm)} · location active
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#1E5631]">
                        <Radio className="h-3 w-3" />
                        LIVE
                      </span>
                    </div>

                    {vendor.offers?.length ? (
                      <div className="mt-2 space-y-1">
                        {vendor.offers.slice(0, 4).map((offer) => (
                          <div
                            key={`${vendor.vendorId}-${offer.product}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-[#4F5552]">
                              {offer.product}
                            </span>

                            <span className="font-semibold text-[#1E2022]">
                              {formatPrice(offer)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-[#8A8A82]">
                        Location is active; no current product price signal.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 text-[10px] leading-4 text-[#8A8A82]">
              Prices and availability are vendor-reported signals, not
              guaranteed live prices. BazaarMind does not silently track
              movement.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, Store, MapPin, Check, ArrowRight, ShieldCheck, Ticket } from "lucide-react";
import { onboardShopper, onboardVendor, getMarkets, getMarketsNearby, getInvite, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import { SectionLabel, Chip } from "../components/atoms";

const LANGS = [["HINGLISH", "Hinglish"], ["HINDI", "हिंदी"], ["ENGLISH", "English"]];

export default function PilotOnboard() {
  const navigate = useNavigate();
  const { setParticipant, setCoords } = useApp();
  const [role, setRole] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    name: "", community: "", marketId: "demo-ina", language: "HINGLISH",
    stall: "", category: "", signalMethod: "text", consent: false,
  });
  const [saving, setSaving] = useState(false);
  const [params] = useSearchParams();
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    getMarkets().then(setMarkets).catch(() => {});
    trackEvent("pilot_onboard_viewed");
    const code = params.get("invite");
    if (code) {
      getInvite(code)
        .then((inv) => { setInvite(inv); setForm((f) => ({ ...f, community: inv.community, marketId: inv.marketId })); })
        .catch(() => {});
    }
    /* eslint-disable-next-line */
  }, []);

  const useLocation = () => {
    if (!navigator.geolocation) { toast.error("Location not available on this device."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const near = await getMarketsNearby(latitude, longitude);
          setMarkets(near);
          if (near[0]) setForm((f) => ({ ...f, marketId: near[0].id }));
          toast.success(`Nearest participating market: ${near[0]?.name}`);
        } catch { toast.error("Couldn't find nearby markets."); }
        finally { setLocating(false); }
      },
      () => { setLocating(false); toast.message("Location denied — pick your market manually below."); },
      { timeout: 8000 }
    );
  };

  const submit = async () => {
    if (!form.consent) { toast.error("Please give consent to join the pilot."); return; }
    if (role === "shopper" && !form.community.trim()) { toast.error("Please enter your community."); return; }
    setSaving(true);
    try {
      const payload = role === "shopper"
        ? { name: form.name || null, community: form.community, marketId: form.marketId, language: form.language, consent: form.consent }
        : { name: form.name || null, stall: form.stall || null, category: form.category || null, marketId: form.marketId, language: form.language, consent: form.consent, signalMethod: form.signalMethod };
      const res = role === "shopper" ? await onboardShopper(payload) : await onboardVendor(payload);
      trackEvent(`pilot_joined_${role}`);
      setParticipant({ ...res.participant, role });
      toast.success("You're in the pilot. Data you contribute is now labelled PILOT.");
      navigate(role === "shopper" ? "/shop" : "/vendor");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't complete onboarding.");
    } finally { setSaving(false); }
  };

  if (!role) {
    return (
      <div className="max-w-lg mx-auto">
        <SectionLabel>Pilot onboarding</SectionLabel>
        <h1 className="font-display text-3xl font-extrabold text-[#1E2022] mt-1">Join the INA Market pilot</h1>
        <p className="text-sm text-[#5C6360] mt-1">One community · one market · 20–50 households · 10–15 vendors · 14 days. Takes under a minute.</p>
        {invite && (
          <div className="mt-4 rounded-xl bg-[#1E5631]/8 border border-[#1E5631]/20 px-4 py-3 flex items-center gap-2 text-sm text-[#1E5631] font-medium" data-testid="invite-banner">
            <Ticket className="h-4 w-4" /> You're joining <b>{invite.community}</b> · {invite.market?.name}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <RoleCard icon={Users} title="I'm a shopper" desc="Check the market before you go; your list becomes a demand signal." onClick={() => setRole("shopper")} testid="onboard-role-shopper" />
          <RoleCard icon={Store} title="I'm a vendor" desc="Share what you see; receive neighborhood demand intelligence." onClick={() => setRole("vendor")} testid="onboard-role-vendor" />
        </div>
        <p className="mt-6 text-xs text-[#8A8A82]">No account or password. We only store what you enter here for the pilot, with your consent.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
      <button onClick={() => setRole(null)} className="text-sm text-[#5C6360] hover:underline mb-3">← Back</button>
      <div className="flex items-center gap-2">
        <Chip tone="green">{role === "shopper" ? "Shopper" : "Vendor"}</Chip>
        <span className="text-sm text-[#5C6360]">Quick onboarding</span>
      </div>

      <div className="mt-4 bg-white border border-[#E5DEC9] rounded-2xl p-5 space-y-4" data-testid="onboard-form">
        <Field label="Name or nickname (optional)">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Osheen" data-testid="onboard-name"
            className="w-full rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white" />
        </Field>

        {role === "shopper" ? (
          <Field label="Community / RWA">
            <input value={form.community} onChange={(e) => setForm({ ...form, community: e.target.value })}
              placeholder="e.g. Green Meadows RWA" data-testid="onboard-community"
              className="w-full rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white" />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stall (optional)">
              <input value={form.stall} onChange={(e) => setForm({ ...form, stall: e.target.value })}
                placeholder="e.g. Stall 12" className="w-full rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white" />
            </Field>
            <Field label="Category (optional)">
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Vegetables / Fruits" className="w-full rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white" />
            </Field>
          </div>
        )}

        <Field label="Nearby market">
          <div className="flex gap-2">
            <select value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })}
              data-testid="onboard-market" className="flex-1 rounded-lg border border-[#E5DEC9] px-3 py-2 text-sm bg-white">
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{`${m.name}${m.distanceKm != null ? ` · ${m.distanceKm} km` : ""}`}</option>
              ))}
            </select>
            <button onClick={useLocation} disabled={locating} data-testid="onboard-use-location"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DEC9] bg-[#F7F4EE] px-3 py-2 text-xs font-semibold text-[#1E5631] hover:bg-[#EFE9DA]">
              <MapPin className="h-4 w-4" /> {locating ? "Locating…" : "Near me"}
            </button>
          </div>
          <p className="text-[11px] text-[#8A8A82] mt-1">Use your location to find participating markets near you. We use approximate location only — never stored coordinates.</p>
        </Field>

        <Field label="Preferred language">
          <div className="flex gap-2">
            {LANGS.map(([v, l]) => (
              <button key={v} onClick={() => setForm({ ...form, language: v })}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${form.language === v ? "bg-[#1E5631] text-white border-[#1E5631]" : "bg-white border-[#E5DEC9] text-[#3A403D]"}`}>
                {l}
              </button>
            ))}
          </div>
        </Field>

        {role === "vendor" && (
          <Field label="Preferred signal method">
            <div className="flex gap-2">
              {["text", "voice", "photo"].map((m) => (
                <button key={m} onClick={() => setForm({ ...form, signalMethod: m })}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border capitalize ${form.signalMethod === m ? "bg-[#1E5631] text-white border-[#1E5631]" : "bg-white border-[#E5DEC9] text-[#3A403D]"}`}>
                  {m}
                </button>
              ))}
            </div>
          </Field>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer" data-testid="onboard-consent">
          <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1 accent-[#1E5631]" />
          <span className="text-xs text-[#3A403D]">I consent to join the demo pilot. My demand is shared only in aggregate; I can stop anytime.</span>
        </label>

        <button onClick={submit} disabled={saving} data-testid="onboard-submit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1E5631] text-[#FDFBF7] px-5 py-3 text-sm font-semibold hover:bg-[#194727] disabled:opacity-50">
          <Check className="h-4 w-4" /> {saving ? "Joining…" : "Join pilot & continue"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-4 text-xs text-[#8A8A82] flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#1E5631]" /> Pilot participation records are stored in the database and drive the live pilot status metrics.</p>
    </motion.div>
  );
}

function RoleCard({ icon: Icon, title, desc, onClick, testid }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className="text-left rounded-2xl bg-white border border-[#E5DEC9] p-5 hover:shadow-md transition-shadow">
      <div className="h-11 w-11 rounded-xl bg-[#1E5631]/8 flex items-center justify-center text-[#1E5631]"><Icon className="h-5 w-5" /></div>
      <div className="font-display font-bold text-[#1E2022] mt-3">{title}</div>
      <div className="text-xs text-[#5C6360] mt-1">{desc}</div>
    </button>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mb-1.5">{label}</div>
      {children}
    </div>
  );
}

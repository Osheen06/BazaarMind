import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mic, Camera, Type, Send, Store, Users, CheckCircle2, Pencil, X, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { interpretSignal, createSignal, getVendorDemand, listSignals, transcribeAudio, getVoiceStatus, trackEvent } from "../lib/api";
import { useApp } from "../context/AppContext";
import { ListeningLoader } from "../components/Loading";
import { Chip, ConfidenceBadge } from "../components/atoms";

const AVAIL = ["HIGH", "NORMAL", "LOW", "UNKNOWN"];
const DEMAND = ["HIGH", "NORMAL", "LOW", "UNKNOWN"];
const EXAMPLES = [
  "Aaj tamatar thoda kam aaya hai aur rate saath rupaye hai",
  "आज धनिया थोड़ा कम है",
  "Onion ka stock aaj achha hai",
];

export default function Vendor() {
  const { marketId, refreshPulse, dataSource, participant } = useApp();
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [demand, setDemand] = useState(null);
  const [recent, setRecent] = useState([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);

  const loadSide = () => {
    getVendorDemand(marketId, dataSource).then(setDemand).catch(() => {});
    listSignals(marketId).then((s) => setRecent(s.filter((x) => x.source === "VENDOR").slice(0, 6))).catch(() => {});
  };

  useEffect(() => { loadSide(); trackEvent("vendor_home_viewed"); /* eslint-disable-next-line */ }, [marketId, dataSource]);

  useEffect(() => { getVoiceStatus().then((s) => setVoiceOk(s.configured)).catch(() => setVoiceOk(false)); }, []);

  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setVoiceOk(false); toast.error("Microphone not available on this device."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        trackEvent("vendor_voice_recorded");
        try {
          const res = await transcribeAudio(blob, "voice.webm");
          if (res.ok) { setText(res.transcript); toast.success("Transcribed — interpreting…"); doInterpret(res.transcript, null); }
          else toast.error(res.error || "Could not transcribe audio.");
        } catch { toast.error("Could not transcribe audio."); }
        finally { setTranscribing(false); }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setVoiceOk(false);
      toast.error("Microphone permission denied.");
    }
  };
  const stopRec = () => { recorderRef.current?.stop(); setRecording(false); };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageB64(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  };

  const submit = () => doInterpret(text, imageB64);

  const doInterpret = async (rawText, image) => {
    if ((!rawText.trim() && !image) || busy) return;
    setBusy(true);
    trackEvent(image ? "image_signal_submitted" : "vendor_signal_started");
    try {
      const res = await interpretSignal(rawText.trim(), image);
      if (!res.ok) { toast.error(res.error); return; }
      setDraft({ ...res.signal, rawText: rawText.trim() });
    } catch {
      toast.error("BazaarMind couldn't interpret that right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    trackEvent("vendor_signal_confirmed");
    try {
      const priceType = draft.reportedPrice != null;
      const res = await createSignal({
        marketId,
        product: draft.product,
        signalType: draft.signalType || (priceType ? "PRICE" : "SUPPLY"),
        availability: draft.availability,
        reportedPrice: draft.reportedPrice ?? null,
        priceUnit: draft.priceUnit ?? null,
        demandLevel: draft.demand && draft.demand !== "UNKNOWN" ? draft.demand : null,
        language: draft.language || "HINGLISH",
        rawText: draft.rawText || text,
        source: "VENDOR",
        confidence: draft.confidence || "MEDIUM",
        reasoning: draft.reasoning || "",
        vendorName: participant?.name ? `${participant.name} (pilot vendor)` : "You (demo vendor)",
        participantId: participant?.id,
      });
      trackEvent("vendor_signal_submitted");
      if (res.published) {
        toast.success("Signal added to your market's pulse.");
      } else {
        toast.message("Signal received — held for review (unclear or unusual).");
      }
      setDraft(null); setText(""); setImageB64(null);
      refreshPulse();
      loadSide();
    } catch {
      toast.error("Market data is temporarily unavailable.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-[#1E2022]">Help your market hear itself.</h1>
      <p className="text-sm text-[#5C6360] mt-1">Send what you're seeing at your stall. BazaarMind turns it into a market signal — you decide before it publishes.</p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 mt-5">
        {/* Composer */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 md:p-5" data-testid="vendor-signal-form">
          <div className="flex gap-1.5 mb-3">
            <ModeTab active={mode === "text"} onClick={() => setMode("text")} icon={Type} label="Text" testid="vendor-mode-text" />
            <ModeTab active={mode === "voice"} onClick={() => setMode("voice")} icon={Mic} label="Voice" testid="vendor-mode-voice" />
            <ModeTab active={mode === "photo"} onClick={() => setMode("photo")} icon={Camera} label="Photo" testid="vendor-mode-photo" />
          </div>

          {mode === "voice" && (
            <div className="mb-3 rounded-xl bg-[#F7F4EE] border border-[#E5DEC9] p-4 text-center">
              {voiceOk ? (
                <>
                  <button
                    onClick={recording ? stopRec : startRec}
                    disabled={transcribing}
                    data-testid="vendor-mic-button"
                    className={`relative mx-auto h-16 w-16 rounded-full flex items-center justify-center text-white disabled:opacity-60 ${recording ? "bg-[#C53030]" : "bg-[#1E5631]"}`}
                  >
                    {recording && <span className="bm-pulse-ring text-[#C53030]" />}
                    <Mic className="h-6 w-6 relative" />
                  </button>
                  <div className="text-xs text-[#5C6360] mt-2">
                    {transcribing ? "Transcribing with Whisper…"
                      : recording ? "Recording… tap to stop. Speak in Hindi / Hinglish / English."
                      : "Tap to record a voice note. Server speech-to-text (Whisper) — works on any phone."}
                  </div>
                  <div className="text-[10px] text-[#8A8A82] mt-1 flex items-center justify-center gap-1"><Zap className="h-3 w-3 text-[#1E5631]" />Your transcript is preserved and shown below, then BazaarMind interprets it automatically for your review.</div>
                </>
              ) : (
                <div className="text-sm text-[#B4571E]">
                  Microphone/speech-to-text isn't available here. Type your signal below instead — the same
                  audio → Whisper → Gemini pipeline runs server-side in production.
                </div>
              )}
            </div>
          )}

          {mode === "photo" && (
            <div className="mb-3">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="vendor-photo-input" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-[#E5DEC9] bg-[#F7F4EE] px-4 py-6 text-center hover:border-[#1E5631]/40 transition-colors"
              >
                <Camera className="h-6 w-6 mx-auto text-[#5C6360]" />
                <div className="text-sm font-medium text-[#1E2022] mt-2">{imageB64 ? "Photo attached · tap to change" : "Upload a photo of your stall"}</div>
                <div className="text-xs text-[#8A8A82] mt-0.5">Gemini reads only visible evidence — never exact inventory.</div>
              </button>
            </div>
          )}

          <textarea
            data-testid="vendor-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={mode === "photo" ? "Add a note (optional): what should we know?" : "Aaj tamatar thoda kam aaya hai aur rate saath rupaye hai…"}
            className="w-full rounded-xl border border-[#E5DEC9] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#1E5631] focus:ring-2 focus:ring-[#1E5631]/15 resize-none"
          />

          <div className="flex flex-wrap gap-2 mt-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setText(ex)} className="text-[11px] rounded-full border border-[#E5DEC9] bg-white px-2.5 py-1 text-[#5C6360] hover:bg-[#F7F4EE]">
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            {busy ? <ListeningLoader label="Interpreting your signal…" /> : <span className="text-xs text-[#8A8A82]">Speak naturally. BazaarMind understands.</span>}
            <button
              onClick={submit}
              disabled={busy || (!text.trim() && !imageB64)}
              data-testid="vendor-send-signal-button"
              className="inline-flex items-center gap-2 rounded-full bg-[#1E5631] text-[#FDFBF7] px-5 py-2.5 text-sm font-semibold hover:bg-[#194727] disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" /> Send Market Signal
            </button>
          </div>
        </div>

        {/* Vendor value: neighborhood demand */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#1E5631] text-[#FDFBF7] rounded-2xl p-5" data-testid="vendor-demand-panel">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-80">
              <TrendingUp className="h-4 w-4" /> Today's shopper demand
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {(demand?.products || []).slice(0, 5).map((d) => (
                <div key={d.product} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.product}</span>
                  <span className="text-xs opacity-90">{d.level}</span>
                </div>
              ))}
              {!demand?.products?.length && <div className="text-sm opacity-80">Not enough shopper signals yet.</div>}
            </div>
            <div className="mt-4 pt-3 border-t border-white/20 text-sm">
              Your market has received <span className="font-bold">{demand?.totalRequests ?? 0}</span> shopper requests today.
            </div>
            <div className="mt-1 text-[11px] opacity-70">You give supply observations. You receive demand intelligence.</div>
          </div>

          <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-[#5C6360]">
              <Store className="h-4 w-4" /> Your recent signals
            </div>
            <div className="mt-3 flex flex-col divide-y divide-[#F0EBDE]">
              {recent.length ? recent.map((s) => (
                <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1E2022]">{s.product}</div>
                    <div className="text-[11px] text-[#8A8A82] truncate">{s.rawText}</div>
                  </div>
                  <Chip tone="neutral">{s.signalType}</Chip>
                </div>
              )) : <div className="text-sm text-[#8A8A82] py-2">No signals yet.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm-before-publish */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="bg-[#FDFBF7] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1E5631]" /> Here's what BazaarMind understood
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E5631]">
                <Sparkles className="h-3 w-3" /> LIVE GEMINI INTERPRETATION
              </span>
              {draft.clarification && (
                <div className="rounded-xl bg-[#D96B27]/8 border border-[#D96B27]/20 px-3 py-2 text-xs text-[#B4571E]">
                  {draft.clarification}
                </div>
              )}
              <EditRow label="Product">
                <input value={draft.product || ""} onChange={(e) => setDraft({ ...draft, product: e.target.value })}
                  className="w-full rounded-lg border border-[#E5DEC9] px-2.5 py-1.5 text-sm bg-white" data-testid="draft-product" />
              </EditRow>
              <div className="grid grid-cols-2 gap-3">
                <EditRow label="Availability">
                  <SelectBox value={draft.availability} options={AVAIL} onChange={(v) => setDraft({ ...draft, availability: v })} />
                </EditRow>
                <EditRow label="Demand">
                  <SelectBox value={draft.demand} options={DEMAND} onChange={(v) => setDraft({ ...draft, demand: v })} />
                </EditRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditRow label="Reported price (₹)">
                  <input type="number" value={draft.reportedPrice ?? ""} placeholder="—"
                    onChange={(e) => setDraft({ ...draft, reportedPrice: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#E5DEC9] px-2.5 py-1.5 text-sm bg-white" data-testid="draft-price" />
                </EditRow>
                <EditRow label="Unit">
                  <input value={draft.priceUnit ?? ""} placeholder="kg / bunch"
                    onChange={(e) => setDraft({ ...draft, priceUnit: e.target.value || null })}
                    className="w-full rounded-lg border border-[#E5DEC9] px-2.5 py-1.5 text-sm bg-white" />
                </EditRow>
              </div>
              <div className="flex items-center justify-between">
                <ConfidenceBadge level={{ HIGH: "High", MEDIUM: "Medium", LOW: "Low" }[draft.confidence] || "Medium"} />
                <Chip tone="neutral">{draft.signalType}</Chip>
              </div>
              {draft.reasoning && <p className="text-xs text-[#5C6360]">{draft.reasoning}</p>}
              <p className="text-[11px] text-[#8A8A82]">This is one observation — a signal, not verified market truth.</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setDraft(null)} data-testid="draft-edit-button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DEC9] bg-white px-4 py-2 text-sm font-semibold text-[#1E2022] hover:bg-[#F7F4EE]">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button onClick={publish} data-testid="vendor-confirm-publish-button"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1E5631] px-5 py-2 text-sm font-semibold text-[#FDFBF7] hover:bg-[#194727]">
              <CheckCircle2 className="h-4 w-4" /> Confirm & add
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, label, testid }) {
  return (
    <button onClick={onClick} data-testid={testid}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-[#1E5631] text-[#FDFBF7]" : "bg-[#F7F4EE] text-[#5C6360] hover:bg-[#EFE9DA]"
      }`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
function EditRow({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide uppercase text-[#5C6360] mb-1 flex items-center gap-1">
        <Pencil className="h-3 w-3" /> {label}
      </div>
      {children}
    </div>
  );
}
function SelectBox({ value, options, onChange }) {
  return (
    <select value={value || "UNKNOWN"} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#E5DEC9] px-2.5 py-1.5 text-sm bg-white">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

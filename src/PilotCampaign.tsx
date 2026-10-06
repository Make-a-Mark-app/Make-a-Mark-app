import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Copy, Gift, Leaf, Users } from "lucide-react";
import type { PilotMetrics, PilotParticipant } from "../server/pilot-store";

type Action = "share" | "offer_use" | "feedback";
type Props = {
  participant: PilotParticipant | null;
  loading: boolean;
  error: string;
  onStart: () => Promise<void>;
  onAction: (action: Action, extra?: { recall: "yes" | "no"; interest: "more" | "same" | "less" }) => Promise<boolean>;
};

export function PilotCampaign({ participant, loading, error, onStart, onAction }: Props) {
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [recall, setRecall] = useState<"yes" | "no" | "">("");
  const [interest, setInterest] = useState<"more" | "same" | "less" | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pilot/metrics").then((r) => r.ok ? r.json() : null).then(setMetrics).catch(() => setMetrics(null));
  }, [participant]);

  async function share() {
    const url = `${window.location.origin}/campaign?ref=${participant?.shareCode ?? ""}`;
    try {
      await navigator.clipboard.writeText(url);
      const recorded = await onAction("share");
      setCopyStatus(recorded ? "Referral link copied and demo share recorded." : "Referral link copied; demo share could not be recorded.");
    } catch { setCopyStatus("Copy was unavailable. Select and copy the link below."); }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recall || !interest) return;
    setSaving(true);
    await onAction("feedback", { recall, interest });
    setSaving(false);
  }

  return <div className="content-page campaign-page">
    <div className="campaign-hero"><p className="overline"><span /> AMF1 PILOT · PROTOTYPE</p><h1>Finish the mission.<br /><em>Make your mark.</em></h1><p>Explore one freight lesson, unlock a proposed impact reward and a sample merchandise offer, then invite a friend. Every action here is a prototype; no planting or purchase occurs.</p><div className="campaign-steps"><span>01 Learn</span><span>02 Unlock</span><span>03 Share</span><span>04 Measure</span></div></div>
    {error && <p className="campaign-alert" role="alert">{error}</p>}
    <section className="campaign-panel" aria-labelledby="campaign-progress"><div className="campaign-section-head"><span>YOUR JOURNEY</span><h2 id="campaign-progress">{participant?.completed ? "Mission complete" : participant?.started ? "Mission in progress" : "Ready when you are"}</h2></div><p>{participant?.completed ? "Your demo rewards are unlocked below. The proposed planting contribution and merchandise offer have not been fulfilled." : "Complete the freight mission and its short evidence check to unlock the sample rewards."}</p><button className="button button-primary" onClick={onStart} disabled={loading}>{participant?.completed ? "Review the mission" : participant?.started ? "Continue mission" : "Start the pilot mission"}<ArrowRight size={16} /></button></section>
    <div className="campaign-rewards">
      <article className="campaign-card"><div className="campaign-card-icon"><Leaf size={23} /></div><span className="campaign-tag">IMPACT REWARD · PROPOSED</span><h2>One tree contribution</h2><p>One verified course completion would trigger an AMF1 funded contribution for one tree through a future planting partner. A partner, unit cost and planting report have not yet been agreed.</p><strong>{participant?.completed ? "Demo unlock recorded — no tree planted" : "Unlock after mission completion"}</strong></article>
      <article className="campaign-card"><div className="campaign-card-icon"><Gift size={23} /></div><span className="campaign-tag">COMMERCIAL REWARD · SAMPLE</span><h2>20% off pilot merchandise</h2><p>Proposed terms: one AMF1 reusable bottle, no minimum spend, 14 days from completion, one use, and no combination with other promotions. AMF1 would fund the price reduction.</p><strong>{participant?.completed ? `Sample offer unlocked — expires ${participant.completedAt ? new Date(Date.parse(participant.completedAt) + 14 * 24 * 60 * 60 * 1000).toLocaleDateString() : "after 14 days"}` : "Unlock after mission completion"}</strong>{participant?.completed && <button className="button button-quiet" disabled={participant.offerUsed || Boolean(participant.completedAt && Date.now() >= Date.parse(participant.completedAt) + 14 * 24 * 60 * 60 * 1000)} onClick={() => void onAction("offer_use")}>{participant.offerUsed ? "Sample use recorded" : "Simulate offer use"}</button>}</article>
    </div>
    {participant?.completed && <section className="campaign-panel campaign-share"><div className="campaign-card-icon"><Users size={23} /></div><div><span className="campaign-tag">ONE SHARE METHOD</span><h2>Invite someone to try it</h2><p>Copy your personal referral link. We count a referral when someone opens it and starts the mission. Sharing is optional; there is no social contest or prize.</p><label htmlFor="referral-link">Your referral link</label><input id="referral-link" readOnly value={`${window.location.origin}/campaign?ref=${participant.shareCode}`} onFocus={(event) => event.currentTarget.select()} /><button className="button button-primary" onClick={() => void share()}><Copy size={16} />Copy referral link</button>{copyStatus && <p role="status">{copyStatus}</p>}</div></section>}
    {participant?.completed && <section className="campaign-panel" aria-labelledby="pilot-feedback"><div className="campaign-section-head"><span>OPTIONAL FEEDBACK</span><h2 id="pilot-feedback">What stayed with you?</h2></div>{participant.recall !== null ? <p><Check size={16} /> Thanks. Your response was recorded once for this demo pilot.</p> : <form className="campaign-feedback" onSubmit={(event) => void submitFeedback(event)}><label>Do you remember that AMF1 sustainability claims need a source and reporting period?<select value={recall} onChange={(event) => setRecall(event.target.value as typeof recall)} required><option value="">Select an answer</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>After the mission, how has your interest in AMF1 changed?<select value={interest} onChange={(event) => setInterest(event.target.value as typeof interest)} required><option value="">Select an answer</option><option value="more">More interested</option><option value="same">About the same</option><option value="less">Less interested</option></select></label><button className="button button-primary" disabled={saving}>Save optional feedback</button></form>}</section>}
    <section className="campaign-panel campaign-metrics" aria-labelledby="pilot-metrics"><div className="campaign-section-head"><span>MEASUREMENT · DEMO EVENTS</span><h2 id="pilot-metrics">Pilot pulse</h2></div><p>Counts cover prototype activity on this site. Offer use is simulated; interest and message recall are self reported. These figures do not show real sales, planting or environmental impact.</p><div className="campaign-metric-grid">{([ ["Started", metrics?.started], ["Finished", metrics?.completed], ["Shared", metrics?.shared], ["Referral starts", metrics?.referralStarts], ["Offer uses", metrics?.offerUsed], ["Feedback responses", metrics?.feedbackResponses], ["Remembered message", metrics?.messageRemembered], ["Greater interest", metrics?.greaterInterest] ] as const).map(([label, value]) => <div key={label}><strong>{value ?? "—"}</strong><span>{label}</span></div>)}</div></section>
    <p className="campaign-footnote">Before a real campaign: AMF1 must approve the merchandise terms and budget, contract a planting partner, verify completed courses, and reconcile redemption and planting reports. Group challenges and social post contests are outside this first pilot.</p>
  </div>;
}

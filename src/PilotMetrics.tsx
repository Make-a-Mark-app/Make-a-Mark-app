import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { parsePilotMetrics, type PilotMetrics as Metrics } from "../shared/contracts/pilot";

const percent = (part: number, total: number) => total ? `${Math.round(part / total * 100)}%` : "—";

export function PilotMetrics({ onReturn }: { onReturn: () => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/pilot/metrics", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Metrics unavailable");
        const parsed = parsePilotMetrics(await response.json());
        if (!parsed) throw new Error("Invalid metrics");
        if (!controller.signal.aborted) { setMetrics(parsed); setError(false); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  return <div className="pilot-page"><div className="pilot-wrap pilot-dashboard">
    <p className="pilot-eyebrow">LOCAL PROTOTYPE · AGGREGATE DEMO EVENTS</p>
    <h1>Pilot measurement</h1>
    <p className="pilot-dashboard-intro">These are interactions recorded by this demo server across browsers. They are not verified people, confirmed shares, merchandise purchases, or planted trees.</p>
    <div className="pilot-dashboard-actions"><button type="button" className="pilot-text-button" onClick={onReturn}>← Back to rewards</button><button type="button" className="pilot-text-button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh counts</button></div>
    {loading && <p role="status">Loading demo metrics…</p>}
    {error && !loading && <p className="pilot-sync-error" role="status">The demo metrics API is unavailable. Try refreshing when the local API is running.</p>}
    {metrics && !loading && !error && <>
      <div className="pilot-metric-grid" aria-label="Demo pilot funnel">
        <article><span>JOINED / STARTED</span><strong>{metrics.joined}</strong><small>Random browser IDs; not verified people</small></article>
        <article><span>FINISHED</span><strong>{metrics.completed}</strong><small>{percent(metrics.completed, metrics.joined)} of demo starts</small></article>
        <article><span>COPIED LINK</span><strong>{metrics.sharers}</strong><small>{metrics.shareActions} copy actions; delivery unconfirmed</small></article>
        <article><span>REFERRED STARTS</span><strong>{metrics.referredJoins}</strong><small>Valid codes on a new mission start</small></article>
        <article><span>DEMO OFFER USES</span><strong>{metrics.demoOfferUses}</strong><small>{percent(metrics.demoOfferUses, metrics.completed)} of completions; no orders</small></article>
      </div>
      <section className="pilot-dashboard-survey"><p className="pilot-eyebrow">OPTIONAL RESPONSE CHECK</p><h2>Message and interest</h2><div><p><strong>{metrics.correctRecall} / {metrics.surveyResponses}</strong><span>remembered the reported travel and logistics message</span></p><p><strong>{metrics.increasedInterest} / {metrics.surveyResponses}</strong><span>reported greater interest in AMF1 sustainability work</span></p></div><small>Self-reported answers from demo respondents. Missing responses are excluded from these two denominators.</small></section>
      <section className="pilot-dashboard-economics"><p className="pilot-eyebrow">ILLUSTRATIVE COST CHECK</p><h2>One proposed bottle offer</h2><p>At a concept bottle price of £30, each simulated 20% use represents £6 of potential discount. Recorded demo uses imply <strong>£{metrics.demoOfferUses * 6}</strong> of illustrative discount exposure. If every demo finisher used an offer, the maximum would be <strong>£{metrics.completed * 6}</strong>. Actual prices, eligible SKUs, incremental margin, and planting costs need merchant and partner agreements.</p></section>
    </>}
    <button type="button" className="pilot-primary" onClick={onReturn}>Return to the reward journey <ArrowRight size={17} aria-hidden="true" /></button>
  </div></div>;
}

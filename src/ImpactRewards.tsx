import { useEffect, useState } from "react";
import { ArrowRight, Coins, Droplets, TreePine } from "lucide-react";
import { IMPACT_CONTRIBUTION_REDEMPTION_COST, MAX_IMPACT_REWARDS_COUNT } from "../shared/contracts/impact-rewards";
import { parseImpactTotals, type ImpactExchangeKind, type ImpactTotals } from "../shared/contracts/impact-totals";
import { ShopGlobe } from "./ShopGlobe";

type ImpactRewardsProps = {
  credits: number;
  treesThisYear: number;
  treesAllTime: number;
  notice: string;
  feedback: string;
  onRedeem: (kind: ImpactExchangeKind) => Promise<ImpactTotals | null>;
};

export function ImpactRewards({ credits, treesThisYear, treesAllTime, notice, feedback, onRedeem }: ImpactRewardsProps) {
  const [totals, setTotals] = useState<ImpactTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<ImpactExchangeKind | null>(null);
  const canSpend = credits >= IMPACT_CONTRIBUTION_REDEMPTION_COST && totals !== null && redeeming === null;
  const treeLimitReached = treesThisYear >= MAX_IMPACT_REWARDS_COUNT || treesAllTime >= MAX_IMPACT_REWARDS_COUNT;

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetch("/api/impact-totals", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Totals unavailable");
          if (!controller.signal.aborted) setTotals(parseImpactTotals(await response.json()));
        })
        .catch(() => { if (!controller.signal.aborted) setTotals(null); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    };
    refresh();
    const interval = window.setInterval(refresh, 20_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, []);

  async function exchange(kind: ImpactExchangeKind) {
    if (!canSpend || (kind === "tree" && treeLimitReached)) return;
    setRedeeming(kind);
    try {
      const next = await onRedeem(kind);
      if (next) setTotals(next);
    } finally { setRedeeming(null); }
  }

  return (
    <div className="content-page rewards-page">
      <h1>Impact shop</h1>
      <ShopGlobe totals={totals} />
      <section className="rewards-global-totals" aria-label="Shared demo exchange totals">
        <div><strong className={totals && totals.trees >= 10000 ? "rewards-total-long" : undefined}>{totals ? totals.trees.toLocaleString() : "—"}</strong><span>Demo tree exchanges</span></div>
        <div><strong className={totals && totals.waterDollars >= 10000 ? "rewards-total-long" : undefined}>{totals ? `$${totals.waterDollars.toLocaleString()}` : "—"}</strong><span>Demo water value</span></div>
      </section>
      <p className="rewards-global-note" role={loading ? undefined : "status"}>{loading ? "Loading shared demo totals…" : totals ? "Shared prototype activity. No tree planting or donation has been fulfilled." : "Shared demo totals are unavailable right now."}</p>
      <div className="rewards-balance"><Coins size={21} aria-hidden="true" /><strong>Carbon Coins: {credits}</strong></div>
      {notice && <p className="rewards-status" role="status">{notice}</p>}
      {feedback && <p className="rewards-status" role="status">{feedback}</p>}
      <section className="rewards-exchange-grid" aria-label="Exchange options">
        <article className="rewards-exchange-card"><span className="rewards-exchange-icon"><TreePine size={28} aria-hidden="true" /></span><h2>Tree planting</h2><p>Record a demo tree contribution.</p><span className="rewards-exchange-cost">Exchange: 10 Carbon Coins</span><button className="button button-primary" onClick={() => exchange("tree")} disabled={!canSpend || treeLimitReached}>{redeeming === "tree" ? "Recording…" : "Exchange for a tree"}<ArrowRight size={16} aria-hidden="true" /></button></article>
        <article className="rewards-exchange-card rewards-exchange-water"><span className="rewards-exchange-icon"><Droplets size={28} aria-hidden="true" /></span><h2>Water conservation</h2><p>Record a demo $1 water conservation value.</p><span className="rewards-exchange-cost">Exchange: 10 Carbon Coins</span><button className="button button-primary" onClick={() => exchange("water")} disabled={!canSpend}>{redeeming === "water" ? "Recording…" : "Exchange for water"}<ArrowRight size={16} aria-hidden="true" /></button></article>
      </section>
    </div>
  );
}

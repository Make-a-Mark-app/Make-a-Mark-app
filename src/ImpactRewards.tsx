import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Coins, Droplets, TreePine, X } from "lucide-react";
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
  onGrantCredits: (amount: number) => void;
  onReset: () => Promise<void>;
  children?: ReactNode;
};

export function ImpactRewards({ credits, treesThisYear, treesAllTime, notice, feedback, onRedeem, onGrantCredits, onReset, children }: ImpactRewardsProps) {
  const [totals, setTotals] = useState<ImpactTotals | null>(null);
  const [redeeming, setRedeeming] = useState<ImpactExchangeKind | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantError, setGrantError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const remainingCredits = MAX_IMPACT_REWARDS_COUNT - credits;
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
        .catch(() => { if (!controller.signal.aborted) setTotals(null); });
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

  function openPrototypePanel() {
    setGrantAmount("");
    setGrantError("");
    setConfirmReset(false);
    setResetError("");
    dialogRef.current?.showModal();
    amountRef.current?.focus();
  }

  function grantCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(grantAmount);
    if (!/^[1-9]\d*$/.test(grantAmount) || !Number.isSafeInteger(amount) || amount > remainingCredits) {
      setGrantError(`Enter a whole number from 1 to ${remainingCredits.toLocaleString()}.`);
      return;
    }
    onGrantCredits(amount);
    dialogRef.current?.close();
  }

  async function resetPreview() {
    setResetting(true);
    setResetError("");
    try { await onReset(); }
    catch { setResetError("The preview could not be reset. Please try again."); }
    finally { setResetting(false); }
  }

  return (
    <div className="content-page rewards-page" id="top">
      <section className="rewards-hero" aria-label="Impact rewards">
        <h1>Impact shop</h1>
        <ShopGlobe totals={totals} />
        <section className="rewards-global-totals" aria-label="Impact exchange totals">
          <div><strong className={totals && totals.trees >= 10000 ? "rewards-total-long" : undefined}>{totals ? totals.trees.toLocaleString() : "—"}</strong><span>Tree exchanges</span></div>
          <div><strong className={totals && totals.waterDollars >= 10000 ? "rewards-total-long" : undefined}>{totals ? `$${totals.waterDollars.toLocaleString()}` : "—"}</strong><span>Water conservation value</span></div>
        </section>
        <button type="button" className="rewards-balance" onClick={openPrototypePanel} aria-haspopup="dialog"><Coins size={21} aria-hidden="true" /><strong>Carbon Coins: {credits}</strong></button>
        <dialog ref={dialogRef} className="rewards-admin-dialog" aria-labelledby="rewards-admin-title" aria-describedby="rewards-admin-disclaimer">
          <div className="rewards-admin-heading"><span>Prototype admin panel</span><button type="button" className="rewards-admin-close" onClick={() => dialogRef.current?.close()} aria-label="Close admin panel"><X size={22} aria-hidden="true" /></button></div>
          <h2 id="rewards-admin-title">Add Carbon Coins</h2>
          <p id="rewards-admin-disclaimer" className="rewards-admin-disclaimer"><strong>FOR PROTOTYPE PREVIEW PURPOSES ONLY</strong><span>These are test Carbon Coins in your browser. They are not money, verified impact, or a real donation.</span></p>
          <form onSubmit={grantCredits} noValidate>
            <label htmlFor="rewards-grant-amount">How many Carbon Coins do you want to give yourself?</label>
            <input ref={amountRef} id="rewards-grant-amount" type="number" min="1" max={remainingCredits} step="1" inputMode="numeric" value={grantAmount} onChange={(event) => { setGrantAmount(event.target.value); setGrantError(""); }} disabled={remainingCredits === 0} />
            <p className="rewards-admin-balance">Current balance: {credits.toLocaleString()} Carbon Coins</p>
            {grantError && <p className="rewards-admin-error" role="alert">{grantError}</p>}
            {remainingCredits === 0 && <p className="rewards-admin-error">The prototype balance has reached its limit.</p>}
            <button type="submit" className="button button-primary rewards-admin-submit" disabled={remainingCredits === 0}>Add Carbon Coins</button>
          </form>
          <div className="rewards-admin-reset">
            {confirmReset ? <>
              <p><strong>Full reset?</strong> This clears your Carbon Coins and mission progress, resets the shared tree and water exchange totals for everyone, then returns you to the main page.</p>
              {resetError && <p className="rewards-admin-error" role="alert">{resetError}</p>}
              <div className="rewards-admin-reset-actions"><button type="button" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</button><button type="button" className="rewards-admin-reset-confirm" onClick={() => void resetPreview()} disabled={resetting}>{resetting ? "Resetting…" : "Confirm full reset"}</button></div>
            </> : <button type="button" className="rewards-admin-reset-trigger" onClick={() => setConfirmReset(true)}>Full reset</button>}
          </div>
        </dialog>
        {notice && <p className="rewards-status" role="status">{notice}</p>}
        {feedback && <p className="rewards-status" role="status">{feedback}</p>}
        <section className="rewards-exchange-grid" aria-label="Exchange options">
          <article className="rewards-exchange-card rewards-exchange-tree"><span className="rewards-exchange-icon"><TreePine size={28} aria-hidden="true" /></span><h2>Tree planting</h2><p>Use Carbon Coins toward tree planting.</p><span className="rewards-exchange-cost">Exchange: 10 Carbon Coins</span><button className="button button-primary" onClick={() => exchange("tree")} disabled={!canSpend || treeLimitReached}>{redeeming === "tree" ? "Recording…" : "Exchange for a tree"}<ArrowRight size={16} aria-hidden="true" /></button></article>
          <article className="rewards-exchange-card rewards-exchange-water"><span className="rewards-exchange-icon"><Droplets size={28} aria-hidden="true" /></span><h2>Water conservation</h2><p>Use Carbon Coins toward water conservation.</p><span className="rewards-exchange-cost">Exchange: 10 Carbon Coins</span><button className="button button-primary" onClick={() => exchange("water")} disabled={!canSpend}>{redeeming === "water" ? "Recording…" : "Exchange for water"}<ArrowRight size={16} aria-hidden="true" /></button></article>
        </section>
      </section>
      {children}
    </div>
  );
}

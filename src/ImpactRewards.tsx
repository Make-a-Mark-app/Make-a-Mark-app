import { ArrowRight, Info, TreePine } from "lucide-react";

type ImpactRewardsProps = {
  credits: number;
  notice: string;
  onReset: () => void;
  onNavigate: (screen: "mission") => void;
};

export function ImpactRewards({ credits, notice, onReset, onNavigate }: ImpactRewardsProps) {
  return (
    <div className="content-page rewards-page">
      <div className="rewards-heading">
        <div>
          <p className="overline"><span /> LOCAL DEMO REWARDS</p>
          <h1>Impact rewards</h1>
          <p>Complete the fictional freight mission to earn a demo Impact Credit.</p>
        </div>
        <section className="rewards-balance" aria-labelledby="rewards-balance-title">
          <TreePine size={23} aria-hidden="true" />
          <span id="rewards-balance-title">YOUR IMPACT CREDITS</span>
          <strong aria-live="polite">{credits}</strong>
          <small>Stored in this browser only</small>
          <button className="button button-primary" onClick={() => onNavigate("mission")}>
            Play the freight mission <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button className="button button-quiet rewards-reset" onClick={onReset}>Reset rewards</button>
        </section>
      </div>
      {notice && <p className="success-line rewards-status" role="status" aria-live="polite">{notice}</p>}
      <p className="rewards-demo-note">
        <Info size={16} aria-hidden="true" />
        <span>These demo credits are stored only in this browser. They are not a real loyalty balance and do not represent a measured impact or confirmed tree planting.</span>
      </p>
    </div>
  );
}

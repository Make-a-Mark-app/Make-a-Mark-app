import { ArrowRight, Info, TreePine } from "lucide-react";

type ImpactRewardsProps = {
  credits: number;
  notice: string;
  feedback: string;
  onEarn: (action: "video" | "merchandise") => void;
  onReset: () => void;
  onNavigate: (screen: "mission") => void;
};

export function ImpactRewards({ credits, notice, feedback, onEarn, onReset, onNavigate }: ImpactRewardsProps) {
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
      {feedback && <p className="success-line rewards-status" role="status" aria-live="polite">{feedback}</p>}
      <section className="rewards-earning" aria-labelledby="rewards-earning-title">
        <div className="rewards-earning-heading">
          <p className="overline"><span /> SIMULATED EARNING</p>
          <h2 id="rewards-earning-title">Try other ways to earn</h2>
          <p>These controls record demo actions in this browser. They do not connect to a video service or a store.</p>
        </div>
        <div className="rewards-action-grid">
          <article className="rewards-action-card">
            <h3>Video completion</h3>
            <p>This action is simulated. The prototype does not verify a video view.</p>
            <button className="button button-primary" onClick={() => onEarn("video")}>Record demo video completion</button>
          </article>
          <article className="rewards-action-card">
            <h3>Sustainable merchandise</h3>
            <p>This action is simulated. The prototype does not verify product eligibility or a purchase.</p>
            <p>Bamboo-based merchandise and lower-impact shipping are hypothetical eligibility examples only; they are not available products.</p>
            <button className="button button-primary" onClick={() => onEarn("merchandise")}>Record demo merchandise purchase</button>
          </article>
        </div>
      </section>
      <p className="rewards-demo-note">
        <Info size={16} aria-hidden="true" />
        <span>These demo credits are stored only in this browser. They are not a real loyalty balance and do not represent a measured impact or confirmed tree planting.</span>
      </p>
    </div>
  );
}

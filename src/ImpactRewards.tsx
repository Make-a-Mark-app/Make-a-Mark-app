import { ArrowRight, Info, TreePine } from "lucide-react";
import { IMPACT_CONTRIBUTION_REDEMPTION_COST, MAX_IMPACT_REWARDS_COUNT } from "../shared/contracts/impact-rewards";

const fictionalLeaderboard = [
  { rank: "01", name: "Avery Chen" },
  { rank: "02", name: "Mika Okafor" },
  { rank: "03", name: "Sofia Laurent" },
];

type ImpactRewardsProps = {
  credits: number;
  year: number;
  treesThisYear: number;
  treesAllTime: number;
  notice: string;
  feedback: string;
  onEarn: (action: "video" | "merchandise") => void;
  onRedeem: () => void;
  onReset: () => void;
  onNavigate: (screen: "mission") => void;
};

export function ImpactRewards({ credits, year, treesThisYear, treesAllTime, notice, feedback, onEarn, onRedeem, onReset, onNavigate }: ImpactRewardsProps) {
  const contributionLimitReached = treesThisYear >= MAX_IMPACT_REWARDS_COUNT || treesAllTime >= MAX_IMPACT_REWARDS_COUNT;
  const canRedeem = credits >= IMPACT_CONTRIBUTION_REDEMPTION_COST && !contributionLimitReached;
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
          <button className="button button-primary" onClick={onRedeem} disabled={!canRedeem} aria-describedby="rewards-redemption-help">
            Redeem 10 credits for a demo contribution
          </button>
          <small id="rewards-redemption-help">
            {contributionLimitReached
              ? "The supported demo contribution limit has been reached."
              : !canRedeem
                ? `Need ${IMPACT_CONTRIBUTION_REDEMPTION_COST} Impact Credits to redeem; you have ${credits}.`
                : "Ten credits records one fictional demo contribution."}
          </small>
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
      <section className="rewards-contributions" aria-labelledby="rewards-contributions-title">
        <div className="rewards-earning-heading">
          <p className="overline"><span /> BROWSER-LOCAL DEMO TOTALS</p>
          <h2 id="rewards-contributions-title">Demo contributions</h2>
        </div>
        <div className="rewards-contribution-totals">
          <div><span>THIS YEAR · {year}</span><strong>{treesThisYear}</strong><small>Browser-local demo contributions this year</small></div>
          <div><span>ALL TIME</span><strong>{treesAllTime}</strong><small>Browser-local demo contributions all time</small></div>
        </div>
        <p className="rewards-contribution-note">These are fictional demo totals. No tree was planted and no impact was measured.</p>
      </section>
      <section className="rewards-examples" aria-label="Illustrative campaign and leaderboard examples">
        <article className="rewards-campaign" aria-labelledby="rewards-campaign-title">
          <p className="overline"><span /> CAMPAIGN EXAMPLE</p>
          <h2 id="rewards-campaign-title">Illustrative campaign placeholder</h2>
          <span className="rewards-campaign-label">Illustrative campaign total</span>
          <div className="rewards-campaign-mark" aria-hidden="true">—</div>
          <p>Illustrative demo data — not live AMF1 data or a measured impact result.</p>
        </article>
        <article className="rewards-leaderboard" aria-labelledby="rewards-leaderboard-title">
          <p className="overline"><span /> FICTIONAL EXAMPLE</p>
          <h2 id="rewards-leaderboard-title">Example leaderboard</h2>
          <p>Fictional names and ranks only. This fixed example is independent of browser rewards activity.</p>
          <ol aria-label="Fixed fictional leaderboard">
            {fictionalLeaderboard.map(({ rank, name }) => <li key={rank}><span>{rank}</span><strong>{name}</strong></li>)}
          </ol>
        </article>
      </section>
      <p className="rewards-prize-note">Race-pass prize hypothesis only. No prize or contest is active.</p>
      <p className="rewards-demo-note">
        <Info size={16} aria-hidden="true" />
        <span>These demo credits are stored only in this browser. No video view or purchase is verified, no payment is transferred, no order is placed, no tree is planted, no carbon credit or offset is issued, and no impact is measured.</span>
      </p>
    </div>
  );
}
